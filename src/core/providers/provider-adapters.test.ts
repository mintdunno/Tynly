import { describe, expect, it, vi } from 'vitest';

import type {
  OllamaProviderProfile,
  OpenAiCompatibleProviderProfile,
  OpenAiProviderProfile
} from '../settings/schema.ts';

import { HttpClient, type HttpFetch } from './http-client.ts';
import { OllamaProvider } from './ollama-adapter.ts';
import { OpenAiCompatibleProvider } from './openai-compatible-adapter.ts';
import { OpenAiProvider } from './openai-adapter.ts';
import type { ProviderTransformRequest } from './types.ts';

const transformRequest: ProviderTransformRequest = {
  language: { source: 'vi', target: 'en' },
  maxOutputTokens: 300,
  operationId: 'operation-1',
  prompt: 'Rewrite Vietnamese as natural English.\nText:\nxin chao',
  style: {
    id: 'natural',
    instruction: 'natural and idiomatic',
    kind: 'built-in',
    name: 'Natural'
  },
  text: 'xin chao',
  trigger: 'shortcut'
};

const openAiProfile: OpenAiProviderProfile = {
  id: 'openai-main',
  name: 'OpenAI main',
  kind: 'openai',
  selectedModelId: 'gpt-test',
  timeoutMs: 30_000,
  temperature: 0,
  maxOutputTokens: 128,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test-secret'
};

const compatibleProfile: OpenAiCompatibleProviderProfile = {
  id: 'gateway',
  name: 'Gateway',
  kind: 'openai-compatible',
  selectedModelId: 'gateway-model',
  timeoutMs: 30_000,
  temperature: null,
  maxOutputTokens: null,
  baseUrl: 'https://gateway.example/v1/',
  apiKey: 'gateway-secret',
  headers: [{ name: 'X-Tenant', value: 'team-a' }]
};

const ollamaProfile: OllamaProviderProfile = {
  id: 'ollama-local',
  name: 'Local Ollama',
  kind: 'ollama',
  selectedModelId: 'llama3',
  timeoutMs: 30_000,
  temperature: null,
  maxOutputTokens: null,
  baseUrl: 'http://localhost:11434/',
  headers: [{ name: 'Authorization', value: 'Bearer local-token' }]
};

function responseBody(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status
  });
}

function createFetch(response: Response): ReturnType<typeof vi.fn<HttpFetch>> {
  return vi.fn<HttpFetch>().mockResolvedValue(response);
}

function requestBody(fetch: ReturnType<typeof vi.fn<HttpFetch>>): Record<string, unknown> {
  const body = fetch.mock.calls[0]?.[1]?.body;
  expect(typeof body).toBe('string');
  return JSON.parse(body as string) as Record<string, unknown>;
}

describe('provider adapters', () => {
  it('sends one compact OpenAI request with the configured output cap and temperature zero', async () => {
    const fetch = createFetch(responseBody({ choices: [{ message: { content: 'Xin chào.' } }] }));
    const adapter = new OpenAiProvider(new HttpClient({ fetch }));

    await expect(adapter.transform(transformRequest, openAiProfile)).resolves.toEqual({
      operationId: 'operation-1',
      text: 'Xin chào.'
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
    const body = requestBody(fetch);
    expect(body).toEqual({
      max_completion_tokens: 128,
      messages: [{ content: transformRequest.prompt, role: 'user' }],
      model: 'gpt-test',
      stream: false,
      temperature: 0
    });
    expect(body).not.toHaveProperty('text');
  });

  it('uses the selected model and a tiny prompt for OpenAI connection tests', async () => {
    const fetch = createFetch(responseBody({ choices: [{ message: { content: 'OK' } }] }));
    const adapter = new OpenAiProvider(new HttpClient({ fetch }));

    await expect(adapter.testConnection(openAiProfile)).resolves.toEqual({ ok: true });
    expect(requestBody(fetch)).toMatchObject({
      max_completion_tokens: 1,
      messages: [{ content: 'Reply with OK.', role: 'user' }],
      model: 'gpt-test',
      stream: false
    });
  });

  it('discovers OpenAI models with bounded deterministic deduplication', async () => {
    const fetch = createFetch(
      responseBody({
        data: [
          { id: 'gpt-test' },
          { id: 'gpt-test' },
          { id: '   ' },
          { id: 'gateway-model' },
          { id: 'model\nwith-break' }
        ]
      })
    );
    const adapter = new OpenAiProvider(new HttpClient({ fetch }));

    await expect(adapter.listModels(openAiProfile)).resolves.toEqual([
      { id: 'gpt-test', label: 'gpt-test' },
      { id: 'gateway-model', label: 'gateway-model' }
    ]);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('keeps gateway headers while mandatory authentication and content headers win', async () => {
    const fetch = createFetch(responseBody({ choices: [{ message: { content: 'Done.' } }] }));
    const adapter = new OpenAiCompatibleProvider(new HttpClient({ fetch }));

    await adapter.transform(transformRequest, compatibleProfile);

    const init = fetch.mock.calls[0]?.[1];
    expect(init?.headers).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer gateway-secret',
      'Content-Type': 'application/json',
      'X-Tenant': 'team-a'
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://gateway.example/v1/chat/completions',
      expect.any(Object)
    );
    expect(requestBody(fetch)).toMatchObject({ stream: false, model: 'gateway-model' });
  });

  it('returns an empty discovery list when a compatible gateway has no models endpoint', async () => {
    const fetch = createFetch(responseBody({ error: 'not supported' }, 404));
    const adapter = new OpenAiCompatibleProvider(new HttpClient({ fetch }));

    await expect(adapter.listModels(compatibleProfile)).resolves.toEqual([]);
  });

  it('rejects custom authentication overrides on OpenAI-compatible profiles', async () => {
    const fetch = createFetch(
      responseBody({ choices: [{ message: { content: 'Should not run.' } }] })
    );
    const adapter = new OpenAiCompatibleProvider(new HttpClient({ fetch }));
    const unsafeProfile = {
      ...compatibleProfile,
      headers: [...compatibleProfile.headers, { name: 'authorization', value: 'Bearer spoofed' }]
    };

    await expect(adapter.transform(transformRequest, unsafeProfile)).rejects.toMatchObject({
      code: 'CONFIGURATION'
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends Ollama chat requests with local custom authorization and options', async () => {
    const fetch = createFetch(responseBody({ message: { content: 'Xin chào.' } }));
    const adapter = new OllamaProvider(new HttpClient({ fetch }));

    await expect(adapter.transform(transformRequest, ollamaProfile)).resolves.toEqual({
      operationId: 'operation-1',
      text: 'Xin chào.'
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetch.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer local-token',
      'Content-Type': 'application/json'
    });
    expect(requestBody(fetch)).toEqual({
      messages: [{ content: transformRequest.prompt, role: 'user' }],
      model: 'llama3',
      options: { num_predict: 300 },
      stream: false
    });
  });

  it('discovers Ollama models and rejects malformed successful responses', async () => {
    const fetch = createFetch(
      responseBody({ models: [{ name: 'llama3' }, { model: 'llama3' }, { name: 'mistral' }] })
    );
    const adapter = new OllamaProvider(new HttpClient({ fetch }));

    await expect(adapter.listModels(ollamaProfile)).resolves.toEqual([
      { id: 'llama3', label: 'llama3' },
      { id: 'mistral', label: 'mistral' }
    ]);

    const malformedFetch = createFetch(responseBody({ models: [{ name: 7 }] }));
    const malformedAdapter = new OllamaProvider(new HttpClient({ fetch: malformedFetch }));
    await expect(malformedAdapter.listModels(ollamaProfile)).resolves.toEqual([]);
  });

  it('rejects non-text provider output without applying it', async () => {
    const fetch = createFetch(responseBody({ choices: [{ message: { content: 7 } }] }));
    const adapter = new OpenAiProvider(new HttpClient({ fetch }));

    await expect(adapter.transform(transformRequest, openAiProfile)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE'
    });
  });
});
