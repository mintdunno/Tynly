import { describe, expect, it } from 'vitest';

import { serializeAppError } from '../errors/index.ts';
import {
  isRequestMessage,
  isResponseMessage,
  MESSAGE_TYPES,
  parseRequestMessage,
  parseResponseMessage
} from './index.ts';

describe('extension message contracts', () => {
  it('accepts a bounded transform request with no provider configuration', () => {
    const request = {
      operationId: 'operation:8d0e0a',
      requestId: 'request:8d0e0a',
      text: 'Xin chao, please make this natural.',
      trigger: 'field-button',
      type: MESSAGE_TYPES.transformRequest
    };

    expect(isRequestMessage(request)).toBe(true);
    expect(parseRequestMessage(request)).toEqual(request);
  });

  it('rejects arbitrary provider configuration and malformed operation identifiers', () => {
    expect(
      isRequestMessage({
        endpoint: 'https://provider.example.test',
        operationId: 'operation:8d0e0a',
        requestId: 'request:8d0e0a',
        text: 'Transform me',
        trigger: 'field-button',
        type: MESSAGE_TYPES.transformRequest
      })
    ).toBe(false);

    expect(
      isRequestMessage({
        operationId: 'bad operation id',
        requestId: 'request:8d0e0a',
        text: 'Transform me',
        trigger: 'field-button',
        type: MESSAGE_TYPES.transformRequest
      })
    ).toBe(false);
  });

  it('validates public settings responses without importing a settings schema', () => {
    const response = {
      requestId: 'settings:1',
      settings: {
        behavior: { mode: 'replace', showUndo: true },
        controls: { fieldButton: { enabled: true } },
        language: { source: 'vi', target: 'en' }
      },
      type: MESSAGE_TYPES.contentSettings
    };

    expect(isResponseMessage(response)).toBe(true);
    expect(parseResponseMessage(response)).toEqual(response);

    expect(
      isResponseMessage({
        requestId: 'settings:1',
        settings: { provider: { apiKey: 'sk-1234567890' } },
        type: MESSAGE_TYPES.contentSettings
      })
    ).toBe(false);
  });

  it('validates typed transform errors and rejects untyped error payloads', () => {
    const error = serializeAppError(new Error('apiKey=do-not-leak'));
    const response = {
      error,
      operationId: 'operation:1',
      requestId: 'request:1',
      type: MESSAGE_TYPES.transformError
    };

    expect(isResponseMessage(response)).toBe(true);

    expect(
      isResponseMessage({
        error: { message: 'raw exception' },
        operationId: 'operation:1',
        requestId: 'request:1',
        type: MESSAGE_TYPES.transformError
      })
    ).toBe(false);
  });

  it('accepts cancellation and rejects empty transform results', () => {
    expect(
      isRequestMessage({
        operationId: 'operation:1',
        requestId: 'request:1',
        type: MESSAGE_TYPES.cancelTransform
      })
    ).toBe(true);

    expect(
      isResponseMessage({
        operationId: 'operation:1',
        requestId: 'request:1',
        text: '   ',
        type: MESSAGE_TYPES.transformResult
      })
    ).toBe(false);
  });
});
