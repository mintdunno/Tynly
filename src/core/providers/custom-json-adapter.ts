import { AppError } from '../../shared/errors/index.ts';
import {
  interpolateCustomJsonRequestTemplate,
  parseCustomJsonResponsePath,
  readCustomJsonResponseText,
  type CustomJsonTemplateValues
} from '../settings/custom-json-validation.ts';
import {
  isProviderProfile,
  type CustomApiAuthentication,
  type CustomJsonProviderProfile
} from '../settings/schema.ts';

import {
  mergeProviderHeaders,
  parseCustomModelList,
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
const MAX_CUSTOM_TEMPLATE_LENGTH = 32_768;
const MAX_CUSTOM_RESPONSE_PATH_LENGTH = 512;
const MAX_PROVIDER_TEXT_LENGTH = 50_000;

const CUSTOM_JSON_CAPABILITIES: ProviderCapabilities = {
  connectionTest: true,
  customHeaders: true,
  manualModelId: true,
  maxOutputTokens: false,
  modelDiscovery: true,
  requestCancellation: true,
  temperature: false
};

/**
 * Data-only adapter for a user-configured JSON HTTP API. It parses a bounded
 * JSON template and safe response path; it never evaluates user configuration.
 */
export class CustomJsonProvider implements AIProvider<'custom-json'> {
  readonly capabilities = CUSTOM_JSON_CAPABILITIES;
  readonly kind = 'custom-json' as const;
  readonly name = 'Custom JSON API';

  constructor(private readonly httpClient: HttpClient = new HttpClient()) {}

  async listModels(
    profile: ProviderProfileForKind<'custom-json'>,
    signal?: AbortSignal
  ): Promise<readonly ProviderModelInfo[]> {
    assertConfiguredProfile(profile);
    if (profile.modelsEndpoint === null) {
      return [];
    }

    try {
      const payload = await this.httpClient.request(
        withOptionalSignal(
          {
            headers: this.headers(profile),
            method: 'GET',
            timeoutMs: profile.timeoutMs,
            url: profile.modelsEndpoint
          },
          signal
        ),
        readJsonResponse
      );
      return parseCustomModelList(payload);
    } catch (error) {
      if (error instanceof AppError && error.code === 'MODEL_UNAVAILABLE') {
        return [];
      }
      throw error;
    }
  }

  async testConnection(
    profile: ProviderProfileForKind<'custom-json'>,
    signal?: AbortSignal
  ): Promise<ProviderConnectionTestResult> {
    try {
      assertConfiguredProfile(profile);
      const model = requireSelectedModel(profile);
      const payload = await this.request(profile, createConnectionTemplateValues(model), signal);
      if (readResponseText(profile, payload) === null) {
        throw new AppError('INVALID_RESPONSE');
      }
      return { ok: true };
    } catch (error) {
      return createConnectionTestFailure(error);
    }
  }

  async transform(
    request: ProviderTransformRequest,
    profile: ProviderProfileForKind<'custom-json'>,
    signal?: AbortSignal
  ): Promise<ProviderTransformResult> {
    assertConfiguredProfile(profile);
    assertTransformRequest(request);
    const model = requireSelectedModel(profile);
    const payload = await this.request(
      profile,
      createTransformTemplateValues(request, model),
      signal
    );
    const text = readResponseText(profile, payload);
    if (text === null) {
      throw new AppError('INVALID_RESPONSE');
    }

    return {
      operationId: request.operationId,
      text
    };
  }

  private async request(
    profile: CustomJsonProviderProfile,
    variables: CustomJsonTemplateValues,
    signal?: AbortSignal
  ): Promise<unknown> {
    const body = interpolateCustomJsonRequestTemplate(
      profile.requestTemplate,
      variables,
      MAX_CUSTOM_TEMPLATE_LENGTH
    );
    if (body === null) {
      throw new AppError('CONFIGURATION');
    }

    const serializedBody = JSON.stringify(body);
    return this.httpClient.request(
      withOptionalSignal(
        {
          body: serializedBody,
          headers: this.headers(profile),
          method: profile.method,
          timeoutMs: profile.timeoutMs,
          url: profile.endpoint
        },
        signal
      ),
      readJsonResponse
    );
  }

  private headers(profile: CustomJsonProviderProfile): Readonly<Record<string, string>> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };
    const authenticationHeader = toAuthenticationHeader(profile.authentication);
    if (authenticationHeader !== null) {
      headers[authenticationHeader.name] = authenticationHeader.value;
    }

    return mergeProviderHeaders(headers, profile.headers);
  }
}

export const CustomJsonAdapter = CustomJsonProvider;

function assertConfiguredProfile(profile: CustomJsonProviderProfile): void {
  if (!isProviderProfile(profile) || profile.kind !== 'custom-json') {
    throw new AppError('CONFIGURATION');
  }

  switch (profile.authentication.kind) {
    case 'none':
      return;
    case 'bearer':
      if (!isNonBlankSecret(profile.authentication.token)) {
        throw new AppError('CONFIGURATION');
      }
      return;
    case 'header':
      if (!isNonBlankSecret(profile.authentication.value)) {
        throw new AppError('CONFIGURATION');
      }
  }
}

function requireSelectedModel(profile: CustomJsonProviderProfile): string {
  const model = profile.selectedModelId;
  if (
    typeof model !== 'string' ||
    model.trim().length === 0 ||
    model.length > 256 ||
    /[\r\n]/u.test(model)
  ) {
    throw new AppError('CONFIGURATION');
  }

  return model.trim();
}

function assertTransformRequest(request: ProviderTransformRequest): void {
  if (
    typeof request.prompt !== 'string' ||
    request.prompt.trim().length === 0 ||
    request.prompt.length > MAX_PROVIDER_TEXT_LENGTH ||
    typeof request.text !== 'string' ||
    request.text.length > MAX_PROVIDER_TEXT_LENGTH ||
    typeof request.language.source !== 'string' ||
    typeof request.language.target !== 'string' ||
    typeof request.style.instruction !== 'string'
  ) {
    throw new AppError('CONFIGURATION');
  }
}

function createTransformTemplateValues(
  request: ProviderTransformRequest,
  model: string
): CustomJsonTemplateValues {
  return {
    prompt: request.prompt,
    text: request.text,
    model,
    source: request.language.source,
    target: request.language.target,
    style: request.style.instruction
  };
}

function createConnectionTemplateValues(model: string): CustomJsonTemplateValues {
  return {
    prompt: CONNECTION_PROMPT,
    text: CONNECTION_PROMPT,
    model,
    source: 'auto',
    target: 'en',
    style: 'natural and idiomatic'
  };
}

function readResponseText(profile: CustomJsonProviderProfile, payload: unknown): string | null {
  const path = parseCustomJsonResponsePath(
    profile.responseTextPath,
    MAX_CUSTOM_RESPONSE_PATH_LENGTH
  );
  return path === null ? null : readCustomJsonResponseText(payload, path, MAX_PROVIDER_TEXT_LENGTH);
}

function toAuthenticationHeader(
  authentication: CustomApiAuthentication
): { readonly name: string; readonly value: string } | null {
  switch (authentication.kind) {
    case 'none':
      return null;
    case 'bearer':
      return { name: 'Authorization', value: `Bearer ${authentication.token}` };
    case 'header':
      return { name: authentication.headerName, value: authentication.value };
  }
}

function isNonBlankSecret(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 16_384 &&
    !/[\r\n]/u.test(value)
  );
}
