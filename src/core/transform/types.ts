import type { SourceLanguage, TargetLanguage } from '../settings/schema.ts';

export const TRANSFORM_TRIGGERS = ['field-button', 'selection-button', 'shortcut'] as const;

export type TransformTrigger = (typeof TRANSFORM_TRIGGERS)[number];

export type TransformStyleKind = 'built-in' | 'custom';

/** A resolved style is provider-neutral and ready for compact prompt construction. */
export interface TransformStyle {
  readonly id: string;
  readonly instruction: string;
  readonly kind: TransformStyleKind;
  readonly name: string;
}

export interface TransformLanguagePair {
  readonly source: SourceLanguage;
  readonly target: TargetLanguage;
}

/** Text and preferences captured when a user explicitly invokes Tynly. */
export interface TransformInput {
  readonly language: TransformLanguagePair;
  readonly style: TransformStyle;
  readonly text: string;
  readonly trigger: TransformTrigger;
}

/** The provider-facing request built from a user operation. */
export interface TransformRequest extends TransformInput {
  readonly maxOutputTokens: number;
  readonly operationId: string;
}

/** Provider-neutral plain-text output tied to the operation that created it. */
export interface TransformResult {
  readonly operationId: string;
  readonly text: string;
}
