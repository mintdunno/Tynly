import { describe, expect, it, vi } from 'vitest';

import { createDefaultAppSettings } from '../core/settings/defaults.ts';
import { SettingsStore } from '../core/settings/settings-store.ts';
import type { ExtensionLocalStorage } from '../shared/browser/local-storage.ts';
import { SETTINGS_STORAGE_KEY } from '../shared/browser/local-storage.ts';
import { MESSAGE_TYPES } from '../shared/messaging/index.ts';
import { MAX_PROVIDER_MODELS_PER_RESPONSE } from '../shared/messaging/index.ts';
import {
  BackgroundMessageRouter,
  type ProviderOperationMessageService,
  type TransformMessageService
} from './message-router.ts';

class MemoryStorage implements ExtensionLocalStorage {
  private readonly values = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    return this.values.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, structuredClone(value));
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }

  async restrictToTrustedContexts(): Promise<void> {}

  seed(settings: unknown): void {
    this.values.set(SETTINGS_STORAGE_KEY, settings);
  }
}

describe('BackgroundMessageRouter', () => {
  const extensionId = 'tynly-test-extension';
  const trustedSender = { id: extensionId };
  const trustedExtensionPageSender = {
    id: extensionId,
    url: `chrome-extension://${extensionId}/src/ui/settings/index.html`
  };

  it('returns only a redacted settings snapshot to a trusted content sender', async () => {
    const storage = new MemoryStorage();
    const settings = createDefaultAppSettings();
    settings.providers.activeProfileId = 'openai';
    settings.providers.profiles.push({
      id: 'openai',
      name: 'Private provider',
      kind: 'openai',
      baseUrl: 'https://api.openai.com',
      apiKey: 'sk-private',
      selectedModelId: 'model',
      timeoutMs: 25_000,
      temperature: null,
      maxOutputTokens: null
    });
    storage.seed(settings);
    const router = new BackgroundMessageRouter(new SettingsStore(storage));

    const response = await router.handle(
      {
        type: MESSAGE_TYPES.getContentSettings,
        requestId: 'settings-request'
      },
      trustedSender,
      extensionId
    );

    expect(response).toMatchObject({
      type: MESSAGE_TYPES.contentSettings,
      requestId: 'settings-request',
      settings: {
        activeProvider: {
          id: 'openai',
          configured: true
        }
      }
    });
    expect(JSON.stringify(response)).not.toContain('sk-private');
    expect(JSON.stringify(response)).not.toContain('api.openai.com');
  });

  it('rejects external and malformed messages without a response', async () => {
    const router = new BackgroundMessageRouter(new SettingsStore(new MemoryStorage()));

    await expect(
      router.handle(
        {
          type: MESSAGE_TYPES.getContentSettings,
          requestId: 'settings-request'
        },
        { id: 'different-extension' },
        extensionId
      )
    ).resolves.toBeNull();

    await expect(
      router.handle({ type: 'unknown' }, trustedSender, extensionId)
    ).resolves.toBeNull();
  });

  it('returns a typed safe error when no provider profile is configured', async () => {
    const router = new BackgroundMessageRouter(new SettingsStore(new MemoryStorage()));

    const response = await router.handle(
      {
        type: MESSAGE_TYPES.transformRequest,
        requestId: 'request-1',
        operationId: 'operation-1',
        trigger: 'shortcut',
        text: 'hello'
      },
      trustedSender,
      extensionId
    );

    expect(response).toEqual(
      expect.objectContaining({
        type: MESSAGE_TYPES.transformError,
        requestId: 'request-1',
        operationId: 'operation-1',
        error: expect.objectContaining({ code: 'CONFIGURATION' })
      })
    );
  });

  it('routes a provider result without exposing provider service details', async () => {
    const transformService: TransformMessageService = {
      cancel: vi.fn(),
      transform: vi.fn().mockResolvedValue({
        operationId: 'operation-1',
        text: 'Hello, team.'
      })
    };
    const router = new BackgroundMessageRouter(
      new SettingsStore(new MemoryStorage()),
      transformService
    );

    await expect(
      router.handle(
        {
          type: MESSAGE_TYPES.transformRequest,
          requestId: 'request-1',
          operationId: 'operation-1',
          trigger: 'shortcut',
          text: 'xin chao team'
        },
        trustedSender,
        extensionId
      )
    ).resolves.toEqual({
      type: MESSAGE_TYPES.transformResult,
      requestId: 'request-1',
      operationId: 'operation-1',
      text: 'Hello, team.'
    });

    expect(transformService.transform).toHaveBeenCalledWith({
      operationId: 'operation-1',
      text: 'xin chao team',
      trigger: 'shortcut'
    });
  });

  it('forwards cancellation to the background transform service', async () => {
    const transformService: TransformMessageService = {
      cancel: vi.fn().mockReturnValue(true),
      transform: vi.fn()
    };
    const router = new BackgroundMessageRouter(
      new SettingsStore(new MemoryStorage()),
      transformService
    );

    await expect(
      router.handle(
        {
          type: MESSAGE_TYPES.cancelTransform,
          requestId: 'request-1',
          operationId: 'operation-1'
        },
        trustedSender,
        extensionId
      )
    ).resolves.toMatchObject({
      type: MESSAGE_TYPES.transformError,
      error: { code: 'CANCELLED' }
    });
    expect(transformService.cancel).toHaveBeenCalledWith('operation-1');
  });

  it('allows provider operations only from a trusted extension page', async () => {
    const providerOperations: ProviderOperationMessageService = {
      listModels: vi.fn().mockResolvedValue([{ id: 'gpt-test', label: 'GPT test' }]),
      testConnection: vi.fn().mockResolvedValue({ ok: true })
    };
    const router = new BackgroundMessageRouter(
      new SettingsStore(new MemoryStorage()),
      { cancel: vi.fn(), transform: vi.fn() },
      providerOperations
    );
    const request = {
      type: MESSAGE_TYPES.listProviderModels,
      requestId: 'provider-request',
      profileId: 'openai-main'
    };

    await expect(router.handle(request, trustedSender, extensionId)).resolves.toBeNull();
    await expect(
      router.handle(
        request,
        {
          id: extensionId,
          url: `chrome-extension://${extensionId}/src/ui/popup/index.html`
        },
        extensionId
      )
    ).resolves.toBeNull();

    await expect(router.handle(request, trustedExtensionPageSender, extensionId)).resolves.toEqual({
      type: MESSAGE_TYPES.providerModels,
      requestId: 'provider-request',
      profileId: 'openai-main',
      models: [{ id: 'gpt-test', label: 'GPT test' }]
    });
    expect(providerOperations.listModels).toHaveBeenCalledWith('openai-main');
  });

  it('bounds discovered models before they cross the background message bridge', async () => {
    const providerOperations: ProviderOperationMessageService = {
      listModels: vi.fn().mockResolvedValue(
        Array.from({ length: MAX_PROVIDER_MODELS_PER_RESPONSE + 1 }, (_, index) => ({
          id: `model-${index}`,
          label: `Model ${index}`
        }))
      ),
      testConnection: vi.fn()
    };
    const router = new BackgroundMessageRouter(
      new SettingsStore(new MemoryStorage()),
      { cancel: vi.fn(), transform: vi.fn() },
      providerOperations
    );

    const response = await router.handle(
      {
        type: MESSAGE_TYPES.listProviderModels,
        requestId: 'provider-request',
        profileId: 'openai-main'
      },
      trustedExtensionPageSender,
      extensionId
    );

    expect(response).toMatchObject({ type: MESSAGE_TYPES.providerModels });
    if (response?.type !== MESSAGE_TYPES.providerModels) {
      throw new Error('Expected provider models response.');
    }
    expect(response.models).toHaveLength(MAX_PROVIDER_MODELS_PER_RESPONSE);
  });
});
