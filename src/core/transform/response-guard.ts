import type { OperationRegistry } from './operation-registry.ts';
import {
  sanitizeTransformResult,
  type ResultSanitizerFailureReason,
  type ResultSanitizerWrapper
} from './result-sanitizer.ts';

import type { TransformResult } from './types.ts';

export type TransformResultRejectionReason = 'stale' | ResultSanitizerFailureReason;

export type TransformResultAcceptance =
  | {
      readonly ok: true;
      readonly removedWrappers: readonly ResultSanitizerWrapper[];
      readonly result: TransformResult;
    }
  | { readonly ok: false; readonly reason: TransformResultRejectionReason };

/**
 * Atomically claims a result only if it belongs to the latest operation for a
 * scope, then returns its conservative plain-text form. Calling this once at
 * the controller boundary prevents late provider responses from overwriting
 * newer user text.
 */
export function acceptTransformResult(
  registry: OperationRegistry,
  scopeId: string,
  operationId: string,
  rawResult: unknown
): TransformResultAcceptance {
  if (!registry.consume(scopeId, operationId)) {
    return { ok: false, reason: 'stale' };
  }

  const sanitized = sanitizeTransformResult(rawResult);
  if (!sanitized.ok) {
    return sanitized;
  }

  return {
    ok: true,
    result: {
      operationId,
      text: sanitized.text
    },
    removedWrappers: sanitized.removedWrappers
  };
}
