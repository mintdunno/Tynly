import { describe, expect, it } from 'vitest';

import type { CustomStyle, StyleSelection } from '../settings/schema.ts';
import {
  BUILT_IN_STYLES,
  getLanguageLabel,
  resolveTransformStyle,
  swapTransformLanguagePair
} from './style-registry.ts';

describe('BUILT_IN_STYLES', () => {
  it('defines the exact supported styles and compact instructions', () => {
    expect(BUILT_IN_STYLES).toEqual({
      natural: {
        id: 'natural',
        instruction: 'natural and idiomatic',
        kind: 'built-in',
        name: 'Natural'
      },
      professional: {
        id: 'professional',
        instruction: 'professional and concise',
        kind: 'built-in',
        name: 'Professional'
      },
      casual: {
        id: 'casual',
        instruction: 'casual and natural',
        kind: 'built-in',
        name: 'Casual'
      },
      formal: {
        id: 'formal',
        instruction: 'formal and polished',
        kind: 'built-in',
        name: 'Formal'
      },
      concise: {
        id: 'concise',
        instruction: 'concise; remove unnecessary words',
        kind: 'built-in',
        name: 'Concise'
      },
      literal: {
        id: 'literal',
        instruction: 'stay close to the original wording',
        kind: 'built-in',
        name: 'Literal'
      }
    });
  });

  it('returns a fresh resolved built-in style', () => {
    const style = resolveTransformStyle({ kind: 'built-in', id: 'natural' }, []);

    expect(style).toEqual(BUILT_IN_STYLES.natural);
    expect(style).not.toBe(BUILT_IN_STYLES.natural);
  });
});

describe('resolveTransformStyle', () => {
  it('resolves the selected custom style and normalizes its outer whitespace', () => {
    const customStyles: CustomStyle[] = [
      {
        id: 'warm-support',
        name: ' Warm support ',
        instruction: ' Be helpful, empathetic, and clear. '
      }
    ];

    expect(resolveTransformStyle({ kind: 'custom', id: 'warm-support' }, customStyles)).toEqual({
      id: 'warm-support',
      instruction: 'Be helpful, empathetic, and clear.',
      kind: 'custom',
      name: 'Warm support'
    });
  });

  it('refuses missing, duplicate, malformed, and unknown selections', () => {
    const duplicate: CustomStyle[] = [
      { id: 'duplicate', name: 'First', instruction: 'First instruction.' },
      { id: 'duplicate', name: 'Second', instruction: 'Second instruction.' }
    ];
    const malformed = [
      { id: 'broken', name: '', instruction: 'Instruction.' }
    ] as unknown as CustomStyle[];

    expect(resolveTransformStyle({ kind: 'custom', id: 'missing' }, [])).toBeNull();
    expect(resolveTransformStyle({ kind: 'custom', id: 'duplicate' }, duplicate)).toBeNull();
    expect(resolveTransformStyle({ kind: 'custom', id: 'broken' }, malformed)).toBeNull();
    expect(
      resolveTransformStyle({ kind: 'built-in', id: 'unknown' } as unknown as StyleSelection, [])
    ).toBeNull();
  });
});

describe('language helpers', () => {
  it('provides labels for every supported source language', () => {
    expect(getLanguageLabel('auto')).toBe('Auto-detect');
    expect(getLanguageLabel('vi')).toBe('Vietnamese');
    expect(getLanguageLabel('en')).toBe('English');
    expect(getLanguageLabel('ja')).toBe('Japanese');
    expect(getLanguageLabel('ko')).toBe('Korean');
    expect(getLanguageLabel('zh')).toBe('Chinese');
    expect(getLanguageLabel('fr')).toBe('French');
    expect(getLanguageLabel('de')).toBe('German');
    expect(getLanguageLabel('es')).toBe('Spanish');
  });

  it('swaps known languages without mutating the original pair', () => {
    const language = { source: 'vi' as const, target: 'en' as const };

    expect(swapTransformLanguagePair(language)).toEqual({ source: 'en', target: 'vi' });
    expect(language).toEqual({ source: 'vi', target: 'en' });
  });

  it('does not swap an Auto source into an invalid target', () => {
    expect(swapTransformLanguagePair({ source: 'auto', target: 'en' })).toBeNull();
  });
});
