import { describe, expect, it } from 'vitest';

import { createDefaultAppSettings } from '../../core/settings/defaults.ts';
import { toContentSettingsSnapshot } from '../../core/settings/schema.ts';
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

  it('validates only exact public settings responses', () => {
    const settings = toContentSettingsSnapshot(createDefaultAppSettings());
    const response = {
      requestId: 'settings:1',
      settings,
      type: MESSAGE_TYPES.contentSettings
    };

    expect(isResponseMessage(response)).toBe(true);
    expect(parseResponseMessage(response)).toEqual(response);

    expect(
      isResponseMessage({
        requestId: 'settings:1',
        settings: { ...settings, provider: { apiKey: 'sk-1234567890' } },
        type: MESSAGE_TYPES.contentSettings
      })
    ).toBe(false);

    const privateSettings = createDefaultAppSettings();
    privateSettings.styles = {
      selected: { kind: 'custom', id: 'private-style' },
      custom: [
        {
          id: 'private-style',
          name: 'Private style',
          instruction: 'Keep this private.'
        }
      ]
    };
    const publicSettings = toContentSettingsSnapshot(privateSettings);

    expect(
      isResponseMessage({
        requestId: 'settings:1',
        settings: {
          ...publicSettings,
          styles: {
            ...publicSettings.styles,
            custom: [
              {
                ...publicSettings.styles.custom[0]!,
                instruction: 'Keep this private.'
              }
            ]
          }
        },
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

    expect(
      isResponseMessage({
        error: {
          code: 'NETWORK',
          details: { authorization: 'Basic dXNlcjpwYXNz' },
          message: 'Authorization: Basic dXNlcjpwYXNz',
          retryable: true
        },
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
