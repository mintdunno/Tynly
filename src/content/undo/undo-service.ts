import {
  hasSameInputRevision,
  isInputSnapshot,
  isInputTextRange,
  type InputAdapter,
  type InputReplacement,
  type InputSnapshot
} from '../input/types.ts';

export const UNDO_RECORD_TTL_MS = 5 * 60_000;
export const MAX_UNDO_RECORDS = 8;

const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;

export interface UndoRegistration {
  readonly adapter: InputAdapter;
  readonly operationId: string;
  readonly replacement: InputReplacement;
  readonly target: Element;
}

export interface UndoRecord extends UndoRegistration {
  readonly timestamp: number;
}

export type UndoResult =
  | { readonly ok: true; readonly operationId: string }
  | {
      readonly ok: false;
      readonly reason: 'expired' | 'failed' | 'not-found' | 'stale';
    };

export interface UndoServiceOptions {
  readonly now?: () => number;
  readonly ttlMs?: number;
}

/**
 * Stores short-lived, in-memory undo records. It validates the complete
 * post-transform revision immediately before restoring text, so Undo cannot
 * replace later user edits. Browser-native history remains available where an
 * adapter used it; this explicit action favors deterministic validation.
 */
export class UndoService {
  private readonly now: () => number;
  private readonly records = new Map<string, UndoRecord>();
  private readonly ttlMs: number;

  constructor(options: UndoServiceOptions = {}) {
    this.now = options.now ?? Date.now;
    this.ttlMs = normalizeTtl(options.ttlMs);
  }

  get recordCount(): number {
    this.removeExpiredRecords();
    return this.records.size;
  }

  register(registration: UndoRegistration): boolean {
    this.removeExpiredRecords();
    if (!isValidRegistration(registration) || !registration.target.isConnected) {
      return false;
    }

    const current = registration.adapter.capture(registration.target);
    if (current === null || !hasSameInputRevision(current, registration.replacement.after)) {
      return false;
    }

    const timestamp = this.now();
    if (!Number.isFinite(timestamp)) {
      return false;
    }

    this.records.delete(registration.operationId);
    this.records.set(registration.operationId, { ...registration, timestamp });
    this.trimToCapacity();
    return true;
  }

  undo(operationId?: string): UndoResult {
    const record =
      operationId === undefined ? this.getNewestRecord() : this.records.get(operationId);
    if (record === undefined) {
      return { ok: false, reason: 'not-found' };
    }
    if (this.isExpired(record)) {
      this.records.delete(record.operationId);
      return { ok: false, reason: 'expired' };
    }

    const current = record.adapter.capture(record.target);
    if (current === null || !hasSameInputRevision(current, record.replacement.after)) {
      this.records.delete(record.operationId);
      return { ok: false, reason: 'stale' };
    }

    const restoreSnapshot: InputSnapshot = {
      revision: record.replacement.after.revision,
      selection: record.replacement.undoRange,
      text: record.replacement.after.text
    };
    const restored = record.adapter.replace(
      record.target,
      restoreSnapshot,
      record.replacement.originalText,
      { preferNativeUndo: false }
    );
    this.records.delete(record.operationId);

    if (!restored.ok || restored.replacement.after.text !== record.replacement.before.text) {
      return { ok: false, reason: 'failed' };
    }
    return { ok: true, operationId: record.operationId };
  }

  clear(operationId?: string): void {
    if (operationId === undefined) {
      this.records.clear();
      return;
    }
    this.records.delete(operationId);
  }

  private getNewestRecord(): UndoRecord | undefined {
    let newest: UndoRecord | undefined;
    for (const record of this.records.values()) {
      if (newest === undefined || record.timestamp >= newest.timestamp) {
        newest = record;
      }
    }
    return newest;
  }

  private isExpired(record: UndoRecord): boolean {
    return this.now() - record.timestamp > this.ttlMs;
  }

  private removeExpiredRecords(): void {
    for (const record of this.records.values()) {
      if (this.isExpired(record)) {
        this.records.delete(record.operationId);
      }
    }
  }

  private trimToCapacity(): void {
    while (this.records.size > MAX_UNDO_RECORDS) {
      const oldest = this.records.values().next().value as UndoRecord | undefined;
      if (oldest === undefined) {
        return;
      }
      this.records.delete(oldest.operationId);
    }
  }
}

function isValidRegistration(value: unknown): value is UndoRegistration {
  if (!isRecord(value)) {
    return false;
  }

  const operationId = value.operationId;
  const target = value.target;
  const adapter = value.adapter;
  const replacement = value.replacement;
  if (
    !isOperationId(operationId) ||
    !(target instanceof Element) ||
    !isInputAdapter(adapter) ||
    !adapter.canHandle(target) ||
    !isInputReplacement(replacement)
  ) {
    return false;
  }

  const expectedAfter =
    replacement.before.text.slice(0, replacement.replacedRange.start) +
    replacement.replacementText +
    replacement.before.text.slice(replacement.replacedRange.end);
  return (
    expectedAfter === replacement.after.text &&
    replacement.after.text.slice(replacement.undoRange.start, replacement.undoRange.end) ===
      replacement.replacementText
  );
}

function isInputReplacement(value: unknown): value is InputReplacement {
  if (!isRecord(value)) {
    return false;
  }

  const before = value.before;
  const after = value.after;
  const replacedRange = value.replacedRange;
  const undoRange = value.undoRange;
  const originalText = value.originalText;
  const replacementText = value.replacementText;
  const nativeUndoAvailable = value.nativeUndoAvailable;
  return (
    isInputSnapshot(before) &&
    isInputSnapshot(after) &&
    isInputTextRange(replacedRange, before.text.length) &&
    isInputTextRange(undoRange, after.text.length) &&
    typeof originalText === 'string' &&
    typeof replacementText === 'string' &&
    typeof nativeUndoAvailable === 'boolean' &&
    originalText === before.text.slice(replacedRange.start, replacedRange.end)
  );
}

function isInputAdapter(value: unknown): value is InputAdapter {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as InputAdapter).canHandle === 'function' &&
    typeof (value as InputAdapter).capture === 'function' &&
    typeof (value as InputAdapter).replace === 'function'
  );
}

function isOperationId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    OPERATION_ID_PATTERN.test(value)
  );
}

function normalizeTtl(value: number | undefined): number {
  if (value === undefined) {
    return UNDO_RECORD_TTL_MS;
  }
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : UNDO_RECORD_TTL_MS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
