import { afterEach, describe, expect, it } from 'vitest';

import { InputAdapterRegistry } from '../input/input-adapter-registry.ts';

import { SelectionTracker } from './selection-tracker.ts';

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

describe('SelectionTracker', () => {
  it('tracks input selections as editable text instead of page text', () => {
    const input = document.createElement('input');
    input.value = 'one blue two';
    document.body.append(input);
    input.focus();
    input.setSelectionRange(4, 8);
    const changes: string[] = [];
    const tracker = new SelectionTracker(document, new InputAdapterRegistry(), (selection) => {
      changes.push(selection?.kind ?? 'none');
    });

    tracker.start();
    tracker.refresh();

    expect(tracker.current).toMatchObject({
      kind: 'editable',
      text: 'blue',
      target: { target: input }
    });
    expect(changes).toContain('editable');
  });

  it('tracks ordinary page selections without mutating the selected node', () => {
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Normal page selection';
    document.body.append(paragraph);
    const text = paragraph.firstChild ?? fail('expected text node');
    setSelection(text, 0, text, 6);
    const tracker = new SelectionTracker(document, new InputAdapterRegistry(), () => undefined);

    tracker.start();
    tracker.refresh();

    expect(tracker.current).toMatchObject({ kind: 'page', text: 'Normal' });
    expect(paragraph.textContent).toBe('Normal page selection');
  });

  it('does not reclassify a sensitive contenteditable selection as page text', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.setAttribute('aria-label', 'wallet seed phrase');
    editor.textContent = 'secret words';
    document.body.append(editor);
    const text = editor.firstChild ?? fail('expected text node');
    setSelection(text, 0, text, 6);
    const tracker = new SelectionTracker(document, new InputAdapterRegistry(), () => undefined);

    tracker.start();
    tracker.refresh();

    expect(tracker.current).toBeNull();
  });
});

function setSelection(startNode: Node, start: number, endNode: Node, end: number): void {
  const range = document.createRange();
  range.setStart(startNode, start);
  range.setEnd(endNode, end);
  const selection = document.getSelection() ?? fail('expected selection');
  selection.removeAllRanges();
  selection.addRange(range);
}

function fail(message: string): never {
  throw new Error(message);
}
