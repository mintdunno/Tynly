import { describe, expect, it } from 'vitest';

import { OperationRegistry } from './operation-registry.ts';
import { acceptTransformResult } from './response-guard.ts';

function createIdFactory(ids: string[]): () => string {
  let index = 0;
  return () => ids[index++] ?? 'unexpected-operation';
}

describe('acceptTransformResult', () => {
  it('consumes and sanitizes the current provider result once', () => {
    const registry = new OperationRegistry(createIdFactory(['operation-1']));
    const operation = registry.start('field:1');

    expect(
      acceptTransformResult(registry, 'field:1', operation.operationId, 'Translation: Hello.')
    ).toEqual({
      ok: true,
      result: { operationId: 'operation-1', text: 'Hello.' },
      removedWrappers: ['label']
    });
    expect(registry.activeOperationCount).toBe(0);
  });

  it('rejects a stale result before it can be sanitized or applied', () => {
    const registry = new OperationRegistry(createIdFactory(['operation-1', 'operation-2']));
    const stale = registry.start('field:1');
    registry.start('field:1');

    expect(
      acceptTransformResult(
        registry,
        'field:1',
        stale.operationId,
        'Translation: Never apply this.'
      )
    ).toEqual({ ok: false, reason: 'stale' });
  });

  it('clears an active operation after an invalid provider response', () => {
    const registry = new OperationRegistry(createIdFactory(['operation-1']));
    const operation = registry.start('field:1');

    expect(acceptTransformResult(registry, 'field:1', operation.operationId, '   ')).toEqual({
      ok: false,
      reason: 'empty'
    });
    expect(registry.activeOperationCount).toBe(0);
  });
});
