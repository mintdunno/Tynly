import { afterEach, describe, expect, it } from 'vitest';

import { OperationRegistry } from '../core/transform/operation-registry.ts';
import { AppError, serializeAppError } from '../shared/errors/index.ts';

import type { ContentTransformClient, TransformPresentation } from './transform-controller.ts';
import { TransformController } from './transform-controller.ts';

afterEach(() => {
  document.body.replaceChildren();
});

describe('TransformController', () => {
  it('routes an editable selection through one request, replacement, and validated Undo record', async () => {
    const input = document.createElement('input');
    input.value = 'one blue two';
    input.setSelectionRange(4, 8);
    document.body.append(input);
    const client = new ImmediateClient({ kind: 'result', text: 'green' });
    const presentation = new RecordingPresentation();
    const controller = createController(client, presentation);

    expect(controller.startEditable(input, 'field-button', 'replace', true)).toBe(true);
    await settle();

    expect(client.requests).toEqual([
      { operationId: 'operation-1', text: 'blue', trigger: 'field-button' }
    ]);
    expect(input.value).toBe('one green two');
    expect(presentation.replacements).toEqual([
      { operationId: 'operation-1', target: input, undoAvailable: true }
    ]);
    expect(controller.undoLast('operation-1')).toEqual({ ok: true, operationId: 'operation-1' });
    expect(input.value).toBe('one blue two');
  });

  it('keeps preview results inert until the explicit Replace action', async () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'before';
    document.body.append(textarea);
    const client = new ImmediateClient({ kind: 'result', text: 'after' });
    const presentation = new RecordingPresentation();
    const controller = createController(client, presentation);

    expect(controller.startEditable(textarea, 'selection-button', 'preview', false)).toBe(true);
    await settle();

    expect(textarea.value).toBe('before');
    expect(presentation.previews).toMatchObject([{ operationId: 'operation-1', text: 'after' }]);
    expect(controller.applyPreview('operation-1')).toBe(true);
    expect(textarea.value).toBe('after');
    expect(presentation.replacements).toMatchObject([{ undoAvailable: false }]);
  });

  it('returns normal-page selections only to the result presenter and never changes page DOM', async () => {
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Original page text';
    document.body.append(paragraph);
    const client = new ImmediateClient({ kind: 'result', text: 'Transformed page text' });
    const presentation = new RecordingPresentation();
    const controller = createController(client, presentation);
    const anchor = { bottom: 70, left: 30, right: 130, top: 50 };

    expect(controller.startPageSelection('Original page text', 'selection-button', anchor)).toBe(
      true
    );
    await settle();

    expect(paragraph.textContent).toBe('Original page text');
    expect(presentation.pageResults).toEqual([
      { anchor, operationId: 'operation-1', text: 'Transformed page text' }
    ]);
  });

  it('rejects a late result when the user has edited the target since capture', async () => {
    const input = document.createElement('input');
    input.value = 'before';
    document.body.append(input);
    const client = new DeferredClient();
    const presentation = new RecordingPresentation();
    const controller = createController(client, presentation);

    expect(controller.startEditable(input, 'shortcut', 'replace', true)).toBe(true);
    input.value = 'user changed this';
    client.resolve('operation-1', { kind: 'result', text: 'provider text' });
    await settle();

    expect(input.value).toBe('user changed this');
    expect(presentation.replacements).toEqual([]);
  });

  it('cancels a superseded request and only applies the newest response for a target', async () => {
    const input = document.createElement('input');
    input.value = 'before';
    document.body.append(input);
    const client = new DeferredClient();
    const presentation = new RecordingPresentation();
    const controller = createController(client, presentation);

    expect(controller.startEditable(input, 'field-button', 'replace', false)).toBe(true);
    expect(controller.startEditable(input, 'field-button', 'replace', false)).toBe(true);
    client.resolve('operation-1', { kind: 'result', text: 'old result' });
    client.resolve('operation-2', { kind: 'result', text: 'new result' });
    await settle();

    expect(client.cancelled).toContain('operation-1');
    expect(input.value).toBe('new result');
    expect(presentation.replacements).toMatchObject([{ operationId: 'operation-2' }]);
  });

  it('shows only a fixed error envelope for background failures and malformed replies', async () => {
    const input = document.createElement('input');
    input.value = 'before';
    document.body.append(input);
    const presentation = new RecordingPresentation();
    const controller = createController(
      new ImmediateClient({ error: serializeAppError(new Error('apiKey=private')), kind: 'error' }),
      presentation
    );

    expect(controller.startEditable(input, 'shortcut', 'replace', true)).toBe(true);
    await settle();

    expect(presentation.errors).toEqual([serializeAppError(new Error('apiKey=private'))]);
    expect(input.value).toBe('before');
  });

  it('surfaces a safe invalid-response error when a result cannot be sanitized', async () => {
    const input = document.createElement('input');
    input.value = 'before';
    document.body.append(input);
    const presentation = new RecordingPresentation();
    const controller = createController(
      new ImmediateClient({ kind: 'result', text: '   ' }),
      presentation
    );

    expect(controller.startEditable(input, 'shortcut', 'replace', true)).toBe(true);
    await settle();

    expect(presentation.errors).toEqual([serializeAppError(new AppError('INVALID_RESPONSE'))]);
    expect(input.value).toBe('before');
  });

  it('cancels pending transforms and drops unapplied previews during teardown', async () => {
    const input = document.createElement('input');
    input.value = 'before';
    document.body.append(input);
    const client = new DeferredClient();
    const presentation = new RecordingPresentation();
    const controller = createController(client, presentation);

    expect(controller.startEditable(input, 'shortcut', 'replace', true)).toBe(true);
    controller.cancelAll();
    client.resolve('operation-1', { kind: 'result', text: 'after' });
    await settle();

    expect(client.cancelled).toContain('operation-1');
    expect(input.value).toBe('before');
    expect(presentation.replacements).toEqual([]);
  });
});

class ImmediateClient implements ContentTransformClient {
  readonly cancelled: string[] = [];
  readonly requests: Array<{ operationId: string; text: string; trigger: string }> = [];

  constructor(
    private readonly response: Awaited<ReturnType<ContentTransformClient['transform']>>
  ) {}

  async cancel(operationId: string): Promise<void> {
    this.cancelled.push(operationId);
  }

  async transform(operationId: string, text: string, trigger: string) {
    this.requests.push({ operationId, text, trigger });
    return this.response;
  }
}

class DeferredClient implements ContentTransformClient {
  readonly cancelled: string[] = [];
  private readonly pending = new Map<
    string,
    (response: Awaited<ReturnType<ContentTransformClient['transform']>>) => void
  >();

  async cancel(operationId: string): Promise<void> {
    this.cancelled.push(operationId);
  }

  transform(
    operationId: string
  ): Promise<Awaited<ReturnType<ContentTransformClient['transform']>>> {
    return new Promise((resolve) => {
      this.pending.set(operationId, resolve);
    });
  }

  resolve(
    operationId: string,
    response: Awaited<ReturnType<ContentTransformClient['transform']>>
  ): void {
    const resolve = this.pending.get(operationId);
    if (resolve === undefined) {
      throw new Error(`Missing pending operation: ${operationId}`);
    }
    this.pending.delete(operationId);
    resolve(response);
  }
}

class RecordingPresentation implements TransformPresentation {
  readonly errors: ReturnType<typeof serializeAppError>[] = [];
  readonly inputRejections: string[] = [];
  readonly loading: Array<{ loading: boolean; operationId: string }> = [];
  readonly pageResults: Array<Parameters<TransformPresentation['onPageResult']>[0]> = [];
  readonly previews: Array<{ operationId: string; target: Element; text: string }> = [];
  readonly replacements: Array<{ operationId: string; target: Element; undoAvailable: boolean }> =
    [];

  onEditablePreview(result: { operationId: string; target: Element; text: string }): void {
    this.previews.push(result);
  }

  onError(error: ReturnType<typeof serializeAppError>): void {
    this.errors.push(error);
  }

  onInputRejected(reason: string): void {
    this.inputRejections.push(reason);
  }

  onLoading(operationId: string, loading: boolean): void {
    this.loading.push({ loading, operationId });
  }

  onPageResult(result: Parameters<TransformPresentation['onPageResult']>[0]): void {
    this.pageResults.push(result);
  }

  onReplacement(result: { operationId: string; target: Element; undoAvailable: boolean }): void {
    this.replacements.push(result);
  }
}

function createController(
  client: ContentTransformClient,
  presentation: TransformPresentation
): TransformController {
  let identifier = 0;
  return new TransformController(client, presentation, {
    operations: new OperationRegistry(() => `operation-${++identifier}`)
  });
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
