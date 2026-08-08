import { describe, expect, it } from 'vitest';

import { MAX_OPERATION_ID_LENGTH, OperationRegistry } from './operation-registry.ts';

function createIdFactory(ids: string[]): () => string {
  let index = 0;

  return () => {
    const id = ids[index];
    index += 1;

    if (id === undefined) {
      throw new Error('Test operation ID factory exhausted.');
    }

    return id;
  };
}

describe('OperationRegistry', () => {
  it('issues deterministic, bounded opaque IDs and exposes an AbortSignal', () => {
    const registry = new OperationRegistry(createIdFactory(['operation-1']));

    const operation = registry.start('field:1');

    expect(operation).toMatchObject({
      operationId: 'operation-1',
      scopeId: 'field:1'
    });
    expect(operation.signal).toBeInstanceOf(AbortSignal);
    expect(operation.signal.aborted).toBe(false);
    expect(registry.hasActiveOperation('field:1')).toBe(true);
    expect(registry.activeOperationCount).toBe(1);
  });

  it('rejects IDs outside the bounded identifier format without creating an operation', () => {
    const registry = new OperationRegistry(() => 'x'.repeat(MAX_OPERATION_ID_LENGTH + 1));

    expect(() => registry.start('field:1')).toThrow(
      'Operation ID factory returned an invalid identifier.'
    );
    expect(registry.activeOperationCount).toBe(0);
  });

  it('aborts a superseded operation while retaining only the newer operation for its scope', () => {
    const registry = new OperationRegistry(createIdFactory(['operation-1', 'operation-2']));
    const first = registry.start('field:1');
    const second = registry.start('field:1');

    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
    expect(registry.activeOperationCount).toBe(1);
    expect(registry.consume('field:1', first.operationId)).toBe(false);
    expect(registry.consume('field:1', second.operationId)).toBe(true);
  });

  it('explicitly cancels only the matching current operation', () => {
    const registry = new OperationRegistry(createIdFactory(['operation-1']));
    const operation = registry.start('field:1');

    expect(registry.cancel('field:1', 'other-operation')).toBe(false);
    expect(operation.signal.aborted).toBe(false);
    expect(registry.cancel('field:1', operation.operationId)).toBe(true);
    expect(operation.signal.aborted).toBe(true);
    expect(registry.activeOperationCount).toBe(0);
  });

  it('rejects stale results and results presented for the wrong scope', () => {
    const registry = new OperationRegistry(createIdFactory(['operation-1', 'operation-2']));
    const stale = registry.start('field:1');
    const current = registry.start('field:1');

    expect(registry.consume('field:1', stale.operationId)).toBe(false);
    expect(registry.consume('field:2', current.operationId)).toBe(false);
    expect(registry.hasActiveOperation('field:1')).toBe(true);
    expect(registry.activeOperationCount).toBe(1);
  });

  it('consumes a current operation once and leaves no active operation behind', () => {
    const registry = new OperationRegistry(createIdFactory(['operation-1']));
    const operation = registry.start('selection:1');

    expect(registry.consume('selection:1', operation.operationId)).toBe(true);
    expect(registry.consume('selection:1', operation.operationId)).toBe(false);
    expect(registry.hasActiveOperation('selection:1')).toBe(false);
    expect(registry.activeOperationCount).toBe(0);
  });
});
