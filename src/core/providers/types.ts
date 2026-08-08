import { serializeAppError, type SerializedAppError } from '../../shared/errors/index.ts';

import type { ProviderKind, ProviderProfile } from '../settings/schema.ts';
import type { TransformRequest, TransformResult } from '../transform/types.ts';

/** The persisted profile shape associated with one provider adapter kind. */
export type ProviderProfileForKind<K extends ProviderKind> = Extract<ProviderProfile, { kind: K }>;

/**
 * Provider metadata intentionally contains only values that are safe to show
 * in the settings UI. Adapters must not return endpoint, header, or credential
 * data as model metadata.
 */
export interface ProviderModelInfo {
  readonly id: string;
  readonly label: string;
}

/** Features exposed to the settings UI without inspecting provider kinds. */
export interface ProviderCapabilities {
  readonly connectionTest: boolean;
  readonly customHeaders: boolean;
  readonly manualModelId: boolean;
  readonly maxOutputTokens: boolean;
  readonly modelDiscovery: boolean;
  readonly requestCancellation: boolean;
  readonly temperature: boolean;
}

/**
 * The provider receives the Phase 3 request metadata plus its centrally built
 * prompt. The original text is retained for operation correlation only; an
 * adapter should use `prompt` as the user-facing model input.
 */
export interface ProviderTransformRequest extends TransformRequest {
  readonly prompt: string;
}

/** A provider returns the same plain-text, operation-bound result Phase 3 expects. */
export type ProviderTransformResult = TransformResult;

/** Connection failure data is deliberately limited to the safe public error envelope. */
export type ProviderConnectionTestResult =
  { readonly ok: true } | { readonly error: SerializedAppError; readonly ok: false };

/**
 * Converts every connection-test failure to the fixed, credential-safe public
 * error form. Never return a provider response body or a thrown error directly.
 */
export function createConnectionTestFailure(error: unknown): ProviderConnectionTestResult {
  return {
    ok: false,
    error: serializeAppError(error)
  };
}

/**
 * A background-only adapter for one persisted provider kind. Methods may reject
 * only with AppError values; adapters must keep raw provider diagnostics private
 * and use createConnectionTestFailure for a non-throwing connection result.
 */
export interface AIProvider<K extends ProviderKind = ProviderKind> {
  readonly capabilities: ProviderCapabilities;
  readonly kind: K;
  readonly name: string;

  listModels(
    profile: ProviderProfileForKind<K>,
    signal?: AbortSignal
  ): Promise<readonly ProviderModelInfo[]>;

  testConnection(
    profile: ProviderProfileForKind<K>,
    signal?: AbortSignal
  ): Promise<ProviderConnectionTestResult>;

  transform(
    request: ProviderTransformRequest,
    profile: ProviderProfileForKind<K>,
    signal?: AbortSignal
  ): Promise<ProviderTransformResult>;
}

/** A heterogeneous collection of adapters, one specialized to each provider kind. */
export type AnyAIProvider = {
  [K in ProviderKind]: AIProvider<K>;
}[ProviderKind];
