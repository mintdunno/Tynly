import { AppError } from '../../shared/errors/index.ts';

import {
  appendTemperature,
  effectiveOutputTokens,
  joinProviderUrl,
  mergeProviderHeaders,
  parseModelList,
  readChatText,
  readDataProperty,
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

const OPENAI_COMPATIBLE_CAPABILITIES: ProviderCapabilities = {
  connectionTest: true,
  customHeaders: true,
  manualModelId: true,
  maxOutputTokens: true,
  modelDiscovery: true,
  requestCancellation: true,
  temperature: true
};

const CONNECTION_PROMPT = 'Reply with OK.';

/** Adapter for providers implementing the OpenAI `/models` and chat protocol. */
export class OpenAiCompatibleProvider implements AIProvider<'openai-compatible'> {
  readonly capabilities = OPENAI_COMPATIBLE_CAPABILITIES;
  readonly kind = 'openai-compatible' as const;
  readonly name = 'OpenAI-compatible';

  constructor(private readonly httpClient: HttpClient = new HttpClient()) {}

  async listModels(
    profile: ProviderProfileForKind<'openai-compatible'>,
    signal?: AbortSignal
  ): Promise<readonly ProviderModelInfo[]> {
    try {
      assertApiKey(profile);
      const response = await this.httpClient.request(
        withOptionalSignal(
          {
            headers: this.headers(profile),
            method: 'GET',
            timeoutMs: profile.timeoutMs,
            url: joinProviderUrl(profile.baseUrl, '/models', 'https')
          },
          signal
        )
      );
      const payload = await readJsonResponse(response);
      return parseModelList(payload, (entry) => {
        const id = readDataProperty(entry, 'id');
        return typeof id === 'string' ? id : null;
      });
    } catch (error) {
      if (error instanceof AppError && error.code === 'MODEL_UNAVAILABLE') {
        return [];
      }
      throw error;
    }
  }

  async testConnection(
    profile: ProviderProfileForKind<'openai-compatible'>,
    signal?: AbortSignal
  ): Promise<ProviderConnectionTestResult> {
    try {
      assertSelectedModel(profile);
      assertApiKey(profile);
      const response = await this.httpClient.request(
        withOptionalSignal(
          {
            body: JSON.stringify(buildChatBody(profile, CONNECTION_PROMPT, 1)),
            headers: this.headers(profile),
            method: 'POST',
            timeoutMs: profile.timeoutMs,
            url: joinProviderUrl(profile.baseUrl, '/chat/completions', 'https')
          },
          signal
        )
      );
      readChatText(await readJsonResponse(response), 'openai');
      return { ok: true };
    } catch (error) {
      return createConnectionTestFailure(error);
    }
  }

  async transform(
    request: ProviderTransformRequest,
    profile: ProviderProfileForKind<'openai-compatible'>,
    signal?: AbortSignal
  ): Promise<ProviderTransformResult> {
    assertSelectedModel(profile);
    assertApiKey(profile);
    assertPrompt(request.prompt);
    const response = await this.httpClient.request(
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
          url: joinProviderUrl(profile.baseUrl, '/chat/completions', 'https')
        },
        signal
      )
    );

    return {
      operationId: request.operationId,
      text: readChatText(await readJsonResponse(response), 'openai')
    };
  }

  private headers(
    profile: ProviderProfileForKind<'openai-compatible'>
  ): Readonly<Record<string, string>> {
    const baseHeaders: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${profile.apiKey}`,
      'Content-Type': 'application/json'
    };
    return mergeProviderHeaders(baseHeaders, profile.headers);
  }
}

export const OpenAICompatibleProvider = OpenAiCompatibleProvider;
export const OpenAiCompatibleAdapter = OpenAiCompatibleProvider;
export const OpenAICompatibleAdapter = OpenAiCompatibleProvider;

function buildChatBody(
  profile: ProviderProfileForKind<'openai-compatible'>,
  prompt: string,
  maxTokens: number,
  temperature?: number | null
): Readonly<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    max_tokens: maxTokens,
    messages: [{ content: prompt, role: 'user' }],
    model: profile.selectedModelId.trim(),
    stream: false
  };
  appendTemperature(body, temperature);
  return body;
}

function assertSelectedModel(profile: ProviderProfileForKind<'openai-compatible'>): void {
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

function assertApiKey(profile: ProviderProfileForKind<'openai-compatible'>): void {
  if (
    typeof profile.apiKey !== 'string' ||
    profile.apiKey.trim().length === 0 ||
    profile.apiKey.length > 16_384 ||
    /[\r\n]/u.test(profile.apiKey)
  ) {
    throw new AppError('CONFIGURATION');
  }
}
