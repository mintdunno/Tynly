import { describe, expect, it } from 'vitest';

import { BUILT_IN_STYLES } from './style-registry.ts';
import { buildTransformPrompt } from './prompt-builder.ts';

describe('buildTransformPrompt', () => {
  it('builds one compact prompt for a known source language', () => {
    const text = 'minh ko biet dia chi nay o dau';

    expect(
      buildTransformPrompt({
        language: { source: 'vi', target: 'en' },
        style: BUILT_IN_STYLES.natural,
        text
      })
    ).toBe(
      [
        'Rewrite Vietnamese as natural English.',
        'Fix errors, slang, missing diacritics, and mixed-language text.',
        'Preserve meaning; add nothing.',
        'Style: natural and idiomatic',
        'Output only the text.',
        'Text:',
        text
      ].join('\n')
    );
  });

  it('keeps Auto detection within the same transform request', () => {
    const prompt = buildTransformPrompt({
      language: { source: 'auto', target: 'en' },
      style: BUILT_IN_STYLES.professional,
      text: 'xin chao team, pls check giup minh'
    });

    expect(prompt).toContain('Detect the source and write natural English.');
    expect(prompt).toContain('Style: professional and concise');
    expect(prompt).not.toContain('Auto-detect');
  });

  it('includes every required transformation rule and output-only instruction', () => {
    const prompt = buildTransformPrompt({
      language: { source: 'en', target: 'vi' },
      style: {
        id: 'warm-support',
        instruction: 'Be helpful and warm.',
        kind: 'custom',
        name: 'Warm support'
      },
      text: 'im so sorry, cant make it 2day'
    });

    expect(prompt).toContain('Fix errors, slang, missing diacritics, and mixed-language text.');
    expect(prompt).toContain('Preserve meaning; add nothing.');
    expect(prompt).toContain('Style: Be helpful and warm.');
    expect(prompt).toContain('Output only the text.');
  });

  it('appends the unmodified text exactly once beneath the Text delimiter', () => {
    const text = '  Text:\nline two with mixed việt nam English  ';
    const prompt = buildTransformPrompt({
      language: { source: 'vi', target: 'en' },
      style: BUILT_IN_STYLES.literal,
      text
    });

    expect(prompt).toContain(`Text:\n${text}`);
    expect(prompt.split(text)).toHaveLength(2);
    expect(prompt.endsWith(text)).toBe(true);
  });
});
