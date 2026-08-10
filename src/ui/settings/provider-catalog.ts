import type { ProviderKind, ProviderProfile } from '../../core/settings/schema.ts';

import { createProviderProfile } from './settings-utils.ts';

/** The provider choices shown before the detailed profile editor. */
export const PROVIDER_CATALOG_GROUPS = [
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
] as const;

export type ProviderCatalogGroupId = (typeof PROVIDER_CATALOG_GROUPS)[number]['id'];

interface ProviderCatalogEntryBase {
  readonly description: string;
  readonly group: ProviderCatalogGroupId;
  readonly id: string;
  /** The friendly name saved on the new provider profile. */
  readonly name: string;
}

export interface OpenAiCompatibleCatalogEntry extends ProviderCatalogEntryBase {
  readonly baseUrl: string;
  readonly kind: 'openai-compatible';
}

export interface BuiltInProviderCatalogEntry extends ProviderCatalogEntryBase {
  readonly kind: Exclude<ProviderKind, 'openai-compatible'>;
}

/**
 * A UI-only directory of setup choices. Compatible vendors deliberately share
 * the proven adapter rather than adding an adapter, permission, or provider kind.
 */
export type ProviderCatalogEntry = OpenAiCompatibleCatalogEntry | BuiltInProviderCatalogEntry;

export const PROVIDER_CATALOG = Object.freeze([
  {
    id: 'openrouter',
    group: 'quick-start',
    name: 'OpenRouter',
    description: 'Access a broad choice of models through one compatible API.',
    kind: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1'
  },
  {
    id: 'groq',
    group: 'quick-start',
    name: 'Groq',
    description: 'Use fast hosted open models through Groq’s compatible API.',
    kind: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1'
  },
  {
    id: 'deepseek',
    group: 'quick-start',
    name: 'DeepSeek',
    description: 'Use DeepSeek models through its compatible API.',
    kind: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1'
  },
  {
    id: 'mistral',
    group: 'quick-start',
    name: 'Mistral',
    description: 'Use Mistral models through its compatible API.',
    kind: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1'
  },
  {
    id: 'together',
    group: 'quick-start',
    name: 'Together AI',
    description: 'Use hosted open models through Together AI’s compatible API.',
    kind: 'openai-compatible',
    baseUrl: 'https://api.together.xyz/v1'
  },
  {
    id: 'fireworks',
    group: 'quick-start',
    name: 'Fireworks',
    description: 'Use hosted models through Fireworks’ compatible inference API.',
    kind: 'openai-compatible',
    baseUrl: 'https://api.fireworks.ai/inference/v1'
  },
  {
    id: 'perplexity',
    group: 'quick-start',
    name: 'Perplexity',
    description: 'Use Perplexity models through its compatible API.',
    kind: 'openai-compatible',
    baseUrl: 'https://api.perplexity.ai'
  },
  {
    id: 'xai',
    group: 'quick-start',
    name: 'xAI',
    description: 'Use Grok models through xAI’s compatible API.',
    kind: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1'
  },
  {
    id: 'openai',
    group: 'core',
    name: 'OpenAI',
    description: 'Use OpenAI’s direct API.',
    kind: 'openai'
  },
  {
    id: 'anthropic',
    group: 'core',
    name: 'Anthropic',
    description: 'Use Claude models through Anthropic’s direct API.',
    kind: 'anthropic'
  },
  {
    id: 'gemini',
    group: 'core',
    name: 'Google Gemini',
    description: 'Use Gemini models through Google’s direct API.',
    kind: 'gemini'
  },
  {
    id: 'ollama',
    group: 'core',
    name: 'Ollama',
    description: 'Use models running on your own machine.',
    kind: 'ollama'
  },
  {
    id: 'openai-compatible',
    group: 'advanced',
    name: 'OpenAI-compatible API',
    description: 'Enter the API root for another compatible provider.',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1'
  },
  {
    id: 'custom-json',
    group: 'advanced',
    name: 'Custom JSON API',
    description: 'Configure a custom HTTP request and response format.',
    kind: 'custom-json'
  }
] as const satisfies readonly ProviderCatalogEntry[]);

export type ProviderCatalogEntryId = (typeof PROVIDER_CATALOG)[number]['id'];

/** Returns a safe lookup result for a value read from a native select control. */
export function findProviderCatalogEntry(id: string): ProviderCatalogEntry | null {
  return PROVIDER_CATALOG.find((entry) => entry.id === id) ?? null;
}

/** Returns a fresh profile, so unsaved setup choices never share mutable state. */
export function createProviderProfileFromCatalog(
  entry: ProviderCatalogEntry,
  profileId: string
): ProviderProfile {
  if (entry.kind === 'openai-compatible') {
    const profile = createProviderProfile('openai-compatible', profileId);
    if (profile.kind !== 'openai-compatible') {
      throw new Error('Expected the compatible provider profile factory result.');
    }
    return {
      ...profile,
      name: entry.name,
      baseUrl: entry.baseUrl,
      apiKey: '',
      headers: [],
      selectedModelId: ''
    };
  }

  return { ...createProviderProfile(entry.kind, profileId), name: entry.name };
}
