import { AppError } from '../../shared/errors/index.ts';

import {
  appendTemperature,
  effectiveOutputTokens,
  joinProviderUrl,
  normalizeGeminiModelId,
  parseGeminiModelList,
  readGeminiText,
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

const CONNECTION_PROMPT = 'Reply with OK.';

const GEMINI_CAPABILITIES: ProviderCapabilities = {
  connectionTest: true,
  customHeaders: false,
  manualModelId: true,
  maxOutputTokens: true,
  modelDiscovery: true,
  requestCancellation: true,
  temperature: true
};

/** Adapter for the Google Generative Language REST API. */
export class GeminiProvider implements AIProvider<'gemini'> {
  readonly capabilities = GEMINI_CAPABILITIES;
  readonly kind = 'gemini' as const;
  readonly name = 'Google Gemini';

  constructor(private readonly httpClient: HttpClient = new HttpClient()) {}

  async listModels(
    profile: ProviderProfileForKind<'gemini'>,
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
      return parseGeminiModelList(payload);
    } catch (error) {
      if (error instanceof AppError && error.code === 'MODEL_UNAVAILABLE') {
        return [];
      }
      throw error;
    }
  }

  async testConnection(
    profile: ProviderProfileForKind<'gemini'>,
    signal?: AbortSignal
  ): Promise<ProviderConnectionTestResult> {
    try {
      assertApiKey(profile);
      const payload = await this.httpClient.request(
        withOptionalSignal(
          {
            body: JSON.stringify(buildGenerateContentBody(CONNECTION_PROMPT, 1)),
            headers: this.headers(profile),
            method: 'POST',
            timeoutMs: profile.timeoutMs,
            url: generateContentUrl(profile)
          },
          signal
        ),
        readJsonResponse
      );
      readGeminiText(payload);
      return { ok: true };
    } catch (error) {
      return createConnectionTestFailure(error);
    }
  }

  async transform(
    request: ProviderTransformRequest,
    profile: ProviderProfileForKind<'gemini'>,
    signal?: AbortSignal
  ): Promise<ProviderTransformResult> {
    assertApiKey(profile);
    assertPrompt(request.prompt);
    const payload = await this.httpClient.request(
      withOptionalSignal(
        {
          body: JSON.stringify(
            buildGenerateContentBody(
              request.prompt,
              effectiveOutputTokens(request.maxOutputTokens, profile.maxOutputTokens),
              profile.temperature
            )
          ),
          headers: this.headers(profile),
          method: 'POST',
          timeoutMs: profile.timeoutMs,
          url: generateContentUrl(profile)
        },
        signal
      ),
      readJsonResponse
    );

    return {
      operationId: request.operationId,
      text: readGeminiText(payload)
    };
  }

  private headers(profile: ProviderProfileForKind<'gemini'>): Readonly<Record<string, string>> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-goog-api-key': profile.apiKey
    };
  }
}

export const GeminiAdapter = GeminiProvider;

function buildGenerateContentBody(
  prompt: string,
  maxOutputTokens: number,
  temperature?: number | null
): Readonly<Record<string, unknown>> {
  const generationConfig: Record<string, unknown> = { maxOutputTokens };
  appendTemperature(generationConfig, temperature);
  return {
    contents: [{ parts: [{ text: prompt }], role: 'user' }],
    generationConfig
  };
}

function generateContentUrl(profile: ProviderProfileForKind<'gemini'>): string {
  const modelId = normalizeGeminiModelId(profile.selectedModelId);
  if (modelId === null) {
    throw new AppError('CONFIGURATION');
  }

  return joinProviderUrl(
    profile.baseUrl,
    `/models/${encodeURIComponent(modelId)}:generateContent`,
    'https'
  );
}

function assertPrompt(prompt: string): void {
  if (typeof prompt !== 'string' || prompt.trim().length === 0 || prompt.length > 50_000) {
    throw new AppError('CONFIGURATION');
  }
}

function assertApiKey(profile: ProviderProfileForKind<'gemini'>): void {
  if (
    typeof profile.apiKey !== 'string' ||
    profile.apiKey.trim().length === 0 ||
    profile.apiKey.length > 16_384 ||
    /[\r\n]/u.test(profile.apiKey)
  ) {
    throw new AppError('CONFIGURATION');
  }
}
