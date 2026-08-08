import { describe, expect, it } from 'vitest';

import {
  MAX_TRANSFORM_INPUT_CHARACTERS,
  MAX_TRANSFORM_OUTPUT_TOKENS,
  MIN_TRANSFORM_OUTPUT_TOKENS,
  OUTPUT_BUDGET_CHARACTERS_PER_TOKEN,
  countTransformInputCharacters,
  estimateTransformOutputTokenBudget,
  validateTransformInput
} from './limits.ts';

describe('transform input limits', () => {
  it('accepts non-empty text through the configured input boundary', () => {
    const atLimit = 'x'.repeat(MAX_TRANSFORM_INPUT_CHARACTERS);

    expect(validateTransformInput(atLimit)).toEqual({
      ok: true,
      characterCount: MAX_TRANSFORM_INPUT_CHARACTERS,
      maxCharacters: MAX_TRANSFORM_INPUT_CHARACTERS,
      outputTokenBudget: MAX_TRANSFORM_OUTPUT_TOKENS
    });
  });

  it('rejects non-text, whitespace-only, and oversized inputs without returning source text', () => {
    expect(validateTransformInput(null)).toEqual({
      ok: false,
      reason: 'not-text',
      characterCount: null,
      maxCharacters: MAX_TRANSFORM_INPUT_CHARACTERS
    });
    expect(validateTransformInput(' \n\t ')).toEqual({
      ok: false,
      reason: 'empty',
      characterCount: 4,
      maxCharacters: MAX_TRANSFORM_INPUT_CHARACTERS
    });
    expect(validateTransformInput('x'.repeat(MAX_TRANSFORM_INPUT_CHARACTERS + 1))).toEqual({
      ok: false,
      reason: 'too-long',
      characterCount: MAX_TRANSFORM_INPUT_CHARACTERS + 1,
      maxCharacters: MAX_TRANSFORM_INPUT_CHARACTERS
    });
  });

  it('counts Unicode code points rather than UTF-16 code units', () => {
    expect(countTransformInputCharacters('A😀B')).toBe(3);
    expect(validateTransformInput('😀')).toMatchObject({ ok: true, characterCount: 1 });
  });
});

describe('estimateTransformOutputTokenBudget', () => {
  it('uses a minimum budget for short input', () => {
    expect(estimateTransformOutputTokenBudget('')).toBe(MIN_TRANSFORM_OUTPUT_TOKENS);
    expect(estimateTransformOutputTokenBudget('short input')).toBe(MIN_TRANSFORM_OUTPUT_TOKENS);
  });

  it('grows proportionally after the minimum threshold', () => {
    const threshold = MIN_TRANSFORM_OUTPUT_TOKENS * OUTPUT_BUDGET_CHARACTERS_PER_TOKEN;

    expect(estimateTransformOutputTokenBudget('x'.repeat(threshold))).toBe(
      MIN_TRANSFORM_OUTPUT_TOKENS
    );
    expect(estimateTransformOutputTokenBudget('x'.repeat(threshold + 1))).toBe(
      MIN_TRANSFORM_OUTPUT_TOKENS + 1
    );
    expect(estimateTransformOutputTokenBudget('x'.repeat(900))).toBe(300);
  });

  it('never exceeds the absolute maximum', () => {
    const capThreshold = MAX_TRANSFORM_OUTPUT_TOKENS * OUTPUT_BUDGET_CHARACTERS_PER_TOKEN;

    expect(estimateTransformOutputTokenBudget('x'.repeat(capThreshold))).toBe(
      MAX_TRANSFORM_OUTPUT_TOKENS
    );
    expect(estimateTransformOutputTokenBudget('x'.repeat(capThreshold * 2))).toBe(
      MAX_TRANSFORM_OUTPUT_TOKENS
    );
  });
});
