import { describe, expect, it } from 'vitest';

import { createDefaultAppSettings } from './defaults.ts';
import {
  isAppSettings,
  isContentSettingsSnapshot,
  isHttpUrl,
  isOllamaUrl,
  isProviderProfile,
  toContentSettingsSnapshot,
  validateAppSettings
} from './schema.ts';

describe('settings schema', () => {
  it('accepts a complete private provider profile and redacts it for content', () => {
    const settings = createDefaultAppSettings();
    const secret = 'never-send-this-to-content';
    const privateStyleInstruction = 'Use apiKey=also-never-send-this-to-content.';
    settings.styles = {
      selected: { kind: 'custom', id: 'brief' },
      custom: [{ id: 'brief', name: 'Brief', instruction: privateStyleInstruction }]
    };
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
    expect(snapshot.styles).toEqual({
      selected: { kind: 'custom', id: 'brief' },
      custom: [{ id: 'brief', name: 'Brief' }]
    });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain('also-private');
    expect(serialized).not.toContain('gateway.example.test');
    expect(serialized).not.toContain('headers');
    expect(serialized).not.toContain(privateStyleInstruction);
    expect(serialized).not.toContain('instruction');
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

  it('rejects injected private fields and never projects them to content', () => {
    const settings = createDefaultAppSettings();
    settings.styles = {
      selected: { kind: 'custom', id: 'brief' },
      custom: [{ id: 'brief', name: 'Brief', instruction: 'apiKey=style-secret' }]
    };
    const mutableSettings = settings as unknown as {
      language: Record<string, unknown>;
      behavior: Record<string, unknown>;
      controls: { fieldButton: Record<string, unknown> };
      styles: { custom: Record<string, unknown>[] };
    };

    mutableSettings.language.apiKey = 'language-secret';
    mutableSettings.behavior.endpoint = 'https://private.example.test';
    mutableSettings.controls.fieldButton.headers = 'header-secret';
    mutableSettings.styles.custom[0]!.extra = 'custom-style-secret';

    expect(isAppSettings(settings)).toBe(false);
    expect(validateAppSettings(settings)).toMatchObject({ ok: false });

    const snapshot = toContentSettingsSnapshot(settings);
    const serialized = JSON.stringify(snapshot);
    expect(isContentSettingsSnapshot(snapshot)).toBe(true);
    expect(serialized).not.toContain('language-secret');
    expect(serialized).not.toContain('private.example.test');
    expect(serialized).not.toContain('header-secret');
    expect(serialized).not.toContain('custom-style-secret');
    expect(serialized).not.toContain('style-secret');
    expect(Object.keys(snapshot.language)).toEqual(['source', 'target']);
    expect(Object.keys(snapshot.controls.fieldButton)).toEqual([
      'enabled',
      'position',
      'appearance',
      'clickBehavior'
    ]);
  });

  it('requires safe provider URLs and permits local Ollama HTTP only', () => {
    expect(isHttpUrl('https://provider.example/v1')).toBe(true);
    expect(isHttpUrl('http://provider.example/v1')).toBe(false);
    expect(isHttpUrl('https://user:password@provider.example/v1')).toBe(false);
    expect(isHttpUrl('https://provider.example/v1?api_key=secret')).toBe(false);
    expect(isHttpUrl('https://provider.example/v1#fragment')).toBe(false);
    expect(isOllamaUrl('http://localhost:11434')).toBe(true);
    expect(isOllamaUrl('http://127.0.0.1:11434')).toBe(true);
    expect(isOllamaUrl('http://provider.example:11434')).toBe(false);

    const openAiProfile = {
      id: 'openai',
      name: 'OpenAI',
      kind: 'openai',
      selectedModelId: 'gpt-test',
      timeoutMs: 30_000,
      temperature: null,
      maxOutputTokens: null,
      baseUrl: 'http://provider.example/v1',
      apiKey: 'private'
    };
    const ollamaProfile = {
      id: 'ollama',
      name: 'Local Ollama',
      kind: 'ollama',
      selectedModelId: 'llama3',
      timeoutMs: 30_000,
      temperature: null,
      maxOutputTokens: null,
      baseUrl: 'http://localhost:11434',
      headers: []
    };

    expect(isProviderProfile(openAiProfile)).toBe(false);
    expect(isProviderProfile(ollamaProfile)).toBe(true);
    expect(isProviderProfile({ ...ollamaProfile, baseUrl: 'http://provider.example:11434' })).toBe(
      false
    );
  });

  it('validates custom JSON templates, response paths, and authentication headers', () => {
    const customProfile = {
      id: 'custom',
      name: 'Custom API',
      kind: 'custom-json' as const,
      selectedModelId: 'custom-model',
      timeoutMs: 30_000,
      temperature: null,
      maxOutputTokens: null,
      endpoint: 'https://custom.example.test/transform',
      method: 'POST' as const,
      authentication: { kind: 'header' as const, headerName: 'X-API-Key', value: 'private' },
      headers: [{ name: 'X-Tenant', value: 'team-a' }],
      modelsEndpoint: null,
      requestTemplate: JSON.stringify({ model: '{{model}}', prompt: '{{prompt}}' }),
      responseTextPath: 'choices.0.message.content'
    };

    expect(isProviderProfile(customProfile)).toBe(true);
    expect(
      isProviderProfile({
        ...customProfile,
        requestTemplate: JSON.stringify({ prompt: '{{unknown}}' })
      })
    ).toBe(false);
    expect(isProviderProfile({ ...customProfile, responseTextPath: 'constructor.value' })).toBe(
      false
    );
    expect(
      isProviderProfile({
        ...customProfile,
        authentication: { kind: 'header', headerName: 'Content-Type', value: 'private' }
      })
    ).toBe(false);
    expect(
      isProviderProfile({
        ...customProfile,
        headers: [{ name: 'authorization', value: 'Bearer spoofed' }]
      })
    ).toBe(false);
    expect(
      isProviderProfile({
        ...customProfile,
        headers: [{ name: 'x-api-key', value: 'ambiguous' }]
      })
    ).toBe(false);
    expect(
      isProviderProfile({
        ...customProfile,
        headers: [{ name: '__proto__', value: 'unsafe' }]
      })
    ).toBe(false);
  });
});
