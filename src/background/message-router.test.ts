import { describe, expect, it } from 'vitest';

import { createDefaultAppSettings } from '../core/settings/defaults.ts';
import { SettingsStore } from '../core/settings/settings-store.ts';
import type { ExtensionLocalStorage } from '../shared/browser/local-storage.ts';
import { SETTINGS_STORAGE_KEY } from '../shared/browser/local-storage.ts';
import { MESSAGE_TYPES } from '../shared/messaging/index.ts';
import { BackgroundMessageRouter } from './message-router.ts';

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

  it('returns a typed safe error until transform providers are implemented', async () => {
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
});
