import { afterEach, describe, expect, it } from 'vitest';

import { ContentEditableAdapter, findContentEditableHost } from './contenteditable-adapter.ts';

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

describe('ContentEditableAdapter', () => {
  it('captures and replaces a selected text range without injecting provider text as HTML', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.innerHTML = 'Hello <strong>brave</strong> world';
    document.body.append(editor);
    const brave = editor.querySelector('strong')?.firstChild ?? fail('expected selected text');
    setSelection(brave, 0, brave, 5);
    const events: Event[] = [];
    editor.addEventListener('input', (event) => events.push(event));

    const adapter = new ContentEditableAdapter();
    const snapshot = adapter.capture(editor);
    const result = adapter.replace(
      editor,
      snapshot ?? fail('expected a snapshot'),
      '<safe & rewritten>'
    );

    expect(result).toMatchObject({
      ok: true,
      replacement: {
        originalText: 'brave',
        replacedRange: { start: 6, end: 11 },
        undoRange: { start: 6, end: 24 }
      }
    });
    expect(editor.textContent).toBe('Hello <safe & rewritten> world');
    expect(editor.querySelector('safe')).toBeNull();
    expect(events).toHaveLength(1);
  });

  it('uses a whole-editor replacement when selection is collapsed', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'plaintext-only';
    editor.textContent = 'Original text';
    document.body.append(editor);
    const text = editor.firstChild ?? fail('expected text node');
    setSelection(text, 2, text, 2);

    const adapter = new ContentEditableAdapter();
    const snapshot = adapter.capture(editor);
    const result = adapter.replace(editor, snapshot ?? fail('expected a snapshot'), 'Rewritten');

    expect(result).toMatchObject({
      ok: true,
      replacement: { originalText: 'Original text', replacedRange: { start: 0, end: 13 } }
    });
    expect(editor.textContent).toBe('Rewritten');
  });

  it('keeps visual line breaks in a whole-editor snapshot', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.innerHTML = 'First<br>Second<div>Third</div>';
    document.body.append(editor);
    const firstText = editor.firstChild ?? fail('expected text node');
    setSelection(firstText, 1, firstText, 1);

    const adapter = new ContentEditableAdapter();
    const snapshot = adapter.capture(editor);
    const result = adapter.replace(editor, snapshot ?? fail('expected a snapshot'), 'One\nTwo');

    expect(snapshot).toMatchObject({ selection: null, text: 'First\nSecond\nThird' });
    expect(result).toMatchObject({ ok: true });
    expect(editor.textContent).toBe('One\nTwo');
  });

  it('prefers the browser insert-text command when it successfully applies the edit', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.textContent = 'before';
    document.body.append(editor);
    const text = editor.firstChild ?? fail('expected text node');
    setSelection(text, 0, text, 6);
    const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value(command: string, _showUi: boolean, value: string) {
        if (command !== 'insertText') {
          return false;
        }
        const range = document.getSelection()?.getRangeAt(0) ?? fail('expected selection range');
        range.deleteContents();
        range.insertNode(document.createTextNode(value));
        return true;
      }
    });

    try {
      const adapter = new ContentEditableAdapter();
      const snapshot = adapter.capture(editor);
      const result = adapter.replace(editor, snapshot ?? fail('expected a snapshot'), 'after');

      expect(result).toMatchObject({
        ok: true,
        replacement: { nativeUndoAvailable: true }
      });
      expect(editor.textContent).toBe('after');
    } finally {
      if (originalDescriptor === undefined) {
        delete (document as { execCommand?: unknown }).execCommand;
      } else {
        Object.defineProperty(document, 'execCommand', originalDescriptor);
      }
    }
  });

  it('rejects stale markup even when the editor text happens to be unchanged', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.textContent = 'same text';
    document.body.append(editor);
    const adapter = new ContentEditableAdapter();
    const snapshot = adapter.capture(editor);
    editor.innerHTML = '<em>same text</em>';

    expect(adapter.replace(editor, snapshot ?? fail('expected a snapshot'), 'replacement')).toEqual(
      {
        ok: false,
        reason: 'stale'
      }
    );
    expect(editor.textContent).toBe('same text');
  });

  it('normalizes nested contenteditable targets and excludes aria-readonly hosts', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    const child = document.createElement('span');
    child.textContent = 'inside';
    editor.append(child);
    document.body.append(editor);

    expect(findContentEditableHost(child)).toBe(editor);

    editor.setAttribute('aria-readonly', 'TRUE');
    const adapter = new ContentEditableAdapter();
    expect(adapter.canHandle(editor)).toBe(false);
    expect(adapter.capture(editor)).toBeNull();
  });
});

function setSelection(startNode: Node, start: number, endNode: Node, end: number): void {
  const range = document.createRange();
  range.setStart(startNode, start);
  range.setEnd(endNode, end);
  const selection = document.getSelection() ?? fail('expected a selection object');
  selection.removeAllRanges();
  selection.addRange(range);
}

function fail(message: string): never {
  throw new Error(message);
}
