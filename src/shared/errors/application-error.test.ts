import { describe, expect, it } from 'vitest';

import {
  AppError,
  deserializeAppError,
  getAppErrorUserMessage,
  isSerializedAppError,
  redactSensitiveValue,
  serializeAppError
} from './index.ts';

describe('application errors', () => {
  it('serializes typed errors with only their fixed user-safe message', () => {
    const error = new AppError('AUTHENTICATION', 'Provider returned Bearer super-secret-token', {
      details: {
        authorization: 'Bearer super-secret-token',
        nested: {
          apiKey: 'sk-1234567890',
          status: 401
        }
      }
    });

    const serialized = serializeAppError(error);

    expect(serialized).toEqual({
      code: 'AUTHENTICATION',
      message: getAppErrorUserMessage('AUTHENTICATION'),
      retryable: false
    });
    expect(serialized.message).not.toContain('super-secret-token');
    expect(JSON.stringify(serialized)).not.toContain('super-secret-token');
    expect(JSON.stringify(serialized)).not.toContain('sk-1234567890');
    expect(serialized).not.toHaveProperty('details');
  });

  it('never serializes Basic authorization or URL credentials supplied by a caller', () => {
    const basicAuthorization = 'Authorization: Basic dXNlcjpwYXNz';
    const credentialedUrl = 'https://user:pass@provider.example.test/v1';
    const serialized = serializeAppError(
      new AppError('NETWORK', `${basicAuthorization}; ${credentialedUrl}`, {
        details: {
          authorization: basicAuthorization,
          endpoint: credentialedUrl,
          reason: 'provider diagnostics'
        }
      })
    );
    const serializedText = JSON.stringify(serialized);

    expect(serialized).toEqual({
      code: 'NETWORK',
      message: getAppErrorUserMessage('NETWORK'),
      retryable: true
    });
    expect(serializedText).not.toContain('dXNlcjpwYXNz');
    expect(serializedText).not.toContain('user:pass@');
    expect(serializedText).not.toContain('provider diagnostics');
  });

  it('does not expose raw messages from unknown thrown values', () => {
    const serialized = serializeAppError(new Error('apiKey=do-not-leak'));

    expect(serialized).toEqual({
      code: 'UNKNOWN',
      message: 'Something went wrong. Please try again.',
      retryable: true
    });
  });

  it('accepts only per-code public messages and drops diagnostics on deserialization', () => {
    const payload = serializeAppError(
      new AppError('NETWORK', 'https://user:pass@provider.example.test', {
        details: { endpoint: 'https://user:pass@provider.example.test' }
      })
    );

    expect(isSerializedAppError(payload)).toBe(true);

    const restored = deserializeAppError(payload);

    expect(restored).toBeInstanceOf(AppError);
    expect(restored.code).toBe('NETWORK');
    expect(restored.message).toBe(getAppErrorUserMessage('NETWORK'));
    expect(restored.details).toBeUndefined();
  });

  it('rejects supplied messages and details in a serialized error envelope', () => {
    const suppliedMessage = {
      code: 'NETWORK',
      message: 'Authorization: Basic dXNlcjpwYXNz',
      retryable: true
    };

    expect(isSerializedAppError(suppliedMessage)).toBe(false);
    expect(deserializeAppError(suppliedMessage)).toMatchObject({
      code: 'UNKNOWN',
      message: getAppErrorUserMessage('UNKNOWN')
    });

    expect(
      isSerializedAppError({
        code: 'NETWORK',
        details: { endpoint: 'https://user:pass@provider.example.test' },
        message: getAppErrorUserMessage('NETWORK'),
        retryable: true
      })
    ).toBe(false);
  });

  it('falls back to an unknown error for malformed serialized input', () => {
    const restored = deserializeAppError({
      code: 'NOT_A_CODE',
      message: 'unsafe',
      retryable: false
    });

    expect(restored.code).toBe('UNKNOWN');
    expect(restored.message).toBe('Something went wrong. Please try again.');
  });

  it('redacts circular and unsupported diagnostic values without throwing', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    expect(redactSensitiveValue({ circular, handler: () => undefined })).toEqual({
      circular: { self: '[CIRCULAR]' },
      handler: '[UNSUPPORTED VALUE]'
    });
  });
});
