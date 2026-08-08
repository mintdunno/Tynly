import {
  isSerializableRecord,
  redactSensitiveText,
  redactSensitiveValue,
  type SerializableRecord
} from './safe-value.ts';

export const APP_ERROR_CODES = [
  'AUTHENTICATION',
  'CANCELLED',
  'CONFIGURATION',
  'INVALID_RESPONSE',
  'MODEL_UNAVAILABLE',
  'NETWORK',
  'TIMEOUT',
  'UNKNOWN'
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export interface AppErrorOptions {
  readonly details?: unknown;
  readonly retryable?: boolean;
}

export interface SerializedAppError {
  readonly code: AppErrorCode;
  readonly details?: SerializableRecord;
  readonly message: string;
  readonly retryable: boolean;
}

const DEFAULT_ERROR_MESSAGES: Readonly<Record<AppErrorCode, string>> = {
  AUTHENTICATION: 'Authentication failed. Check this provider profile.',
  CANCELLED: 'The request was cancelled.',
  CONFIGURATION: 'This provider profile needs additional configuration.',
  INVALID_RESPONSE: 'The provider returned an unexpected response.',
  MODEL_UNAVAILABLE: 'The selected model is not available.',
  NETWORK: 'The provider could not be reached. Check the connection and endpoint.',
  TIMEOUT: 'The provider took too long to respond. Try again.',
  UNKNOWN: 'Something went wrong. Please try again.'
};

const DEFAULT_RETRYABLE: Readonly<Record<AppErrorCode, boolean>> = {
  AUTHENTICATION: false,
  CANCELLED: false,
  CONFIGURATION: false,
  INVALID_RESPONSE: true,
  MODEL_UNAVAILABLE: false,
  NETWORK: true,
  TIMEOUT: true,
  UNKNOWN: true
};

const MAX_ERROR_MESSAGE_LENGTH = 500;

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  try {
    return Object.keys(value).every((key) => allowedKeys.includes(key));
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function readDataProperty(value: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && Object.hasOwn(descriptor, 'value')
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function isErrorMessage(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ERROR_MESSAGE_LENGTH;
}

function toSafeMessage(code: AppErrorCode, message: string): string {
  const redacted = redactSensitiveText(message).trim().slice(0, MAX_ERROR_MESSAGE_LENGTH);
  return redacted.length > 0 ? redacted : DEFAULT_ERROR_MESSAGES[code];
}

function toSafeDetails(details: unknown): SerializableRecord | undefined {
  if (details === undefined) {
    return undefined;
  }

  const redacted = redactSensitiveValue(details);
  return isSerializableRecord(redacted) ? redacted : { value: redacted };
}

export function isAppErrorCode(value: unknown): value is AppErrorCode {
  return typeof value === 'string' && (APP_ERROR_CODES as readonly string[]).includes(value);
}

/** A typed application failure with a user-safe message and redacted diagnostics. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: SerializableRecord;
  readonly retryable: boolean;

  constructor(
    code: AppErrorCode,
    message = DEFAULT_ERROR_MESSAGES[code],
    options: AppErrorOptions = {}
  ) {
    super(toSafeMessage(code, message));
    this.name = 'AppError';
    this.code = code;
    this.retryable = options.retryable ?? DEFAULT_RETRYABLE[code];

    const details = toSafeDetails(options.details);
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export function isSerializedAppError(value: unknown): value is SerializedAppError {
  if (!isRecord(value) || !hasOnlyKeys(value, ['code', 'details', 'message', 'retryable'])) {
    return false;
  }

  const code = readDataProperty(value, 'code');
  const message = readDataProperty(value, 'message');
  const retryable = readDataProperty(value, 'retryable');
  const details = readDataProperty(value, 'details');

  return (
    isAppErrorCode(code) &&
    isErrorMessage(message) &&
    typeof retryable === 'boolean' &&
    (details === undefined || isSerializableRecord(details))
  );
}

export function normalizeAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    const code = isAppErrorCode(error.code) ? error.code : 'UNKNOWN';
    const message =
      typeof error.message === 'string' ? error.message : DEFAULT_ERROR_MESSAGES[code];
    const retryable =
      typeof error.retryable === 'boolean' ? error.retryable : DEFAULT_RETRYABLE[code];

    return error.details === undefined
      ? new AppError(code, message, { retryable })
      : new AppError(code, message, { details: error.details, retryable });
  }

  if (isSerializedAppError(error)) {
    return new AppError(error.code, error.message, {
      details: error.details,
      retryable: error.retryable
    });
  }

  if (isAbortError(error)) {
    return new AppError('CANCELLED');
  }

  // Never expose a raw thrown value because it may contain credentials.
  return new AppError('UNKNOWN');
}

export function serializeAppError(error: unknown): SerializedAppError {
  const normalized = normalizeAppError(error);
  const details = toSafeDetails(normalized.details);
  const baseError = {
    code: normalized.code,
    message: toSafeMessage(normalized.code, normalized.message),
    retryable: normalized.retryable
  } as const;

  return details === undefined ? baseError : { ...baseError, details };
}

export function deserializeAppError(value: unknown): AppError {
  return normalizeAppError(value);
}

function isAbortError(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  try {
    return 'name' in value && value.name === 'AbortError';
  } catch {
    return false;
  }
}
