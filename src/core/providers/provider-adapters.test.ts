import { describe, expect, it, vi } from 'vitest';

import type {
  AnthropicProviderProfile,
  CustomJsonProviderProfile,
  GeminiProviderProfile,
  OllamaProviderProfile,
  OpenAiCompatibleProviderProfile,
  OpenAiProviderProfile
} from '../settings/schema.ts';

import { AnthropicProvider } from './anthropic-adapter.ts';
import { CustomJsonProvider } from './custom-json-adapter.ts';
import { GeminiProvider } from './gemini-adapter.ts';
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

const anthropicProfile: AnthropicProviderProfile = {
  id: 'anthropic-main',
  name: 'Anthropic main',
  kind: 'anthropic',
  selectedModelId: 'claude-test',
  timeoutMs: 30_000,
  temperature: 0,
  maxOutputTokens: 128,
  baseUrl: 'https://api.anthropic.com/v1',
  apiKey: 'anthropic-secret'
};

const geminiProfile: GeminiProviderProfile = {
  id: 'gemini-main',
  name: 'Gemini main',
  kind: 'gemini',
  selectedModelId: 'models/gemini-2.5-flash',
  timeoutMs: 30_000,
  temperature: 0,
  maxOutputTokens: 128,
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  apiKey: 'gemini-secret'
};

const customJsonProfile: CustomJsonProviderProfile = {
  id: 'custom-main',
  name: 'Custom API',
  kind: 'custom-json',
  selectedModelId: 'custom-model',
  timeoutMs: 30_000,
  temperature: null,
  maxOutputTokens: null,
  endpoint: 'https://custom.example.test/v1/transform',
  method: 'POST',
  authentication: { kind: 'header', headerName: 'X-API-Key', value: 'custom-secret' },
  headers: [{ name: 'X-Tenant', value: 'team-a' }],
  modelsEndpoint: 'https://custom.example.test/v1/models',
  requestTemplate: JSON.stringify({
    input: {
      model: '{{model}}',
      prompt: '{{prompt}}',
      source: '{{source}}',
      style: '{{style}}',
      target: '{{target}}',
      text: '{{text}}'
    }
  }),
  responseTextPath: 'choices.0.message.content'
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

function createAbortError(): Error {
  const error = new Error('The request was aborted.');
  error.name = 'AbortError';
  return error;
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

  it('sends Anthropic Messages requests with versioned header authentication', async () => {
    const fetch = createFetch(responseBody({ content: [{ type: 'text', text: 'Hello, team.' }] }));
    const adapter = new AnthropicProvider(new HttpClient({ fetch }));

    await expect(adapter.transform(transformRequest, anthropicProfile)).resolves.toEqual({
      operationId: 'operation-1',
      text: 'Hello, team.'
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetch.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: 'application/json',
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'x-api-key': 'anthropic-secret'
    });
    expect(requestBody(fetch)).toEqual({
      max_tokens: 128,
      messages: [{ content: transformRequest.prompt, role: 'user' }],
      model: 'claude-test',
      stream: false,
      temperature: 0
    });
  });

  it('discovers Anthropic models and uses a compact connection request', async () => {
    const modelFetch = createFetch(responseBody({ data: [{ id: 'claude-test' }] }));
    const modelAdapter = new AnthropicProvider(new HttpClient({ fetch: modelFetch }));

    await expect(modelAdapter.listModels(anthropicProfile)).resolves.toEqual([
      { id: 'claude-test', label: 'claude-test' }
    ]);
    expect(modelFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/models',
      expect.objectContaining({ method: 'GET' })
    );

    const connectionFetch = createFetch(responseBody({ content: [{ type: 'text', text: 'OK' }] }));
    const connectionAdapter = new AnthropicProvider(new HttpClient({ fetch: connectionFetch }));
    await expect(connectionAdapter.testConnection(anthropicProfile)).resolves.toEqual({ ok: true });
    expect(requestBody(connectionFetch)).toMatchObject({
      max_tokens: 1,
      messages: [{ content: 'Reply with OK.', role: 'user' }],
      model: 'claude-test',
      stream: false
    });
  });

  it('uses Gemini header authentication, canonical model routes, and generation config', async () => {
    const fetch = createFetch(
      responseBody({ candidates: [{ content: { parts: [{ text: 'Hello, team.' }] } }] })
    );
    const adapter = new GeminiProvider(new HttpClient({ fetch }));

    await expect(adapter.transform(transformRequest, geminiProfile)).resolves.toEqual({
      operationId: 'operation-1',
      text: 'Hello, team.'
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetch.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-goog-api-key': 'gemini-secret'
    });
    expect(requestBody(fetch)).toEqual({
      contents: [{ parts: [{ text: transformRequest.prompt }], role: 'user' }],
      generationConfig: { maxOutputTokens: 128, temperature: 0 }
    });
    expect(fetch.mock.calls[0]?.[0]).not.toContain('gemini-secret');
  });

  it('discovers route-safe Gemini IDs and rejects an unsafe manual model path', async () => {
    const fetch = createFetch(
      responseBody({
        models: [
          { name: 'models/gemini-2.5-flash' },
          { name: 'models/gemini-2.5-flash' },
          { name: 'models/gemini/escaped' }
        ]
      })
    );
    const adapter = new GeminiProvider(new HttpClient({ fetch }));

    await expect(adapter.listModels(geminiProfile)).resolves.toEqual([
      { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash' }
    ]);

    const unsafeFetch = createFetch(
      responseBody({ candidates: [{ content: { parts: [{ text: 'Should not run.' }] } }] })
    );
    const unsafeAdapter = new GeminiProvider(new HttpClient({ fetch: unsafeFetch }));
    await expect(
      unsafeAdapter.transform(transformRequest, {
        ...geminiProfile,
        selectedModelId: 'models/gemini/escaped'
      })
    ).rejects.toMatchObject({ code: 'CONFIGURATION' });
    expect(unsafeFetch).not.toHaveBeenCalled();
  });

  it('uses a compact Gemini connection request', async () => {
    const fetch = createFetch(
      responseBody({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] })
    );
    const adapter = new GeminiProvider(new HttpClient({ fetch }));

    await expect(adapter.testConnection(geminiProfile)).resolves.toEqual({ ok: true });
    expect(requestBody(fetch)).toEqual({
      contents: [{ parts: [{ text: 'Reply with OK.' }], role: 'user' }],
      generationConfig: { maxOutputTokens: 1 }
    });
  });

  it('rejects Anthropic and Gemini responses without usable text', async () => {
    const anthropicFetch = createFetch(responseBody({ content: [{ type: 'tool_use' }] }));
    const anthropicAdapter = new AnthropicProvider(new HttpClient({ fetch: anthropicFetch }));
    await expect(
      anthropicAdapter.transform(transformRequest, anthropicProfile)
    ).rejects.toMatchObject({
      code: 'INVALID_RESPONSE'
    });

    const geminiFetch = createFetch(
      responseBody({ candidates: [{ content: { parts: [{ inlineData: {} }] } }] })
    );
    const geminiAdapter = new GeminiProvider(new HttpClient({ fetch: geminiFetch }));
    await expect(geminiAdapter.transform(transformRequest, geminiProfile)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE'
    });
  });

  it('interpolates a custom JSON request as data and extracts a safe response path', async () => {
    const injectionLikeText = 'xin chao"},"injected":true,"ignored":"';
    const request = { ...transformRequest, text: injectionLikeText };
    const fetch = createFetch(
      responseBody({ choices: [{ message: { content: 'Hello, team.' } }] })
    );
    const adapter = new CustomJsonProvider(new HttpClient({ fetch }));

    await expect(adapter.transform(request, customJsonProfile)).resolves.toEqual({
      operationId: 'operation-1',
      text: 'Hello, team.'
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://custom.example.test/v1/transform',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetch.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': 'custom-secret',
      'X-Tenant': 'team-a'
    });
    expect(requestBody(fetch)).toEqual({
      input: {
        model: 'custom-model',
        prompt: transformRequest.prompt,
        source: 'vi',
        style: 'natural and idiomatic',
        target: 'en',
        text: injectionLikeText
      }
    });
    expect(requestBody(fetch)).not.toHaveProperty('injected');
  });

  it('discovers conventional custom models with configured bearer authentication', async () => {
    const fetch = createFetch(
      responseBody({ models: ['custom-model', { id: ' ', name: 'alternate-model' }] })
    );
    const adapter = new CustomJsonProvider(new HttpClient({ fetch }));
    const bearerProfile: CustomJsonProviderProfile = {
      ...customJsonProfile,
      authentication: { kind: 'bearer', token: 'custom-bearer-token' },
      headers: []
    };

    await expect(adapter.listModels(bearerProfile)).resolves.toEqual([
      { id: 'custom-model', label: 'custom-model' },
      { id: 'alternate-model', label: 'alternate-model' }
    ]);
    expect(fetch).toHaveBeenCalledWith(
      'https://custom.example.test/v1/models',
      expect.objectContaining({ method: 'GET' })
    );
    expect(fetch.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer custom-bearer-token',
      'Content-Type': 'application/json'
    });
  });

  it('keeps manual custom-model fallback available when discovery is disabled or unavailable', async () => {
    const noDiscoveryFetch = vi.fn<HttpFetch>();
    const noDiscoveryAdapter = new CustomJsonProvider(new HttpClient({ fetch: noDiscoveryFetch }));
    await expect(
      noDiscoveryAdapter.listModels({ ...customJsonProfile, modelsEndpoint: null })
    ).resolves.toEqual([]);
    expect(noDiscoveryFetch).not.toHaveBeenCalled();

    const unavailableFetch = createFetch(responseBody({ error: 'not found' }, 404));
    const unavailableAdapter = new CustomJsonProvider(new HttpClient({ fetch: unavailableFetch }));
    await expect(unavailableAdapter.listModels(customJsonProfile)).resolves.toEqual([]);
  });

  it('uses the configured custom template and path for a compact connection test', async () => {
    const fetch = createFetch(responseBody({ choices: [{ message: { content: 'OK' } }] }));
    const adapter = new CustomJsonProvider(new HttpClient({ fetch }));

    await expect(adapter.testConnection(customJsonProfile)).resolves.toEqual({ ok: true });
    expect(requestBody(fetch)).toMatchObject({
      input: {
        model: 'custom-model',
        prompt: 'Reply with OK.',
        text: 'Reply with OK.'
      }
    });
  });

  it('rejects an unsafe custom response path before sending text to a provider', async () => {
    const fetch = createFetch(
      responseBody({ choices: [{ message: { content: 'Should not run.' } }] })
    );
    const adapter = new CustomJsonProvider(new HttpClient({ fetch }));

    await expect(
      adapter.transform(transformRequest, {
        ...customJsonProfile,
        responseTextPath: 'constructor.value'
      })
    ).rejects.toMatchObject({ code: 'CONFIGURATION' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects malformed custom response text without applying it', async () => {
    const fetch = createFetch(responseBody({ choices: [{ message: { content: 7 } }] }));
    const adapter = new CustomJsonProvider(new HttpClient({ fetch }));

    await expect(adapter.transform(transformRequest, customJsonProfile)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE'
    });
  });

  it('forwards custom profile timeouts through the shared HTTP boundary', async () => {
    vi.useFakeTimers();

    try {
      const fetch = vi.fn<HttpFetch>(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(createAbortError()), {
              once: true
            });
          })
      );
      const adapter = new CustomJsonProvider(new HttpClient({ fetch }));
      const pending = adapter.transform(transformRequest, customJsonProfile);
      const rejected = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });

      await vi.advanceTimersByTimeAsync(customJsonProfile.timeoutMs);

      await rejected;
      expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
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
