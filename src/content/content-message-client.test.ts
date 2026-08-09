import { describe, expect, it } from 'vitest';

import { createDefaultAppSettings } from '../core/settings/defaults.ts';
import { toContentSettingsSnapshot } from '../core/settings/schema.ts';
import { serializeAppError } from '../shared/errors/index.ts';
import { MESSAGE_TYPES } from '../shared/messaging/index.ts';

import { ContentMessageClient, type ContentRuntimeSender } from './content-message-client.ts';

describe('ContentMessageClient', () => {
  it('requests only public settings and validates the matching response', async () => {
    const settings = toContentSettingsSnapshot(createDefaultAppSettings());
    const runtime = createRuntime(async (message) => {
      expect(message).toEqual({
        requestId: 'settings:id-1',
        type: MESSAGE_TYPES.getContentSettings
      });
      return { requestId: 'settings:id-1', settings, type: MESSAGE_TYPES.contentSettings };
    });
    const client = new ContentMessageClient(runtime, () => 'id-1');

    await expect(client.getSettings()).resolves.toEqual(settings);
  });

  it('returns only a matching typed transform result or fixed error envelope', async () => {
    const resultRuntime = createRuntime(async (message) => {
      expect(message).toMatchObject({
        operationId: 'operation-1',
        requestId: 'transform:id-2',
        text: 'Xin chao',
        trigger: 'field-button',
        type: MESSAGE_TYPES.transformRequest
      });
      return {
        operationId: 'operation-1',
        requestId: 'transform:id-2',
        text: 'Hello.',
        type: MESSAGE_TYPES.transformResult
      };
    });
    const client = new ContentMessageClient(resultRuntime, () => 'id-2');

    await expect(client.transform('operation-1', 'Xin chao', 'field-button')).resolves.toEqual({
      kind: 'result',
      text: 'Hello.'
    });

    const errorRuntime = createRuntime(async () => ({
      error: serializeAppError(new Error('apiKey=do-not-leak')),
      operationId: 'operation-2',
      requestId: 'transform:id-3',
      type: MESSAGE_TYPES.transformError
    }));
    const errorClient = new ContentMessageClient(errorRuntime, () => 'id-3');
    await expect(
      errorClient.transform('operation-2', 'Xin chao', 'shortcut')
    ).resolves.toMatchObject({
      error: { code: 'UNKNOWN' },
      kind: 'error'
    });
  });

  it('drops malformed, mismatched, and failed runtime responses', async () => {
    const malformed = new ContentMessageClient(
      createRuntime(async () => ({ secret: 'nope' })),
      () => 'id'
    );
    await expect(malformed.getSettings()).resolves.toBeNull();

    const mismatched = new ContentMessageClient(
      createRuntime(async () => ({
        operationId: 'other-operation',
        requestId: 'transform:id',
        text: 'Hello.',
        type: MESSAGE_TYPES.transformResult
      })),
      () => 'id'
    );
    await expect(mismatched.transform('operation', 'Text', 'shortcut')).resolves.toBeNull();

    const failed = new ContentMessageClient(
      createRuntime(async () => Promise.reject(new Error('Authorization: secret'))),
      () => 'id'
    );
    await expect(failed.getSettings()).resolves.toBeNull();
  });

  it('sends a bounded cancellation request without propagating a response', async () => {
    const runtime = createRuntime(async (message) => {
      expect(message).toEqual({
        operationId: 'operation-3',
        requestId: 'cancel:id-4',
        type: MESSAGE_TYPES.cancelTransform
      });
      return null;
    });
    const client = new ContentMessageClient(runtime, () => 'id-4');

    await expect(client.cancel('operation-3')).resolves.toBeUndefined();
  });
});

function createRuntime(handler: (message: unknown) => Promise<unknown>): ContentRuntimeSender {
  return { sendMessage: handler };
}
