import { getLanguageLabel } from './style-registry.ts';
import type { TransformInput } from './types.ts';

export type PromptInput = Pick<TransformInput, 'language' | 'style' | 'text'>;

/**
 * Builds the complete, single-request instruction for a transform. It keeps
 * language detection inside the same request when the source is Auto.
 */
export function buildTransformPrompt(input: PromptInput): string {
  const languageInstruction =
    input.language.source === 'auto'
      ? `Detect the source and write natural ${getLanguageLabel(input.language.target)}.`
      : `Rewrite ${getLanguageLabel(input.language.source)} as natural ${getLanguageLabel(input.language.target)}.`;

  return [
    languageInstruction,
    'Fix errors, slang, missing diacritics, and mixed-language text.',
    'Preserve meaning; add nothing.',
    `Style: ${input.style.instruction}`,
    'Output only the text.',
    'Text:',
    input.text
  ].join('\n');
}
