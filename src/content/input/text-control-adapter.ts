import {
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

type TextControl = HTMLInputElement | HTMLTextAreaElement;

const SUPPORTED_INPUT_TYPES = new Set(['search', 'text']);

/** Adapter for plain text and search input elements. */
export class InputElementAdapter implements InputAdapter {
  readonly kind = 'input' as const;

  canHandle(target: Element): boolean {
    return isSupportedInputElement(target);
  }

  capture(target: Element): InputSnapshot | null {
    return isSupportedInputElement(target) ? captureTextControl(target) : null;
  }

  replace(
    target: Element,
    snapshot: InputSnapshot,
    replacement: string,
    _options?: InputReplacementOptions
  ): InputReplacementResult {
    return isSupportedInputElement(target)
      ? replaceTextControl(target, snapshot, replacement)
      : { ok: false, reason: 'unsupported-target' };
  }
}

/** Adapter for multiline textarea controls. */
export class TextareaAdapter implements InputAdapter {
  readonly kind = 'textarea' as const;

  canHandle(target: Element): boolean {
    return isTextAreaElement(target);
  }

  capture(target: Element): InputSnapshot | null {
    return isTextAreaElement(target) ? captureTextControl(target) : null;
  }

  replace(
    target: Element,
    snapshot: InputSnapshot,
    replacement: string,
    _options?: InputReplacementOptions
  ): InputReplacementResult {
    return isTextAreaElement(target)
      ? replaceTextControl(target, snapshot, replacement)
      : { ok: false, reason: 'unsupported-target' };
  }
}

function captureTextControl(control: TextControl): InputSnapshot | null {
  const text = control.value;
  if (text.length > MAX_EDITABLE_SNAPSHOT_CHARACTERS) {
    return null;
  }

  return {
    revision: text,
    selection: readTextControlSelection(control, text.length),
    text
  };
}

function isSupportedInputElement(target: Element): target is HTMLInputElement {
  return (
    target instanceof HTMLInputElement &&
    !target.disabled &&
    !target.readOnly &&
    SUPPORTED_INPUT_TYPES.has(target.type.toLowerCase())
  );
}

function isTextAreaElement(target: Element): target is HTMLTextAreaElement {
  return target instanceof HTMLTextAreaElement && !target.disabled && !target.readOnly;
}

function replaceTextControl(
  control: TextControl,
  snapshot: InputSnapshot,
  replacement: string
): InputReplacementResult {
  if (!control.isConnected) {
    return { ok: false, reason: 'disconnected' };
  }
  if (!isInputSnapshot(snapshot) || snapshot.revision !== snapshot.text) {
    return { ok: false, reason: 'invalid-snapshot' };
  }

  const range = getReplacementRange(snapshot);
  const nextText = range === null ? null : buildReplacementText(snapshot, range, replacement);
  if (range === null || nextText === null) {
    return { ok: false, reason: 'invalid-replacement' };
  }

  const current = captureTextControl(control);
  if (current === null || !hasSameInputRevision(current, snapshot)) {
    return { ok: false, reason: 'stale' };
  }

  if (!setNativeControlValue(control, nextText)) {
    return { ok: false, reason: 'write-failed' };
  }

  const undoRange = {
    start: range.start,
    end: range.start + replacement.length
  };
  setTextControlSelection(control, undoRange.end);
  dispatchReplacementInputEvent(control, replacement);

  const after = captureTextControl(control);
  if (after === null || after.text !== nextText) {
    return { ok: false, reason: 'interrupted' };
  }

  return {
    ok: true,
    replacement: {
      after,
      before: snapshot,
      nativeUndoAvailable: false,
      originalText: snapshot.text.slice(range.start, range.end),
      replacedRange: range,
      replacementText: replacement,
      undoRange
    }
  };
}

/**
 * Invoking the native prototype setter bypasses framework-installed own value
 * descriptors. Dispatching input afterward lets React-like controlled inputs
 * observe the change through their normal event path.
 */
function setNativeControlValue(control: TextControl, value: string): boolean {
  const prototype =
    control instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  const setter = descriptor?.set;
  if (setter === undefined) {
    return false;
  }

  try {
    setter.call(control, value);
    return true;
  } catch {
    return false;
  }
}

function readTextControlSelection(control: TextControl, maximum: number): InputTextRange | null {
  const start = control.selectionStart;
  const end = control.selectionEnd;
  if (
    start === null ||
    end === null ||
    start < 0 ||
    end < start ||
    end > maximum ||
    start === end
  ) {
    return null;
  }

  return { start, end };
}

function setTextControlSelection(control: TextControl, position: number): void {
  try {
    control.setSelectionRange(position, position);
  } catch {
    // The value change is still valid when a browser refuses selection updates.
  }
}
