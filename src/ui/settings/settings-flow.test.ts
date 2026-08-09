import { describe, expect, it } from 'vitest';

import { SettingsStore } from '../../core/settings/settings-store.ts';
import {
  SETTINGS_STORAGE_KEY,
  type ExtensionLocalStorage
} from '../../shared/browser/local-storage.ts';

import { createProviderProfile, updateSelectedModel } from './settings-utils.ts';

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

  seed(value: unknown): void {
    this.values.set(SETTINGS_STORAGE_KEY, structuredClone(value));
  }
}

describe('settings UI persistence flow', () => {
  it('restores independent model selections after switching providers and reloading storage', async () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    const openAi = createProviderProfile('openai', 'openai-main');
    const ollama = createProviderProfile('ollama', 'ollama-local');

    await store.update((current) => ({
      ...current,
      providers: { activeProfileId: openAi.id, profiles: [openAi, ollama] }
    }));
    await store.update((current) => updateSelectedModel(current, openAi.id, 'gpt-test'));
    await store.update((current) => ({
      ...current,
      providers: { ...current.providers, activeProfileId: ollama.id }
    }));
    await store.update((current) => updateSelectedModel(current, ollama.id, 'llama3'));

    const reloaded = new SettingsStore(storage);
    const restored = await reloaded.get();

    expect(restored.providers.activeProfileId).toBe('ollama-local');
    expect(restored.providers.profiles).toMatchObject([
      { id: 'openai-main', selectedModelId: 'gpt-test' },
      { id: 'ollama-local', selectedModelId: 'llama3' }
    ]);
  });

  it('recovers a valid default settings value before first UI interaction', async () => {
    const storage = new MemoryStorage();
    storage.seed(undefined);

    const settings = await new SettingsStore(storage).get();

    expect(settings.language).toEqual({ source: 'vi', target: 'en' });
    expect(settings.behavior.afterTransform).toBe('replace');
  });
});
