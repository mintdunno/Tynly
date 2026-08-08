import { describe, expect, it } from 'vitest';

import type { ExtensionLocalStorage } from '../../shared/browser/local-storage.ts';
import { SETTINGS_STORAGE_KEY } from '../../shared/browser/local-storage.ts';
import { createDefaultAppSettings } from './defaults.ts';
import { SettingsStore } from './settings-store.ts';

class MemoryStorage implements ExtensionLocalStorage {
  readonly values = new Map<string, unknown>();
  restricted = false;

  async get(key: string): Promise<unknown> {
    return this.values.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, structuredClone(value));
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }

  async restrictToTrustedContexts(): Promise<void> {
    this.restricted = true;
  }
}

describe('SettingsStore', () => {
  it('initializes local storage with safe defaults in trusted contexts', async () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);

    await expect(store.initialize()).resolves.toMatchObject({
      version: 1,
      language: { source: 'vi', target: 'en' }
    });

    expect(storage.restricted).toBe(true);
    expect(storage.values.get(SETTINGS_STORAGE_KEY)).toMatchObject({
      version: 1
    });
  });

  it('returns a redacted content settings snapshot', async () => {
    const storage = new MemoryStorage();
    const settings = createDefaultAppSettings();
    settings.providers.activeProfileId = 'openai-main';
    settings.providers.profiles.push({
      id: 'openai-main',
      name: 'Work OpenAI',
      kind: 'openai',
      baseUrl: 'https://api.openai.com',
      apiKey: 'sk-secret-should-never-reach-content',
      selectedModelId: 'gpt-test',
      timeoutMs: 25_000,
      temperature: null,
      maxOutputTokens: null
    });
    await storage.set(SETTINGS_STORAGE_KEY, settings);

    const snapshot = await new SettingsStore(storage).getContentSettings();
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.activeProvider).toEqual({
      id: 'openai-main',
      name: 'Work OpenAI',
      kind: 'openai',
      selectedModelId: 'gpt-test',
      configured: true
    });
    expect(serialized).not.toContain('sk-secret-should-never-reach-content');
    expect(serialized).not.toContain('api.openai.com');
  });

  it('rejects invalid settings before writing them', async () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    const invalid = createDefaultAppSettings();
    invalid.language.target = 'auto' as never;

    await expect(store.replace(invalid)).rejects.toMatchObject({
      code: 'CONFIGURATION'
    });
    expect(storage.values.has(SETTINGS_STORAGE_KEY)).toBe(false);
  });
});
