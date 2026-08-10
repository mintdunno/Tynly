import { describe, expect, it } from 'vitest';

import { isProviderProfile } from '../../core/settings/schema.ts';

import {
  PROVIDER_CATALOG,
  PROVIDER_CATALOG_GROUPS,
  createProviderProfileFromCatalog,
  findProviderCatalogEntry
} from './provider-catalog.ts';

const compatiblePresets = [
  ['openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1'],
  ['groq', 'Groq', 'https://api.groq.com/openai/v1'],
  ['deepseek', 'DeepSeek', 'https://api.deepseek.com/v1'],
  ['mistral', 'Mistral', 'https://api.mistral.ai/v1'],
  ['together', 'Together AI', 'https://api.together.xyz/v1'],
  ['fireworks', 'Fireworks', 'https://api.fireworks.ai/inference/v1'],
  ['perplexity', 'Perplexity', 'https://api.perplexity.ai'],
  ['xai', 'xAI', 'https://api.x.ai/v1']
] as const;

describe('provider catalog', () => {
  it('offers the complete grouped quick-start, built-in, and advanced setup flow', () => {
    expect(PROVIDER_CATALOG_GROUPS).toEqual([
      {
        id: 'quick-start',
        name: 'Quick start',
        description: 'Choose a popular compatible API, then add your key and model.'
      },
      {
        id: 'core',
        name: 'Built-in providers',
        description: 'Use a provider with its dedicated Tynly integration.'
      },
      {
        id: 'advanced',
        name: 'Advanced setup',
        description: 'Configure a compatible or custom HTTP API yourself.'
      }
    ]);
    expect(PROVIDER_CATALOG.map((entry) => [entry.group, entry.id])).toEqual([
      ['quick-start', 'openrouter'],
      ['quick-start', 'groq'],
      ['quick-start', 'deepseek'],
      ['quick-start', 'mistral'],
      ['quick-start', 'together'],
      ['quick-start', 'fireworks'],
      ['quick-start', 'perplexity'],
      ['quick-start', 'xai'],
      ['core', 'openai'],
      ['core', 'anthropic'],
      ['core', 'gemini'],
      ['core', 'ollama'],
      ['advanced', 'openai-compatible'],
      ['advanced', 'custom-json']
    ]);
    expect(new Set(PROVIDER_CATALOG.map((entry) => entry.id)).size).toBe(PROVIDER_CATALOG.length);
  });

  it('looks up catalog choices safely for native-control values', () => {
    expect(findProviderCatalogEntry('groq')).toMatchObject({
      id: 'groq',
      kind: 'openai-compatible',
      name: 'Groq'
    });
    expect(findProviderCatalogEntry('')).toBeNull();
    expect(findProviderCatalogEntry('not-a-provider')).toBeNull();
  });

  it.each(compatiblePresets)(
    'creates the $1 preset as a blank, valid compatible profile',
    (id, name, baseUrl) => {
      const entry = findProviderCatalogEntry(id);
      if (entry?.kind !== 'openai-compatible') {
        throw new Error(`${id} must be an OpenAI-compatible catalog choice.`);
      }

      expect(entry.baseUrl).toBe(baseUrl);
      expect(new URL(baseUrl).protocol).toBe('https:');

      const profile = createProviderProfileFromCatalog(entry, 'preset-profile');

      expect(profile).toEqual({
        id: 'preset-profile',
        name,
        kind: 'openai-compatible',
        baseUrl,
        apiKey: '',
        headers: [],
        selectedModelId: '',
        timeoutMs: 30_000,
        temperature: null,
        maxOutputTokens: null
      });
      expect(isProviderProfile(profile)).toBe(true);
    }
  );

  it('keeps the existing direct and advanced setup choices available', () => {
    const expectedKinds = {
      openai: 'openai',
      anthropic: 'anthropic',
      gemini: 'gemini',
      ollama: 'ollama',
      'openai-compatible': 'openai-compatible',
      'custom-json': 'custom-json'
    } as const;

    for (const [id, kind] of Object.entries(expectedKinds)) {
      const entry = findProviderCatalogEntry(id);
      if (entry === null) {
        throw new Error(`${id} must remain available in the provider catalog.`);
      }
      expect(entry.kind).toBe(kind);

      const profile = createProviderProfileFromCatalog(entry, 'profile-id');
      expect(profile).toMatchObject({
        id: 'profile-id',
        kind,
        name: entry.name,
        selectedModelId: ''
      });
      expect(isProviderProfile(profile)).toBe(true);
    }
  });

  it('returns distinct blank profile state for every newly selected compatible preset', () => {
    const entry = findProviderCatalogEntry('openrouter');
    if (entry?.kind !== 'openai-compatible') {
      throw new Error('OpenRouter must be an OpenAI-compatible catalog choice.');
    }

    const first = createProviderProfileFromCatalog(entry, 'first');
    const second = createProviderProfileFromCatalog(entry, 'second');
    if (first.kind !== 'openai-compatible' || second.kind !== 'openai-compatible') {
      throw new Error('Expected compatible profiles.');
    }

    first.headers.push({ name: 'X-Example', value: 'temporary-value' });

    expect(second).toMatchObject({
      id: 'second',
      apiKey: '',
      headers: [],
      selectedModelId: ''
    });
    expect(first.headers).not.toBe(second.headers);
  });
});
