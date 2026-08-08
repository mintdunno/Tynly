import { describe, expect, it } from 'vitest';

import { AppError, getAppErrorUserMessage } from '../../shared/errors/index.ts';
import type { OpenAiProviderProfile } from '../settings/schema.ts';
import type { AIProvider } from './types.ts';

import { ProviderRegistry } from './provider-registry.ts';

function createProvider<K extends AIProvider['kind']>(kind: K): AIProvider<K> {
  return {
    kind,
    name: `${kind} provider`,
    capabilities: {
      connectionTest: true,
      customHeaders: kind === 'openai-compatible' || kind === 'ollama',
      manualModelId: true,
      maxOutputTokens: true,
      modelDiscovery: true,
      requestCancellation: true,
      temperature: true
    },
    async listModels() {
      return [{ id: `${kind}-model`, label: `${kind} model` }];
    },
    async testConnection() {
      return { ok: true };
    },
    async transform(request) {
      return { operationId: request.operationId, text: 'transformed text' };
    }
  };
}

const openAiProfile: OpenAiProviderProfile = {
  id: 'openai-main',
  name: 'OpenAI main',
  kind: 'openai',
  selectedModelId: 'gpt-5-mini',
  timeoutMs: 30_000,
  temperature: null,
  maxOutputTokens: null,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test-secret'
};

describe('ProviderRegistry', () => {
  it('resolves the registered adapter by settings provider kind', () => {
    const openAi = createProvider('openai');
    const ollama = createProvider('ollama');
    const registry = new ProviderRegistry([openAi, ollama]);

    expect(registry.size).toBe(2);
    expect(registry.resolve('openai')).toBe(openAi);
    expect(registry.resolve('ollama')).toBe(ollama);
    expect(registry.resolveProfile(openAiProfile)).toBe(openAi);
  });

  it('rejects duplicate provider kinds with a fixed configuration error', () => {
    expect(
      () => new ProviderRegistry([createProvider('openai'), createProvider('openai')])
    ).toThrow(AppError);

    try {
      new ProviderRegistry([createProvider('openai'), createProvider('openai')]);
    } catch (error) {
      expect(error).toMatchObject({
        code: 'CONFIGURATION',
        message: getAppErrorUserMessage('CONFIGURATION')
      });
      expect(JSON.stringify(error)).not.toContain('provider');
    }
  });

  it('rejects an unavailable provider kind without exposing lookup details', () => {
    const registry = new ProviderRegistry([createProvider('openai')]);

    expect(() => registry.resolve('ollama')).toThrow(AppError);

    try {
      registry.resolve('ollama');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'CONFIGURATION',
        message: getAppErrorUserMessage('CONFIGURATION')
      });
      expect(JSON.stringify(error)).not.toContain('ollama');
    }
  });

  it('rejects invalid runtime adapter metadata with the same safe error shape', () => {
    const invalidProvider = {
      get kind() {
        throw new Error('apiKey=sk-test-secret');
      }
    } as unknown as AIProvider;

    expect(() => new ProviderRegistry([invalidProvider])).toThrow(AppError);

    try {
      new ProviderRegistry([invalidProvider]);
    } catch (error) {
      expect(error).toMatchObject({
        code: 'CONFIGURATION',
        message: getAppErrorUserMessage('CONFIGURATION')
      });
      expect(JSON.stringify(error)).not.toContain('sk-test-secret');
    }
  });
});
