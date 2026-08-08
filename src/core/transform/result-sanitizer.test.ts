import { describe, expect, it } from 'vitest';

import { sanitizeTransformResult } from './result-sanitizer.ts';

describe('sanitizeTransformResult', () => {
  it('rejects non-text and empty provider output', () => {
    expect(sanitizeTransformResult(null)).toEqual({ ok: false, reason: 'not-text' });
    expect(sanitizeTransformResult({ text: 'hello' })).toEqual({ ok: false, reason: 'not-text' });
    expect(sanitizeTransformResult(' \n\t ')).toEqual({ ok: false, reason: 'empty' });
    expect(sanitizeTransformResult('Translation:')).toEqual({ ok: false, reason: 'empty' });
    expect(sanitizeTransformResult('```text\n\n```')).toEqual({ ok: false, reason: 'empty' });
    expect(sanitizeTransformResult('"   "')).toEqual({ ok: false, reason: 'empty' });
  });

  it('trims only outer whitespace when no unambiguous wrapper is present', () => {
    expect(sanitizeTransformResult('  First line\n\nSecond line  ')).toEqual({
      ok: true,
      text: 'First line\n\nSecond line',
      removedWrappers: []
    });
  });

  it('removes common full-output labels while preserving internal line breaks', () => {
    expect(sanitizeTransformResult('Translation: Hello, world.')).toEqual({
      ok: true,
      text: 'Hello, world.',
      removedWrappers: ['label']
    });
    expect(sanitizeTransformResult('OUTPUT:\nFirst line\n\nSecond line')).toEqual({
      ok: true,
      text: 'First line\n\nSecond line',
      removedWrappers: ['label']
    });
  });

  it('removes one enclosing code fence without changing inner text', () => {
    expect(sanitizeTransformResult('```text\nFirst line\n\nSecond line\n```')).toEqual({
      ok: true,
      text: 'First line\n\nSecond line',
      removedWrappers: ['code-fence']
    });
  });

  it('removes simple enclosing quote pairs', () => {
    expect(sanitizeTransformResult('"Hello, world."')).toEqual({
      ok: true,
      text: 'Hello, world.',
      removedWrappers: ['quotes']
    });
    expect(sanitizeTransformResult('“Xin chào\nthế giới”')).toEqual({
      ok: true,
      text: 'Xin chào\nthế giới',
      removedWrappers: ['quotes']
    });
  });

  it('handles a sequence of independently unambiguous wrappers', () => {
    expect(sanitizeTransformResult('Translation:\n```text\n“Hello\nworld”\n```')).toEqual({
      ok: true,
      text: 'Hello\nworld',
      removedWrappers: ['label', 'code-fence', 'quotes']
    });
  });

  it('preserves potentially meaningful labels, quotes, and multiple code fences', () => {
    expect(sanitizeTransformResult('The word Translation: is part of this sentence.')).toEqual({
      ok: true,
      text: 'The word Translation: is part of this sentence.',
      removedWrappers: []
    });
    expect(sanitizeTransformResult('Translation:Hello')).toEqual({
      ok: true,
      text: 'Translation:Hello',
      removedWrappers: []
    });
    expect(sanitizeTransformResult('"He said \\"hello\\"."')).toEqual({
      ok: true,
      text: '"He said \\"hello\\"."',
      removedWrappers: []
    });
    expect(sanitizeTransformResult('```\nOne\n```\n```\nTwo\n```')).toEqual({
      ok: true,
      text: '```\nOne\n```\n```\nTwo\n```',
      removedWrappers: []
    });
  });
});
