import type {
  BuiltInStyleId,
  CustomStyle,
  SourceLanguage,
  StyleSelection,
  TargetLanguage
} from '../settings/schema.ts';
import type { TransformLanguagePair, TransformStyle } from './types.ts';

const MAX_CUSTOM_STYLE_ID_LENGTH = 64;
const MAX_CUSTOM_STYLE_NAME_LENGTH = 80;
const MAX_CUSTOM_STYLE_INSTRUCTION_LENGTH = 500;

export const LANGUAGE_LABELS: Readonly<Record<SourceLanguage, string>> = Object.freeze({
  auto: 'Auto-detect',
  vi: 'Vietnamese',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  fr: 'French',
  de: 'German',
  es: 'Spanish'
});

export const BUILT_IN_STYLES: Readonly<Record<BuiltInStyleId, TransformStyle>> = Object.freeze({
  natural: Object.freeze({
    id: 'natural',
    instruction: 'natural and idiomatic',
    kind: 'built-in',
    name: 'Natural'
  }),
  professional: Object.freeze({
    id: 'professional',
    instruction: 'professional and concise',
    kind: 'built-in',
    name: 'Professional'
  }),
  casual: Object.freeze({
    id: 'casual',
    instruction: 'casual and natural',
    kind: 'built-in',
    name: 'Casual'
  }),
  formal: Object.freeze({
    id: 'formal',
    instruction: 'formal and polished',
    kind: 'built-in',
    name: 'Formal'
  }),
  concise: Object.freeze({
    id: 'concise',
    instruction: 'concise; remove unnecessary words',
    kind: 'built-in',
    name: 'Concise'
  }),
  literal: Object.freeze({
    id: 'literal',
    instruction: 'stay close to the original wording',
    kind: 'built-in',
    name: 'Literal'
  })
});

export function getLanguageLabel(language: SourceLanguage | TargetLanguage): string {
  return LANGUAGE_LABELS[language];
}

/**
 * Resolves only an existing, bounded custom style. Returning null for an
 * unresolved custom selection prevents silently applying the wrong prompt.
 */
export function resolveTransformStyle(
  selection: StyleSelection,
  customStyles: readonly CustomStyle[]
): TransformStyle | null {
  if (selection.kind === 'built-in') {
    const style = BUILT_IN_STYLES[selection.id];
    return style === undefined ? null : { ...style };
  }

  const matches = customStyles.filter((style) => style.id === selection.id);
  const style = matches.length === 1 ? matches[0] : undefined;

  if (style === undefined || !isSafeCustomStyle(style)) {
    return null;
  }

  return {
    id: style.id,
    instruction: style.instruction.trim(),
    kind: 'custom',
    name: style.name.trim()
  };
}

/**
 * Auto is valid only as a source. Returning null avoids ever creating an
 * invalid Auto target while still making the caller handle that UI state.
 */
export function swapTransformLanguagePair(
  language: TransformLanguagePair
): TransformLanguagePair | null {
  if (language.source === 'auto') {
    return null;
  }

  return {
    source: language.target,
    target: language.source
  };
}

function isSafeCustomStyle(style: CustomStyle): boolean {
  return (
    isSafeStyleText(style.id, MAX_CUSTOM_STYLE_ID_LENGTH) &&
    isSafeStyleText(style.name, MAX_CUSTOM_STYLE_NAME_LENGTH) &&
    isSafeStyleText(style.instruction, MAX_CUSTOM_STYLE_INSTRUCTION_LENGTH)
  );
}

function isSafeStyleText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}
