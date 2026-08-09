import { InputAdapterRegistry } from './input/input-adapter-registry.ts';
import type { InputAdapter, InputSnapshot } from './input/types.ts';
import type { ViewportAnchor } from './selection/selection-tracker.ts';
import { UndoService, type UndoResult } from './undo/undo-service.ts';
import type { ContentTransformResponse } from './content-message-client.ts';
import { AppError, serializeAppError, type SerializedAppError } from '../shared/errors/index.ts';
import {
  acceptTransformResult,
  type TransformResultRejectionReason
} from '../core/transform/response-guard.ts';
import {
  validateTransformInput,
  type TransformInputLimitReason
} from '../core/transform/limits.ts';
import { OperationRegistry } from '../core/transform/operation-registry.ts';
import type { TransformTrigger } from '../core/transform/types.ts';

export type EditableTransformMode = 'preview' | 'replace';

export interface ContentTransformClient {
  cancel(operationId: string): Promise<void>;
  transform(
    operationId: string,
    text: string,
    trigger: TransformTrigger
  ): Promise<ContentTransformResponse>;
}

export interface EditablePreviewPresentation {
  readonly operationId: string;
  readonly target: Element;
  readonly text: string;
}

export interface PageResultPresentation {
  readonly anchor: ViewportAnchor;
  readonly operationId: string;
  readonly text: string;
}

export interface ReplacementPresentation {
  readonly operationId: string;
  readonly target: Element;
  readonly undoAvailable: boolean;
}

/** A page-facing presenter receives only already-sanitized text and safe errors. */
export interface TransformPresentation {
  onEditablePreview(result: EditablePreviewPresentation): void;
  onError(error: SerializedAppError): void;
  onInputRejected(reason: TransformInputLimitReason): void;
  onLoading(operationId: string, loading: boolean): void;
  onPageResult(result: PageResultPresentation): void;
  onReplacement(result: ReplacementPresentation): void;
}

export interface TransformControllerOptions {
  readonly adapters?: InputAdapterRegistry;
  readonly operations?: OperationRegistry;
  readonly undo?: UndoService;
}

interface PendingEditableTransform {
  readonly adapter: InputAdapter;
  readonly operationId: string;
  readonly scopeId: string;
  readonly showUndoNotification: boolean;
  readonly snapshot: InputSnapshot;
  readonly target: Element;
  readonly text: string;
}

const PAGE_SELECTION_SCOPE = 'page-selection';

/**
 * One controller owns all content-side transform paths. It captures a bounded
 * editor snapshot, sends the credential-free request, discards stale results,
 * and delegates DOM replacement to the matching input adapter.
 */
export class TransformController {
  private readonly adapters: InputAdapterRegistry;
  private readonly latestOperationByScope = new Map<string, string>();
  private readonly operations: OperationRegistry;
  private readonly pendingEditableByScope = new Map<string, PendingEditableTransform>();
  private readonly scopeByTarget = new WeakMap<Element, string>();
  private readonly undo: UndoService;
  private scopeCounter = 0;

  constructor(
    private readonly messages: ContentTransformClient,
    private readonly presentation: TransformPresentation,
    options: TransformControllerOptions = {}
  ) {
    this.adapters = options.adapters ?? new InputAdapterRegistry();
    this.operations = options.operations ?? new OperationRegistry();
    this.undo = options.undo ?? new UndoService();
  }

  startEditable(
    target: Element,
    trigger: TransformTrigger,
    mode: EditableTransformMode,
    showUndoNotification: boolean
  ): boolean {
    const resolved = this.adapters.resolve(target);
    if (resolved === null) {
      return false;
    }

    const snapshot = resolved.adapter.capture(resolved.target);
    if (snapshot === null) {
      return false;
    }
    const text = readTransformText(snapshot);
    const inputLimit = validateTransformInput(text);
    if (!inputLimit.ok) {
      this.presentation.onInputRejected(inputLimit.reason);
      return false;
    }

    const scopeId = this.scopeFor(resolved.target);
    const operation = this.beginOperation(scopeId);
    const pending: PendingEditableTransform = {
      adapter: resolved.adapter,
      operationId: operation.operationId,
      scopeId,
      showUndoNotification,
      snapshot,
      target: resolved.target,
      text
    };
    this.presentation.onLoading(operation.operationId, true);
    void this.runEditable(pending, trigger, mode);
    return true;
  }

  startPageSelection(
    text: string,
    trigger: Extract<TransformTrigger, 'selection-button' | 'shortcut'>,
    anchor: ViewportAnchor
  ): boolean {
    const inputLimit = validateTransformInput(text);
    if (!inputLimit.ok) {
      this.presentation.onInputRejected(inputLimit.reason);
      return false;
    }

    const operation = this.beginOperation(PAGE_SELECTION_SCOPE);
    this.presentation.onLoading(operation.operationId, true);
    void this.runPageSelection(PAGE_SELECTION_SCOPE, operation.operationId, text, trigger, anchor);
    return true;
  }

  /** Applies a still-current preview result, revalidating the target revision. */
  applyPreview(operationId: string): boolean {
    const pending = findPendingByOperationId(this.pendingEditableByScope, operationId);
    if (pending === undefined || !this.isLatest(pending.scopeId, operationId)) {
      return false;
    }
    this.pendingEditableByScope.delete(pending.scopeId);
    return this.applyEditable(pending);
  }

  undoLast(operationId?: string): UndoResult {
    return this.undo.undo(operationId);
  }

  cancelTarget(target: Element): boolean {
    return this.cancelScope(this.scopeByTarget.get(target));
  }

  cancelPageSelection(): boolean {
    return this.cancelScope(PAGE_SELECTION_SCOPE);
  }

  /** Stops pending requests and discards unapplied previews during teardown. */
  cancelAll(): void {
    const scopes = new Set([
      ...this.latestOperationByScope.keys(),
      ...this.pendingEditableByScope.keys()
    ]);
    for (const scopeId of scopes) {
      this.cancelScope(scopeId);
    }
    this.pendingEditableByScope.clear();
  }

  private async runEditable(
    pending: PendingEditableTransform,
    trigger: TransformTrigger,
    mode: EditableTransformMode
  ): Promise<void> {
    const response = await this.requestTransform(
      pending.scopeId,
      pending.operationId,
      pending.text,
      trigger
    );
    if (response === null) {
      return;
    }
    if (response.kind === 'error') {
      this.finishWithError(pending.scopeId, pending.operationId, response.error);
      return;
    }

    const accepted = acceptTransformResult(
      this.operations,
      pending.scopeId,
      pending.operationId,
      response.text
    );
    if (!accepted.ok) {
      this.finishRejected(pending.scopeId, pending.operationId, accepted.reason);
      return;
    }

    this.finishLoading(pending.scopeId, pending.operationId);
    const result = { ...pending, text: accepted.result.text };
    if (mode === 'preview') {
      this.pendingEditableByScope.set(pending.scopeId, result);
      this.presentation.onEditablePreview({
        operationId: result.operationId,
        target: result.target,
        text: result.text
      });
      return;
    }
    this.applyEditable(result);
  }

  private async runPageSelection(
    scopeId: string,
    operationId: string,
    text: string,
    trigger: Extract<TransformTrigger, 'selection-button' | 'shortcut'>,
    anchor: ViewportAnchor
  ): Promise<void> {
    const response = await this.requestTransform(scopeId, operationId, text, trigger);
    if (response === null) {
      return;
    }
    if (response.kind === 'error') {
      this.finishWithError(scopeId, operationId, response.error);
      return;
    }

    const accepted = acceptTransformResult(this.operations, scopeId, operationId, response.text);
    if (!accepted.ok) {
      this.finishRejected(scopeId, operationId, accepted.reason);
      return;
    }

    this.finishLoading(scopeId, operationId);
    this.presentation.onPageResult({ anchor, operationId, text: accepted.result.text });
  }

  private async requestTransform(
    scopeId: string,
    operationId: string,
    text: string,
    trigger: TransformTrigger
  ): Promise<ContentTransformResponse | null> {
    try {
      const response = await this.messages.transform(operationId, text, trigger);
      if (!this.isLatest(scopeId, operationId)) {
        return null;
      }
      if (response === null) {
        this.finishWithError(scopeId, operationId, safeError('NETWORK'));
        return null;
      }
      return response;
    } catch {
      if (!this.isLatest(scopeId, operationId)) {
        return null;
      }
      this.finishWithError(scopeId, operationId, safeError('NETWORK'));
      return null;
    }
  }

  private applyEditable(pending: PendingEditableTransform): boolean {
    if (!this.isLatest(pending.scopeId, pending.operationId)) {
      return false;
    }

    const applied = pending.adapter.replace(pending.target, pending.snapshot, pending.text);
    if (!applied.ok) {
      return false;
    }

    const undoAvailable = this.undo.register({
      adapter: pending.adapter,
      operationId: pending.operationId,
      replacement: applied.replacement,
      target: pending.target
    });
    this.presentation.onReplacement({
      operationId: pending.operationId,
      target: pending.target,
      undoAvailable: undoAvailable && pending.showUndoNotification
    });
    return true;
  }

  private beginOperation(scopeId: string) {
    this.pendingEditableByScope.delete(scopeId);
    const operation = this.operations.start(scopeId);
    this.latestOperationByScope.set(scopeId, operation.operationId);
    operation.signal.addEventListener(
      'abort',
      () => {
        void this.messages.cancel(operation.operationId).catch(() => undefined);
      },
      { once: true }
    );
    return operation;
  }

  private cancelScope(scopeId: string | undefined): boolean {
    if (scopeId === undefined) {
      return false;
    }
    const operationId = this.latestOperationByScope.get(scopeId);
    if (operationId === undefined || !this.operations.cancel(scopeId, operationId)) {
      return false;
    }
    this.pendingEditableByScope.delete(scopeId);
    this.presentation.onLoading(operationId, false);
    return true;
  }

  private finishWithError(scopeId: string, operationId: string, error: SerializedAppError): void {
    if (!this.isLatest(scopeId, operationId) || !this.operations.consume(scopeId, operationId)) {
      return;
    }
    this.finishLoading(scopeId, operationId);
    this.presentation.onError(error);
  }

  private finishRejected(
    scopeId: string,
    operationId: string,
    reason: TransformResultRejectionReason
  ): void {
    if (!this.isLatest(scopeId, operationId)) {
      return;
    }
    this.finishLoading(scopeId, operationId);
    if (reason !== 'stale') {
      this.presentation.onError(safeError('INVALID_RESPONSE'));
    }
  }

  private finishLoading(scopeId: string, operationId: string): void {
    if (this.isLatest(scopeId, operationId)) {
      this.presentation.onLoading(operationId, false);
    }
  }

  private isLatest(scopeId: string, operationId: string): boolean {
    return this.latestOperationByScope.get(scopeId) === operationId;
  }

  private scopeFor(target: Element): string {
    const existing = this.scopeByTarget.get(target);
    if (existing !== undefined) {
      return existing;
    }
    this.scopeCounter += 1;
    const scopeId = `editor:${this.scopeCounter}`;
    this.scopeByTarget.set(target, scopeId);
    return scopeId;
  }
}

function readTransformText(snapshot: InputSnapshot): string {
  const selection = snapshot.selection;
  return selection === null ? snapshot.text : snapshot.text.slice(selection.start, selection.end);
}

function findPendingByOperationId(
  pendingByScope: ReadonlyMap<string, PendingEditableTransform>,
  operationId: string
): PendingEditableTransform | undefined {
  for (const pending of pendingByScope.values()) {
    if (pending.operationId === operationId) {
      return pending;
    }
  }
  return undefined;
}

function safeError(code: 'CONFIGURATION' | 'INVALID_RESPONSE' | 'NETWORK'): SerializedAppError {
  return serializeAppError(new AppError(code));
}
