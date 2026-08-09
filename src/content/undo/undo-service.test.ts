import { afterEach, describe, expect, it } from 'vitest';

import { InputElementAdapter, TextareaAdapter } from '../input/text-control-adapter.ts';
import { ContentEditableAdapter } from '../input/contenteditable-adapter.ts';
import { UndoService } from './undo-service.ts';

afterEach(() => {
  document.body.replaceChildren();
});

describe('UndoService', () => {
  it('restores exactly the transformed selection while preserving surrounding text', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'one blue two';
    textarea.setSelectionRange(4, 8);
    document.body.append(textarea);
    const adapter = new TextareaAdapter();
    const replacement = replace(adapter, textarea, 'green');
    const undo = new UndoService();

    expect(
      undo.register({
        adapter,
        operationId: 'transform-1',
        replacement,
        target: textarea
      })
    ).toBe(true);
    expect(textarea.value).toBe('one green two');

    expect(undo.undo('transform-1')).toEqual({ ok: true, operationId: 'transform-1' });
    expect(textarea.value).toBe('one blue two');
    expect(undo.recordCount).toBe(0);
  });

  it('never overwrites a later user edit', () => {
    const input = document.createElement('input');
    input.value = 'before';
    document.body.append(input);
    const adapter = new InputElementAdapter();
    const replacement = replace(adapter, input, 'after');
    const undo = new UndoService();
    expect(
      undo.register({
        adapter,
        operationId: 'transform-2',
        replacement,
        target: input
      })
    ).toBe(true);

    input.value = 'user changed this';

    expect(undo.undo('transform-2')).toEqual({ ok: false, reason: 'stale' });
    expect(input.value).toBe('user changed this');
    expect(undo.recordCount).toBe(0);
  });

  it('restores a contenteditable selection through the validated manual Undo path', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.textContent = 'one blue two';
    document.body.append(editor);
    const text = editor.firstChild ?? fail('expected text node');
    const range = document.createRange();
    range.setStart(text, 4);
    range.setEnd(text, 8);
    const selection = document.getSelection() ?? fail('expected selection');
    selection.removeAllRanges();
    selection.addRange(range);
    const adapter = new ContentEditableAdapter();
    const snapshot = adapter.capture(editor) ?? fail('expected a snapshot');
    const changed = adapter.replace(editor, snapshot, 'green', { preferNativeUndo: false });
    if (!changed.ok) {
      throw new Error(`replacement failed: ${changed.reason}`);
    }
    const undo = new UndoService();
    expect(
      undo.register({
        adapter,
        operationId: 'transform-contenteditable',
        replacement: changed.replacement,
        target: editor
      })
    ).toBe(true);

    expect(undo.undo('transform-contenteditable')).toEqual({
      ok: true,
      operationId: 'transform-contenteditable'
    });
    expect(editor.textContent).toBe('one blue two');
  });

  it('expires short-lived records and leaves the transformed value alone', () => {
    let now = 100;
    const input = document.createElement('input');
    input.value = 'before';
    document.body.append(input);
    const adapter = new InputElementAdapter();
    const replacement = replace(adapter, input, 'after');
    const undo = new UndoService({ now: () => now, ttlMs: 10 });
    expect(
      undo.register({
        adapter,
        operationId: 'transform-3',
        replacement,
        target: input
      })
    ).toBe(true);

    now = 111;

    expect(undo.undo('transform-3')).toEqual({ ok: false, reason: 'expired' });
    expect(input.value).toBe('after');
  });

  it('rejects registration when the post-replacement revision is already stale', () => {
    const input = document.createElement('input');
    input.value = 'before';
    document.body.append(input);
    const adapter = new InputElementAdapter();
    const replacement = replace(adapter, input, 'after');
    input.value = 'changed before registering';
    const undo = new UndoService();

    expect(
      undo.register({
        adapter,
        operationId: 'transform-4',
        replacement,
        target: input
      })
    ).toBe(false);
    expect(undo.undo('transform-4')).toEqual({ ok: false, reason: 'not-found' });
  });
});

function replace(
  adapter: InputElementAdapter | TextareaAdapter,
  target: HTMLInputElement | HTMLTextAreaElement,
  text: string
) {
  const snapshot = adapter.capture(target) ?? fail('expected a snapshot');
  const result = adapter.replace(target, snapshot, text);
  if (!result.ok) {
    throw new Error(`replacement failed: ${result.reason}`);
  }
  return result.replacement;
}

function fail(message: string): never {
  throw new Error(message);
}
