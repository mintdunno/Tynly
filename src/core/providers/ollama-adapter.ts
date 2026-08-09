import { AppError } from '../../shared/errors/index.ts';

import {
  appendTemperature,
  effectiveOutputTokens,
  joinProviderUrl,
  mergeProviderHeaders,
  parseOllamaModelList,
  readChatText,
  readJsonResponse,
  withOptionalSignal
} from './adapter-protocol.ts';
import { HttpClient } from './http-client.ts';
import type {
  AIProvider,
  ProviderCapabilities,
  ProviderConnectionTestResult,
  ProviderModelInfo,
  ProviderProfileForKind,
  ProviderTransformRequest,
  ProviderTransformResult
} from './types.ts';
import { createConnectionTestFailure } from './types.ts';

const OLLAMA_CAPABILITIES: ProviderCapabilities = {
  connectionTest: true,
  customHeaders: true,
  manualModelId: true,
  maxOutputTokens: true,
  modelDiscovery: true,
  requestCancellation: true,
  temperature: true
};

const CONNECTION_PROMPT = 'Reply with OK.';

/** Adapter for Ollama's `/api/tags` and `/api/chat` protocol. */
export class OllamaProvider implements AIProvider<'ollama'> {
  readonly capabilities = OLLAMA_CAPABILITIES;
  readonly kind = 'ollama' as const;
  readonly name = 'Ollama';

  constructor(private readonly httpClient: HttpClient = new HttpClient()) {}

  async listModels(
    profile: ProviderProfileForKind<'ollama'>,
    signal?: AbortSignal
  ): Promise<readonly ProviderModelInfo[]> {
    try {
      const payload = await this.httpClient.request(
        withOptionalSignal(
          {
            headers: this.headers(profile),
            method: 'GET',
            timeoutMs: profile.timeoutMs,
            url: joinProviderUrl(profile.baseUrl, '/api/tags', 'ollama')
          },
          signal
        ),
        readJsonResponse
      );
      return parseOllamaModelList(payload);
    } catch (error) {
      if (error instanceof AppError && error.code === 'MODEL_UNAVAILABLE') {
        return [];
      }
      throw error;
    }
  }

  async testConnection(
    profile: ProviderProfileForKind<'ollama'>,
    signal?: AbortSignal
  ): Promise<ProviderConnectionTestResult> {
    try {
      assertSelectedModel(profile);
      const payload = await this.httpClient.request(
        withOptionalSignal(
          {
            body: JSON.stringify(buildChatBody(profile, CONNECTION_PROMPT, 1)),
            headers: this.headers(profile),
            method: 'POST',
            timeoutMs: profile.timeoutMs,
            url: joinProviderUrl(profile.baseUrl, '/api/chat', 'ollama')
          },
          signal
        ),
        readJsonResponse
      );
      readChatText(payload, 'ollama');
      return { ok: true };
    } catch (error) {
      return createConnectionTestFailure(error);
    }
  }

  async transform(
    request: ProviderTransformRequest,
    profile: ProviderProfileForKind<'ollama'>,
    signal?: AbortSignal
  ): Promise<ProviderTransformResult> {
    assertSelectedModel(profile);
    assertPrompt(request.prompt);
    const payload = await this.httpClient.request(
      withOptionalSignal(
        {
          body: JSON.stringify(
            buildChatBody(
              profile,
              request.prompt,
              effectiveOutputTokens(request.maxOutputTokens, profile.maxOutputTokens),
              profile.temperature
            )
          ),
          headers: this.headers(profile),
          method: 'POST',
          timeoutMs: profile.timeoutMs,
          url: joinProviderUrl(profile.baseUrl, '/api/chat', 'ollama')
        },
        signal
      ),
      readJsonResponse
    );

    return {
      operationId: request.operationId,
      text: readChatText(payload, 'ollama')
    };
  }

  private headers(profile: ProviderProfileForKind<'ollama'>): Readonly<Record<string, string>> {
    return mergeProviderHeaders(
      { Accept: 'application/json', 'Content-Type': 'application/json' },
      profile.headers,
      { allowAuthorization: true }
    );
  }
}

export const OllamaAdapter = OllamaProvider;

function buildChatBody(
  profile: ProviderProfileForKind<'ollama'>,
  prompt: string,
  outputTokens: number,
  temperature?: number | null
): Readonly<Record<string, unknown>> {
  const options: Record<string, unknown> = { num_predict: outputTokens };
  appendTemperature(options, temperature);

  return {
    messages: [{ content: prompt, role: 'user' }],
    model: profile.selectedModelId.trim(),
    options,
    stream: false
  };
}

function assertSelectedModel(profile: ProviderProfileForKind<'ollama'>): void {
  if (
    typeof profile.selectedModelId !== 'string' ||
    profile.selectedModelId.trim().length === 0 ||
    profile.selectedModelId.length > 256 ||
    /[\r\n]/u.test(profile.selectedModelId)
  ) {
    throw new AppError('CONFIGURATION');
  }
}

function assertPrompt(prompt: string): void {
  if (typeof prompt !== 'string' || prompt.trim().length === 0 || prompt.length > 50_000) {
    throw new AppError('CONFIGURATION');
  }
}
