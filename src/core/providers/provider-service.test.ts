import { describe, expect, it } from 'vitest';

import { SettingsStore } from '../settings/settings-store.ts';
import { createDefaultAppSettings } from '../settings/defaults.ts';
import type { AppSettings, OpenAiProviderProfile } from '../settings/schema.ts';
import type { ExtensionLocalStorage } from '../../shared/browser/local-storage.ts';

import { ProviderRegistry } from './provider-registry.ts';
import { ProviderService } from './provider-service.ts';
import type { AIProvider, ProviderTransformRequest } from './types.ts';

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
}

function createOpenAiProfile(id: string, selectedModelId: string): OpenAiProviderProfile {
  return {
    id,
    name: `${id} profile`,
    kind: 'openai',
    selectedModelId,
    timeoutMs: 25_000,
    temperature: null,
    maxOutputTokens: null,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-private-test-key'
  };
}

function createSettings(): AppSettings {
  const settings = createDefaultAppSettings();
  settings.providers = {
    activeProfileId: 'main',
    profiles: [createOpenAiProfile('main', 'gpt-main'), createOpenAiProfile('backup', 'gpt-backup')]
  };
  return settings;
}

function createOpenAiProvider(overrides: Partial<AIProvider<'openai'>> = {}): AIProvider<'openai'> {
  return {
    kind: 'openai',
    name: 'OpenAI',
    capabilities: {
      connectionTest: true,
      customHeaders: false,
      manualModelId: true,
      maxOutputTokens: true,
      modelDiscovery: true,
      requestCancellation: true,
      temperature: true
    },
    async listModels() {
      return [{ id: 'gpt-main', label: 'GPT main' }];
    },
    async testConnection() {
      return { ok: true };
    },
    async transform(request) {
      return { operationId: request.operationId, text: 'Hello.' };
    },
    ...overrides
  };
}

function createService(provider: AIProvider<'openai'> = createOpenAiProvider()): {
  readonly service: ProviderService;
  readonly store: SettingsStore;
} {
  const store = new SettingsStore(new MemoryStorage());
  const registry = new ProviderRegistry([provider]);
  return { service: new ProviderService(store, registry), store };
}

async function seedSettings(store: SettingsStore): Promise<void> {
  await store.replace(createSettings());
}

describe('ProviderService', () => {
  it('builds the centralized request, sanitizes its result, and clears the operation', async () => {
    let capturedRequest: ProviderTransformRequest | undefined;
    let capturedProfile: OpenAiProviderProfile | undefined;
    const provider = createOpenAiProvider({
      async transform(request, profile) {
        capturedRequest = request;
        capturedProfile = profile;
        return { operationId: request.operationId, text: 'Translation: Hello, team.' };
      }
    });
    const { service, store } = createService(provider);
    await seedSettings(store);

    await expect(
      service.transform({
        operationId: 'operation-1',
        text: 'xin chao team',
        trigger: 'shortcut'
      })
    ).resolves.toEqual({ operationId: 'operation-1', text: 'Hello, team.' });

    expect(capturedProfile?.selectedModelId).toBe('gpt-main');
    expect(capturedRequest).toMatchObject({
      operationId: 'operation-1',
      text: 'xin chao team',
      trigger: 'shortcut'
    });
    expect(capturedRequest?.prompt).toContain('Rewrite Vietnamese as natural English.');
    expect(capturedRequest?.prompt).toContain('Text:\nxin chao team');
    expect(service.activeOperationCount).toBe(0);
  });

  it('persists a model choice only on its selected provider profile', async () => {
    const { service, store } = createService();
    await seedSettings(store);

    await service.setSelectedModel('main', ' gpt-main-v2 ');

    const settings = await store.get();
    expect(settings.providers.profiles).toMatchObject([
      { id: 'main', selectedModelId: 'gpt-main-v2' },
      { id: 'backup', selectedModelId: 'gpt-backup' }
    ]);
  });

  it('aborts a matching active operation and returns a safe cancellation error', async () => {
    let signal: AbortSignal | undefined;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const provider = createOpenAiProvider({
      transform(request, _profile, requestSignal) {
        signal = requestSignal;
        markStarted?.();
        return new Promise((_, reject) => {
          requestSignal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }).then(() => ({ operationId: request.operationId, text: 'never' }));
      }
    });
    const { service, store } = createService(provider);
    await seedSettings(store);

    const result = service.transform({
      operationId: 'operation-1',
      text: 'xin chao',
      trigger: 'field-button'
    });
    await started;

    expect(service.cancel('operation-1')).toBe(true);
    expect(signal?.aborted).toBe(true);
    await expect(result).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(service.cancel('operation-1')).toBe(false);
    expect(service.activeOperationCount).toBe(0);
  });

  it('normalizes discovery and connection failures without retaining provider diagnostics', async () => {
    const provider = createOpenAiProvider({
      async listModels() {
        throw new Error('apiKey=sk-private-test-key');
      },
      async testConnection() {
        throw new Error('Authorization: Bearer sk-private-test-key');
      }
    });
    const { service, store } = createService(provider);
    await seedSettings(store);

    await expect(service.listModels('main')).rejects.toMatchObject({ code: 'UNKNOWN' });
    await expect(service.testConnection('main')).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN' }
    });
  });
});
