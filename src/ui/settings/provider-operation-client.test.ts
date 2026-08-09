import { describe, expect, it } from 'vitest';

import { serializeAppError } from '../../shared/errors/index.ts';
import { MESSAGE_TYPES } from '../../shared/messaging/index.ts';

import {
  ProviderOperationClient,
  type ProviderOperationRuntime
} from './provider-operation-client.ts';

describe('ProviderOperationClient', () => {
  it('uses bounded provider IDs and returns matching model results only', async () => {
    const runtime = createRuntime(async (message) => {
      expect(message).toEqual({
        profileId: 'openai-main',
        requestId: 'models:id-1',
        type: MESSAGE_TYPES.listProviderModels
      });
      return {
        models: [{ id: 'gpt-test', label: 'GPT test' }],
        profileId: 'openai-main',
        requestId: 'models:id-1',
        type: MESSAGE_TYPES.providerModels
      };
    });
    const client = new ProviderOperationClient(runtime, () => 'id-1');

    await expect(client.listModels('openai-main')).resolves.toEqual({
      ok: true,
      value: [{ id: 'gpt-test', label: 'GPT test' }]
    });
  });

  it('returns only a safe error envelope for matching provider-operation errors', async () => {
    const runtime = createRuntime(async () => ({
      error: serializeAppError(new Error('Authorization: private-token')),
      requestId: 'connection:id-2',
      type: MESSAGE_TYPES.providerOperationError
    }));
    const client = new ProviderOperationClient(runtime, () => 'id-2');

    await expect(client.testConnection('openai-main')).resolves.toEqual({
      error: serializeAppError(new Error('Authorization: private-token')),
      ok: false
    });
  });

  it('drops malformed, mismatched, and failed runtime responses', async () => {
    const malformed = new ProviderOperationClient(
      createRuntime(async () => ({ secret: 'nope' })),
      () => 'id'
    );
    await expect(malformed.listModels('openai-main')).resolves.toMatchObject({
      error: { code: 'UNKNOWN' },
      ok: false
    });

    const mismatched = new ProviderOperationClient(
      createRuntime(async () => ({
        models: [{ id: 'gpt-test', label: 'GPT test' }],
        profileId: 'other-profile',
        requestId: 'models:id',
        type: MESSAGE_TYPES.providerModels
      })),
      () => 'id'
    );
    await expect(mismatched.listModels('openai-main')).resolves.toMatchObject({
      error: { code: 'UNKNOWN' },
      ok: false
    });

    const failed = new ProviderOperationClient(
      createRuntime(async () => Promise.reject(new Error('apiKey=private'))),
      () => 'id'
    );
    await expect(failed.testConnection('openai-main')).resolves.toMatchObject({
      error: { code: 'UNKNOWN' },
      ok: false
    });
  });
});

function createRuntime(handler: (message: unknown) => Promise<unknown>): ProviderOperationRuntime {
  return { sendMessage: handler };
}
