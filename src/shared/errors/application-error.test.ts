import { describe, expect, it } from 'vitest';

import {
  AppError,
  deserializeAppError,
  isSerializedAppError,
  redactSensitiveValue,
  serializeAppError
} from './index.ts';

describe('application errors', () => {
  it('serializes typed errors as user-safe, credential-free data', () => {
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

    expect(serialized.code).toBe('AUTHENTICATION');
    expect(serialized.retryable).toBe(false);
    expect(serialized.message).not.toContain('super-secret-token');
    expect(JSON.stringify(serialized)).not.toContain('super-secret-token');
    expect(JSON.stringify(serialized)).not.toContain('sk-1234567890');
    expect(serialized.details).toMatchObject({
      authorization: '[REDACTED]',
      nested: { apiKey: '[REDACTED]', status: 401 }
    });
  });

  it('does not expose raw messages from unknown thrown values', () => {
    const serialized = serializeAppError(new Error('apiKey=do-not-leak'));

    expect(serialized).toEqual({
      code: 'UNKNOWN',
      message: 'Something went wrong. Please try again.',
      retryable: true
    });
  });

  it('recognizes and safely reconstructs serialized errors', () => {
    const payload = {
      code: 'NETWORK',
      details: { endpoint: 'https://private.example.test', status: 503 },
      message: 'Network request failed',
      retryable: true
    };

    expect(isSerializedAppError(payload)).toBe(true);

    const restored = deserializeAppError(payload);

    expect(restored).toBeInstanceOf(AppError);
    expect(restored.code).toBe('NETWORK');
    expect(restored.details).toEqual({ endpoint: '[REDACTED]', status: 503 });
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
