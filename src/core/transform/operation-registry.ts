/**
 * Tracks the latest transform request for each stable editor or selection
 * scope. The registry has no knowledge of providers, DOM targets, or UI.
 */
export const MAX_OPERATION_ID_LENGTH = 128;

const MAX_OPERATION_SCOPE_ID_LENGTH = 256;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;

/** Factory injection keeps operation IDs deterministic in unit tests. */
export type OperationIdFactory = () => string;

/**
 * A capability held by the caller that started a transform operation. Its
 * signal is aborted whenever the operation is cancelled or superseded.
 */
export interface ActiveOperation {
  readonly operationId: string;
  readonly scopeId: string;
  readonly signal: AbortSignal;
}

interface OperationEntry extends ActiveOperation {
  readonly controller: AbortController;
}

/**
 * Provides stale-response protection for one active operation per scope.
 * Calling consume claims a current result exactly once and removes it from the
 * registry, so later, cancelled, stale, or wrong-scope results cannot apply.
 */
export class OperationRegistry {
  private readonly activeByScope = new Map<string, OperationEntry>();

  constructor(private readonly createOperationId: OperationIdFactory = createPlatformOperationId) {}

  get activeOperationCount(): number {
    return this.activeByScope.size;
  }

  /** Starts an operation and aborts any earlier operation in the same scope. */
  start(scopeId: string): ActiveOperation {
    assertOperationScopeId(scopeId);

    const operationId = createBoundedOperationId(this.createOperationId);
    if (this.hasActiveOperationId(operationId)) {
      throw new Error('Operation ID factory returned an identifier that is already active.');
    }

    const controller = new AbortController();
    const previous = this.activeByScope.get(scopeId);
    if (previous !== undefined) {
      this.activeByScope.delete(scopeId);
      previous.controller.abort();
    }

    const operation: OperationEntry = {
      operationId,
      scopeId,
      signal: controller.signal,
      controller
    };
    this.activeByScope.set(scopeId, operation);

    return toActiveOperation(operation);
  }

  /** Cancels the matching current operation and removes it from the registry. */
  cancel(scopeId: string, operationId: string): boolean {
    const operation = this.getCurrent(scopeId, operationId);
    if (operation === undefined) {
      return false;
    }

    this.activeByScope.delete(scopeId);
    operation.controller.abort();
    return true;
  }

  /**
   * Claims a result for application. It returns true exactly once, and only
   * when the operation is still the current non-aborted operation for scope.
   */
  consume(scopeId: string, operationId: string): boolean {
    const operation = this.getCurrent(scopeId, operationId);
    if (operation === undefined) {
      return false;
    }

    this.activeByScope.delete(scopeId);
    return !operation.signal.aborted;
  }

  hasActiveOperation(scopeId: string): boolean {
    return isOperationScopeId(scopeId) && this.activeByScope.has(scopeId);
  }

  private getCurrent(scopeId: string, operationId: string): OperationEntry | undefined {
    if (!isOperationScopeId(scopeId) || !isOperationId(operationId)) {
      return undefined;
    }

    const operation = this.activeByScope.get(scopeId);
    return operation?.operationId === operationId ? operation : undefined;
  }

  private hasActiveOperationId(operationId: string): boolean {
    for (const operation of this.activeByScope.values()) {
      if (operation.operationId === operationId) {
        return true;
      }
    }

    return false;
  }
}

function createPlatformOperationId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('Secure operation identifier generation is unavailable.');
  }

  return globalThis.crypto.randomUUID();
}

function createBoundedOperationId(factory: OperationIdFactory): string {
  const operationId = factory();
  if (!isOperationId(operationId)) {
    throw new Error('Operation ID factory returned an invalid identifier.');
  }

  return operationId;
}

function isOperationId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_OPERATION_ID_LENGTH &&
    OPERATION_ID_PATTERN.test(value)
  );
}

function isOperationScopeId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_OPERATION_SCOPE_ID_LENGTH &&
    OPERATION_ID_PATTERN.test(value)
  );
}

function assertOperationScopeId(scopeId: string): void {
  if (!isOperationScopeId(scopeId)) {
    throw new Error('Operation scope IDs must be bounded, non-empty identifiers.');
  }
}

function toActiveOperation(operation: OperationEntry): ActiveOperation {
  return {
    operationId: operation.operationId,
    scopeId: operation.scopeId,
    signal: operation.signal
  };
}
