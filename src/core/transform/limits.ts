/**
 * Keep the normal transform path bounded without introducing a tokenizer
 * dependency. Character counts are Unicode code points, which is stable for
 * the multilingual text Tynly accepts.
 */
export const MAX_TRANSFORM_INPUT_CHARACTERS = 12_000;
export const MIN_TRANSFORM_OUTPUT_TOKENS = 64;
export const MAX_TRANSFORM_OUTPUT_TOKENS = 3_072;
export const OUTPUT_BUDGET_CHARACTERS_PER_TOKEN = 3;

export type TransformInputLimitReason = 'empty' | 'not-text' | 'too-long';

export type TransformInputLimitResult =
  | {
      readonly ok: true;
      readonly characterCount: number;
      readonly maxCharacters: typeof MAX_TRANSFORM_INPUT_CHARACTERS;
      readonly outputTokenBudget: number;
    }
  | {
      readonly ok: false;
      readonly reason: TransformInputLimitReason;
      readonly characterCount: number | null;
      readonly maxCharacters: typeof MAX_TRANSFORM_INPUT_CHARACTERS;
    };

/**
 * Validates a user-triggered transform input without retaining or returning the
 * source text. Callers can use the returned budget directly in a provider
 * request after an accepted result.
 */
export function validateTransformInput(value: unknown): TransformInputLimitResult {
  if (typeof value !== 'string') {
    return {
      ok: false,
      reason: 'not-text',
      characterCount: null,
      maxCharacters: MAX_TRANSFORM_INPUT_CHARACTERS
    };
  }

  const characterCount = countTransformInputCharacters(value);
  if (value.trim().length === 0) {
    return {
      ok: false,
      reason: 'empty',
      characterCount,
      maxCharacters: MAX_TRANSFORM_INPUT_CHARACTERS
    };
  }

  if (characterCount > MAX_TRANSFORM_INPUT_CHARACTERS) {
    return {
      ok: false,
      reason: 'too-long',
      characterCount,
      maxCharacters: MAX_TRANSFORM_INPUT_CHARACTERS
    };
  }

  return {
    ok: true,
    characterCount,
    maxCharacters: MAX_TRANSFORM_INPUT_CHARACTERS,
    outputTokenBudget: estimateTransformOutputTokenBudget(value)
  };
}

/**
 * Estimate a provider-neutral output budget from input size. The result is
 * always bounded so adapters may pass it to providers with compatible limits.
 */
export function estimateTransformOutputTokenBudget(input: string): number {
  const estimatedTokens = Math.ceil(
    countTransformInputCharacters(input) / OUTPUT_BUDGET_CHARACTERS_PER_TOKEN
  );

  return clamp(estimatedTokens, MIN_TRANSFORM_OUTPUT_TOKENS, MAX_TRANSFORM_OUTPUT_TOKENS);
}

export function countTransformInputCharacters(input: string): number {
  return Array.from(input).length;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
