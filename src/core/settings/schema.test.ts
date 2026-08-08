import { describe, expect, it } from 'vitest';

import { createDefaultAppSettings } from './defaults.ts';
import {
  isAppSettings,
  isContentSettingsSnapshot,
  isProviderProfile,
  toContentSettingsSnapshot,
  validateAppSettings
} from './schema.ts';

describe('settings schema', () => {
  it('accepts a complete private provider profile and redacts it for content', () => {
    const settings = createDefaultAppSettings();
    const secret = 'never-send-this-to-content';
    settings.providers = {
      activeProfileId: 'work-gateway',
      profiles: [
        {
          id: 'work-gateway',
          name: 'Work Gateway',
          kind: 'openai-compatible',
          selectedModelId: 'gpt-4.1-mini',
          timeoutMs: 30_000,
          temperature: null,
          maxOutputTokens: 1_024,
          baseUrl: 'https://gateway.example.test/v1',
          apiKey: secret,
          headers: [{ name: 'X-Workspace-Token', value: 'also-private' }]
        }
      ]
    };

    expect(isAppSettings(settings)).toBe(true);
    expect(isProviderProfile(settings.providers.profiles[0])).toBe(true);

    const snapshot = toContentSettingsSnapshot(settings);
    expect(snapshot.activeProvider).toEqual({
      id: 'work-gateway',
      name: 'Work Gateway',
      kind: 'openai-compatible',
      selectedModelId: 'gpt-4.1-mini',
      configured: true
    });
    expect(isContentSettingsSnapshot(snapshot)).toBe(true);

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain('also-private');
    expect(serialized).not.toContain('gateway.example.test');
    expect(serialized).not.toContain('headers');
  });

  it('marks an incomplete profile as not configured without exposing why', () => {
    const settings = createDefaultAppSettings();
    settings.providers = {
      activeProfileId: 'openai',
      profiles: [
        {
          id: 'openai',
          name: 'OpenAI',
          kind: 'openai',
          selectedModelId: '',
          timeoutMs: 30_000,
          temperature: null,
          maxOutputTokens: null,
          baseUrl: 'https://api.openai.com/v1',
          apiKey: ''
        }
      ]
    };

    expect(toContentSettingsSnapshot(settings).activeProvider?.configured).toBe(false);
  });

  it('rejects invalid Auto targets and dangling active profile IDs', () => {
    const invalid: unknown = {
      ...createDefaultAppSettings(),
      language: { source: 'vi', target: 'auto' },
      providers: { activeProfileId: 'missing', profiles: [] }
    };

    expect(isAppSettings(invalid)).toBe(false);
    expect(validateAppSettings(invalid)).toMatchObject({ ok: false });
  });
});
