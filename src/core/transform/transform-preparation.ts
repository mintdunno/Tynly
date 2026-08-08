import { buildTransformPrompt } from './prompt-builder.ts';
import { validateTransformInput, type TransformInputLimitResult } from './limits.ts';
import type { TransformInput, TransformRequest } from './types.ts';

export interface PreparedTransform {
  readonly prompt: string;
  readonly request: TransformRequest;
}

export type TransformPreparationResult =
  | { readonly ok: true; readonly value: PreparedTransform }
  | { readonly input: Exclude<TransformInputLimitResult, { ok: true }>; readonly ok: false };

/**
 * Creates the one provider-neutral request used by every transform trigger.
 * Providers receive the generated prompt and request metadata but never need
 * to know how fields, selections, or shortcuts collected the text.
 */
export function prepareTransform(
  input: TransformInput,
  operationId: string
): TransformPreparationResult {
  const inputLimit = validateTransformInput(input.text);
  if (!inputLimit.ok) {
    return { ok: false, input: inputLimit };
  }

  return {
    ok: true,
    value: {
      prompt: buildTransformPrompt(input),
      request: {
        ...input,
        maxOutputTokens: inputLimit.outputTokenBudget,
        operationId
      }
    }
  };
}
