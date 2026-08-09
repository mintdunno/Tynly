import { AppError } from '../../shared/errors/index.ts';

import {
  appendTemperature,
  effectiveOutputTokens,
  joinProviderUrl,
  parseModelList,
  readAnthropicText,
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

const ANTHROPIC_VERSION = '2023-06-01';
const CONNECTION_PROMPT = 'Reply with OK.';

const ANTHROPIC_CAPABILITIES: ProviderCapabilities = {
  connectionTest: true,
  customHeaders: false,
  manualModelId: true,
  maxOutputTokens: true,
  modelDiscovery: true,
  requestCancellation: true,
  temperature: true
};

/** Adapter for Anthropic's versioned Messages API. */
export class AnthropicProvider implements AIProvider<'anthropic'> {
  readonly capabilities = ANTHROPIC_CAPABILITIES;
  readonly kind = 'anthropic' as const;
  readonly name = 'Anthropic';

  constructor(private readonly httpClient: HttpClient = new HttpClient()) {}

  async listModels(
    profile: ProviderProfileForKind<'anthropic'>,
    signal?: AbortSignal
  ): Promise<readonly ProviderModelInfo[]> {
    try {
      assertApiKey(profile);
      const payload = await this.httpClient.request(
        withOptionalSignal(
          {
            headers: this.headers(profile),
            method: 'GET',
            timeoutMs: profile.timeoutMs,
            url: joinProviderUrl(profile.baseUrl, '/models', 'https')
          },
          signal
        ),
        readJsonResponse
      );
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
    profile: ProviderProfileForKind<'anthropic'>,
    signal?: AbortSignal
  ): Promise<ProviderConnectionTestResult> {
    try {
      assertSelectedModel(profile);
      assertApiKey(profile);
      const payload = await this.httpClient.request(
        withOptionalSignal(
          {
            body: JSON.stringify(buildMessagesBody(profile, CONNECTION_PROMPT, 1)),
            headers: this.headers(profile),
            method: 'POST',
            timeoutMs: profile.timeoutMs,
            url: joinProviderUrl(profile.baseUrl, '/messages', 'https')
          },
          signal
        ),
        readJsonResponse
      );
      readAnthropicText(payload);
      return { ok: true };
    } catch (error) {
      return createConnectionTestFailure(error);
    }
  }

  async transform(
    request: ProviderTransformRequest,
    profile: ProviderProfileForKind<'anthropic'>,
    signal?: AbortSignal
  ): Promise<ProviderTransformResult> {
    assertSelectedModel(profile);
    assertApiKey(profile);
    assertPrompt(request.prompt);
    const payload = await this.httpClient.request(
      withOptionalSignal(
        {
          body: JSON.stringify(
            buildMessagesBody(
              profile,
              request.prompt,
              effectiveOutputTokens(request.maxOutputTokens, profile.maxOutputTokens),
              profile.temperature
            )
          ),
          headers: this.headers(profile),
          method: 'POST',
          timeoutMs: profile.timeoutMs,
          url: joinProviderUrl(profile.baseUrl, '/messages', 'https')
        },
        signal
      ),
      readJsonResponse
    );

    return {
      operationId: request.operationId,
      text: readAnthropicText(payload)
    };
  }

  private headers(profile: ProviderProfileForKind<'anthropic'>): Readonly<Record<string, string>> {
    return {
      Accept: 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
      'Content-Type': 'application/json',
      'x-api-key': profile.apiKey
    };
  }
}

export const AnthropicAdapter = AnthropicProvider;

function buildMessagesBody(
  profile: ProviderProfileForKind<'anthropic'>,
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

function assertSelectedModel(profile: ProviderProfileForKind<'anthropic'>): void {
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

function assertApiKey(profile: ProviderProfileForKind<'anthropic'>): void {
  if (
    typeof profile.apiKey !== 'string' ||
    profile.apiKey.trim().length === 0 ||
    profile.apiKey.length > 16_384 ||
    /[\r\n]/u.test(profile.apiKey)
  ) {
    throw new AppError('CONFIGURATION');
  }
}
