import { HttpClient } from './http-client.ts';
import { AnthropicProvider } from './anthropic-adapter.ts';
import { GeminiProvider } from './gemini-adapter.ts';
import { OllamaProvider } from './ollama-adapter.ts';
import { OpenAiCompatibleProvider } from './openai-compatible-adapter.ts';
import { OpenAiProvider } from './openai-adapter.ts';
import { ProviderRegistry } from './provider-registry.ts';

import type { AnyAIProvider } from './types.ts';

/** Creates the Phase 4 adapters with one injectable HTTP boundary. */
export function createDefaultProviders(
  httpClient: HttpClient = new HttpClient()
): readonly AnyAIProvider[] {
  return [
    new OpenAiProvider(httpClient),
    new OpenAiCompatibleProvider(httpClient),
    new AnthropicProvider(httpClient),
    new GeminiProvider(httpClient),
    new OllamaProvider(httpClient)
  ];
}

/** Factory used by the background service worker to build its provider registry. */
export function createDefaultProviderRegistry(
  httpClient: HttpClient = new HttpClient()
): ProviderRegistry {
  return new ProviderRegistry(createDefaultProviders(httpClient));
}
