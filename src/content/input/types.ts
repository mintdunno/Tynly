/**
 * DOM-facing contracts for editor adapters. They deliberately contain no
 * provider, settings, or messaging details so editor quirks stay in content.
 */

export const MAX_EDITABLE_SNAPSHOT_CHARACTERS = 100_000;
export const MAX_EDITABLE_MARKUP_CHARACTERS = 200_000;

export interface InputTextRange {
  readonly start: number;
  readonly end: number;
}

/** A content and revision snapshot captured before a transform starts. */
export interface InputSnapshot {
  readonly revision: string;
  readonly selection: InputTextRange | null;
  readonly text: string;
}

export interface InputReplacementOptions {
  /**
   * Contenteditable adapters may use the browser's insert-text command when
   * possible. Undo uses false to keep its exact snapshot validation intact.
   */
  readonly preferNativeUndo?: boolean;
}

export interface InputReplacement {
  readonly after: InputSnapshot;
  readonly before: InputSnapshot;
  readonly nativeUndoAvailable: boolean;
  readonly originalText: string;
  readonly replacedRange: InputTextRange;
  readonly replacementText: string;
  /** The range occupied by replacementText in the post-replacement snapshot. */
  readonly undoRange: InputTextRange;
}

export type InputReplacementFailureReason =
  | 'disconnected'
  | 'interrupted'
  | 'invalid-replacement'
  | 'invalid-snapshot'
  | 'stale'
  | 'unsupported-target'
  | 'write-failed';

export type InputReplacementResult =
  | { readonly ok: true; readonly replacement: InputReplacement }
  | { readonly ok: false; readonly reason: InputReplacementFailureReason };

/**
 * An adapter is responsible only for one editor's DOM behavior. It never
 * contacts a provider or makes product decisions about the transform itself.
 */
export interface InputAdapter {
  readonly kind: 'contenteditable' | 'input' | 'textarea';

  canHandle(target: Element): boolean;
  capture(target: Element): InputSnapshot | null;
  replace(
    target: Element,
    snapshot: InputSnapshot,
    replacement: string,
    options?: InputReplacementOptions
  ): InputReplacementResult;
}

export function isInputSnapshot(value: unknown): value is InputSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.text === 'string' &&
    value.text.length <= MAX_EDITABLE_SNAPSHOT_CHARACTERS &&
    typeof value.revision === 'string' &&
    value.revision.length <= MAX_EDITABLE_MARKUP_CHARACTERS &&
    (value.selection === null || isInputTextRange(value.selection, value.text.length))
  );
}

export function isInputTextRange(value: unknown, maximum: number): value is InputTextRange {
  if (!isRecord(value)) {
    return false;
  }

  const start = value.start;
  const end = value.end;
  return (
    typeof start === 'number' &&
    typeof end === 'number' &&
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    end >= start &&
    end <= maximum
  );
}

/** Selection changes alone do not invalidate a pending transform or Undo record. */
export function hasSameInputRevision(left: InputSnapshot, right: InputSnapshot): boolean {
  return left.text === right.text && left.revision === right.revision;
}

export function getReplacementRange(snapshot: InputSnapshot): InputTextRange | null {
  if (!isInputSnapshot(snapshot)) {
    return null;
  }

  return snapshot.selection ?? { start: 0, end: snapshot.text.length };
}

export function buildReplacementText(
  snapshot: InputSnapshot,
  range: InputTextRange,
  replacement: unknown
): string | null {
  if (
    !isInputSnapshot(snapshot) ||
    !isInputTextRange(range, snapshot.text.length) ||
    typeof replacement !== 'string' ||
    replacement.length > MAX_EDITABLE_SNAPSHOT_CHARACTERS ||
    replacement.includes('\u0000')
  ) {
    return null;
  }

  const text = snapshot.text.slice(0, range.start) + replacement + snapshot.text.slice(range.end);
  return text.length <= MAX_EDITABLE_SNAPSHOT_CHARACTERS ? text : null;
}

/** Dispatch the single browser-standard event controlled input frameworks observe. */
export function dispatchReplacementInputEvent(target: Element, data: string): void {
  const view = target.ownerDocument.defaultView;
  const InputEventConstructor = view?.InputEvent;

  try {
    if (typeof InputEventConstructor === 'function') {
      target.dispatchEvent(
        new InputEventConstructor('input', {
          bubbles: true,
          composed: true,
          data,
          inputType: 'insertReplacementText'
        })
      );
      return;
    }
  } catch {
    // Older or test DOMs may expose a non-constructable InputEvent.
  }

  const EventConstructor = view?.Event ?? Event;
  target.dispatchEvent(new EventConstructor('input', { bubbles: true, composed: true }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
