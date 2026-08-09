import {
  MAX_EDITABLE_MARKUP_CHARACTERS,
  MAX_EDITABLE_SNAPSHOT_CHARACTERS,
  buildReplacementText,
  dispatchReplacementInputEvent,
  getReplacementRange,
  hasSameInputRevision,
  isInputSnapshot,
  type InputAdapter,
  type InputReplacementOptions,
  type InputReplacementResult,
  type InputSnapshot,
  type InputTextRange
} from './types.ts';

const BLOCK_TEXT_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DIV',
  'DL',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TBODY',
  'TD',
  'TH',
  'THEAD',
  'TR',
  'UL'
]);

/** Adapter for a declared contenteditable host, not any arbitrary descendant. */
export class ContentEditableAdapter implements InputAdapter {
  readonly kind = 'contenteditable' as const;

  canHandle(target: Element): boolean {
    return isContentEditableHost(target);
  }

  capture(target: Element): InputSnapshot | null {
    return isContentEditableHost(target) ? captureContentEditable(target) : null;
  }

  replace(
    target: Element,
    snapshot: InputSnapshot,
    replacement: string,
    options: InputReplacementOptions = {}
  ): InputReplacementResult {
    if (!isContentEditableHost(target)) {
      return { ok: false, reason: 'unsupported-target' };
    }
    if (!target.isConnected) {
      return { ok: false, reason: 'disconnected' };
    }
    if (!isInputSnapshot(snapshot)) {
      return { ok: false, reason: 'invalid-snapshot' };
    }

    const range = getReplacementRange(snapshot);
    const nextText = range === null ? null : buildReplacementText(snapshot, range, replacement);
    if (range === null || nextText === null) {
      return { ok: false, reason: 'invalid-replacement' };
    }

    const current = captureContentEditable(target);
    if (current === null || !hasSameInputRevision(current, snapshot)) {
      return { ok: false, reason: 'stale' };
    }

    const nativeResult =
      options.preferNativeUndo === false
        ? 'not-attempted'
        : tryNativeTextInsertion(
            target,
            range,
            replacement,
            snapshot.selection === null,
            snapshot.text,
            nextText
          );
    if (nativeResult === 'changed-unexpectedly') {
      return { ok: false, reason: 'interrupted' };
    }

    const nativeUndoAvailable = nativeResult === 'applied';
    if (
      !nativeUndoAvailable &&
      !replaceWithTextNode(target, range, replacement, snapshot.selection === null)
    ) {
      return { ok: false, reason: 'write-failed' };
    }
    if (!nativeUndoAvailable) {
      dispatchReplacementInputEvent(target, replacement);
    }

    const after = captureContentEditable(target);
    if (after === null || after.text !== nextText) {
      return { ok: false, reason: 'interrupted' };
    }

    return {
      ok: true,
      replacement: {
        after,
        before: snapshot,
        nativeUndoAvailable,
        originalText: snapshot.text.slice(range.start, range.end),
        replacedRange: range,
        replacementText: replacement,
        undoRange: { start: range.start, end: range.start + replacement.length }
      }
    };
  }
}

/** Finds the declared editing host for a focused nested node, if any. */
export function findContentEditableHost(target: Element): HTMLElement | null {
  let current: HTMLElement | null = target instanceof HTMLElement ? target : null;
  while (current !== null) {
    const value = current.getAttribute('contenteditable')?.trim().toLowerCase();
    if (value === 'false') {
      return null;
    }
    if (value === '' || value === 'plaintext-only' || value === 'true') {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function isContentEditableHost(target: Element): target is HTMLElement {
  return (
    target instanceof HTMLElement &&
    !hasTrueAriaState(target, 'aria-readonly') &&
    !hasTrueAriaState(target, 'aria-disabled') &&
    findContentEditableHost(target) === target
  );
}

function hasTrueAriaState(target: HTMLElement, name: 'aria-disabled' | 'aria-readonly'): boolean {
  return target.getAttribute(name)?.trim().toLowerCase() === 'true';
}

function captureContentEditable(target: HTMLElement): InputSnapshot | null {
  const text = readContentEditableText(target);
  const revision = target.innerHTML;
  if (
    text.length > MAX_EDITABLE_SNAPSHOT_CHARACTERS ||
    revision.length > MAX_EDITABLE_MARKUP_CHARACTERS
  ) {
    return null;
  }

  return {
    revision,
    selection:
      text === (target.textContent ?? '')
        ? readContentEditableSelection(target, text.length)
        : null,
    text
  };
}

function readContentEditableSelection(target: HTMLElement, maximum: number): InputTextRange | null {
  const selection = target.ownerDocument.getSelection();
  if (selection === null || selection.rangeCount !== 1 || selection.isCollapsed) {
    return null;
  }

  let range: Range;
  try {
    range = selection.getRangeAt(0);
  } catch {
    return null;
  }
  if (!rangeIsInsideTarget(target, range)) {
    return null;
  }

  const start = readTextOffset(target, range.startContainer, range.startOffset);
  const end = readTextOffset(target, range.endContainer, range.endOffset);
  if (start === null || end === null || start >= end || end > maximum) {
    return null;
  }
  return { start, end };
}

function tryNativeTextInsertion(
  target: HTMLElement,
  range: InputTextRange,
  replacement: string,
  wholeTarget: boolean,
  beforeText: string,
  expectedText: string
): 'applied' | 'changed-unexpectedly' | 'not-attempted' {
  const command = target.ownerDocument.execCommand;
  const selection = target.ownerDocument.getSelection();
  const domRange = wholeTarget ? createWholeTargetRange(target) : createTextRange(target, range);
  if (typeof command !== 'function' || selection === null || domRange === null) {
    return 'not-attempted';
  }

  try {
    selection.removeAllRanges();
    selection.addRange(domRange);
    const applied = command.call(target.ownerDocument, 'insertText', false, replacement);
    const currentText = readContentEditableText(target);
    if (applied && currentText === expectedText) {
      return 'applied';
    }
    return currentText === beforeText ? 'not-attempted' : 'changed-unexpectedly';
  } catch {
    return readContentEditableText(target) === beforeText
      ? 'not-attempted'
      : 'changed-unexpectedly';
  }
}

function replaceWithTextNode(
  target: HTMLElement,
  range: InputTextRange,
  replacement: string,
  wholeTarget: boolean
): boolean {
  const document = target.ownerDocument;
  if (wholeTarget) {
    try {
      const textNode = document.createTextNode(replacement);
      target.replaceChildren(textNode);
      setContentEditableCaret(target, textNode, replacement.length);
      return true;
    } catch {
      return false;
    }
  }

  const domRange = createTextRange(target, range);
  if (domRange === null) {
    return false;
  }

  try {
    domRange.deleteContents();
    const textNode = document.createTextNode(replacement);
    domRange.insertNode(textNode);
    setContentEditableCaret(target, textNode, replacement.length);
    return true;
  } catch {
    return false;
  }
}

function createWholeTargetRange(target: HTMLElement): Range | null {
  try {
    const range = target.ownerDocument.createRange();
    range.selectNodeContents(target);
    return range;
  } catch {
    return null;
  }
}

function createTextRange(target: HTMLElement, range: InputTextRange): Range | null {
  const text = target.textContent ?? '';
  if (range.start < 0 || range.end < range.start || range.end > text.length) {
    return null;
  }

  const document = target.ownerDocument;
  const domRange = document.createRange();
  if (range.start === 0 && range.end === text.length) {
    try {
      domRange.selectNodeContents(target);
      return domRange;
    } catch {
      return null;
    }
  }

  const start = findTextBoundary(target, range.start);
  const end = findTextBoundary(target, range.end);
  if (start === null || end === null) {
    return null;
  }

  try {
    domRange.setStart(start.node, start.offset);
    domRange.setEnd(end.node, end.offset);
    return domRange;
  } catch {
    return null;
  }
}

function findTextBoundary(
  target: HTMLElement,
  position: number
): { readonly node: Text; readonly offset: number } | null {
  const textNodes: Text[] = [];
  collectTextNodes(target, textNodes);
  if (textNodes.length === 0) {
    return null;
  }

  let consumed = 0;
  for (const node of textNodes) {
    const next = consumed + node.data.length;
    if (position <= next) {
      return { node, offset: position - consumed };
    }
    consumed = next;
  }

  return null;
}

function collectTextNodes(node: Node, output: Text[]): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) {
      output.push(child as Text);
    } else {
      collectTextNodes(child, output);
    }
  }
}

/**
 * textContent drops visual line breaks from <br> and block containers. Keep a
 * compact, deterministic plaintext representation for whole-editor transforms.
 * Selected replacements stay enabled only where textContent has the same model,
 * avoiding an unsafe offset conversion for richer editors.
 */
function readContentEditableText(target: HTMLElement): string {
  const output: EditableTextOutput = { length: 0, parts: [] };
  appendEditableChildren(target, output);
  return output.parts.join('');
}

function appendEditableChildren(parent: Node, output: EditableTextOutput): void {
  let previousProducedText = false;
  let previousWasBlock = false;

  for (const child of Array.from(parent.childNodes)) {
    const isBreak = child instanceof HTMLBRElement;
    const isBlock = child instanceof HTMLElement && BLOCK_TEXT_TAGS.has(child.tagName);
    if (
      previousProducedText &&
      !isBreak &&
      (isBlock || previousWasBlock) &&
      !endsWithLineBreak(output)
    ) {
      appendEditableText(output, '\n');
    }

    const lengthBefore = output.length;
    if (child.nodeType === 3) {
      appendEditableText(output, child.textContent ?? '');
    } else if (isBreak) {
      if (!endsWithLineBreak(output)) {
        appendEditableText(output, '\n');
      }
    } else {
      appendEditableChildren(child, output);
    }

    const producedText = output.length > lengthBefore;
    previousProducedText ||= producedText;
    previousWasBlock = isBlock && producedText;
  }
}

function appendEditableText(output: EditableTextOutput, value: string): void {
  if (value.length === 0) {
    return;
  }
  output.parts.push(value);
  output.length += value.length;
}

function endsWithLineBreak(output: EditableTextOutput): boolean {
  return output.parts.at(-1)?.endsWith('\n') ?? false;
}

interface EditableTextOutput {
  readonly parts: string[];
  length: number;
}

function readTextOffset(target: HTMLElement, container: Node, offset: number): number | null {
  if (!containsNode(target, container)) {
    return null;
  }

  try {
    const range = target.ownerDocument.createRange();
    range.selectNodeContents(target);
    range.setEnd(container, offset);
    return range.toString().length;
  } catch {
    return null;
  }
}

function rangeIsInsideTarget(target: HTMLElement, range: Range): boolean {
  return containsNode(target, range.startContainer) && containsNode(target, range.endContainer);
}

function containsNode(target: HTMLElement, node: Node): boolean {
  return node === target || target.contains(node);
}

function setContentEditableCaret(target: HTMLElement, node: Text, offset: number): void {
  const selection = target.ownerDocument.getSelection();
  if (selection === null) {
    return;
  }

  try {
    const range = target.ownerDocument.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  } catch {
    // Selection placement is optional after a successful replacement.
  }
}
