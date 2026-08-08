import { describe, expect, it } from 'vitest';

import { AppError, getAppErrorUserMessage } from '../../shared/errors/index.ts';
import type { OpenAiProviderProfile } from '../settings/schema.ts';

import {
  createConnectionTestFailure,
  type AIProvider,
  type ProviderTransformRequest
} from './types.ts';

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

const transformRequest: ProviderTransformRequest = {
  language: { source: 'vi', target: 'en' },
  maxOutputTokens: 128,
  operationId: 'operation-1',
  prompt: 'Rewrite Vietnamese as natural English.\n\nText:\nXin chao',
  style: {
    id: 'natural',
    instruction: 'Use natural phrasing.',
    kind: 'built-in',
    name: 'Natural'
  },
  text: 'Xin chao',
  trigger: 'shortcut'
};

const provider: AIProvider<'openai'> = {
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
  async listModels(profile) {
    expect(profile).toBe(openAiProfile);
    return [{ id: 'gpt-5-mini', label: 'GPT-5 mini' }];
  },
  async testConnection(profile) {
    expect(profile).toBe(openAiProfile);
    return { ok: true };
  },
  async transform(request, profile) {
    expect(request).toBe(transformRequest);
    expect(profile).toBe(openAiProfile);
    return { operationId: request.operationId, text: 'Hello' };
  }
};

describe('provider contracts', () => {
  it('keeps Phase 3 prompt and operation metadata available to a typed adapter', async () => {
    const models = await provider.listModels(openAiProfile);
    const connection = await provider.testConnection(openAiProfile);
    const result = await provider.transform(transformRequest, openAiProfile);

    expect(models).toEqual([{ id: 'gpt-5-mini', label: 'GPT-5 mini' }]);
    expect(connection).toEqual({ ok: true });
    expect(result).toEqual({ operationId: 'operation-1', text: 'Hello' });
  });

  it('serializes connection failures without exposing provider diagnostics or credentials', () => {
    const failure = createConnectionTestFailure(
      new AppError('AUTHENTICATION', 'Authorization: Bearer sk-test-secret', {
        details: { apiKey: 'sk-test-secret', providerBody: 'invalid credential' }
      })
    );

    expect(failure).toEqual({
      ok: false,
      error: {
        code: 'AUTHENTICATION',
        message: getAppErrorUserMessage('AUTHENTICATION'),
        retryable: false
      }
    });
    expect(JSON.stringify(failure)).not.toContain('sk-test-secret');
    expect(JSON.stringify(failure)).not.toContain('invalid credential');
  });

  it('normalizes unknown connection failures instead of preserving raw error text', () => {
    const failure = createConnectionTestFailure(new Error('apiKey=sk-test-secret'));

    expect(failure).toEqual({
      ok: false,
      error: {
        code: 'UNKNOWN',
        message: getAppErrorUserMessage('UNKNOWN'),
        retryable: true
      }
    });
    expect(JSON.stringify(failure)).not.toContain('sk-test-secret');
  });
});
