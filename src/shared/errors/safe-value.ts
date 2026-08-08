/**
 * Values that can cross extension message boundaries without code execution,
 * functions, browser objects, or cyclic references.
 */
export type SerializableValue =
  boolean | null | number | string | SerializableValue[] | SerializableRecord;

export interface SerializableRecord {
  readonly [key: string]: SerializableValue;
}

export const MAX_SERIALIZABLE_DEPTH = 8;
export const MAX_SERIALIZABLE_ARRAY_LENGTH = 100;
export const MAX_SERIALIZABLE_RECORD_KEYS = 100;
export const MAX_SERIALIZABLE_STRING_LENGTH = 16_384;

const REDACTED_VALUE = '[REDACTED]';
const TRUNCATED_VALUE = '[TRUNCATED]';
const CIRCULAR_VALUE = '[CIRCULAR]';
const UNSUPPORTED_VALUE = '[UNSUPPORTED VALUE]';

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const SENSITIVE_KEY_PARTS = [
  'apikey',
  'authorization',
  'accesstoken',
  'refreshtoken',
  'token',
  'secret',
  'password',
  'credential',
  'cookie',
  'privatekey',
  'header',
  'endpoint',
  'baseurl',
  'responsepath',
  'requesttemplate'
] as const;

const SENSITIVE_TEXT_PATTERNS = [
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|credential)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /([?&](?:api[_-]?key|key|token|access_token|password|secret)=)[^&#\s]+/gi
] as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
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

function getDataProperty(
  value: Record<string, unknown>,
  key: string
): { found: boolean; value: unknown } {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !Object.hasOwn(descriptor, 'value')) {
      return { found: false, value: undefined };
    }

    return { found: true, value: descriptor.value };
  } catch {
    return { found: false, value: undefined };
  }
}

function getOwnKeys(value: Record<string, unknown>): string[] | null {
  try {
    return Object.keys(value);
  } catch {
    return null;
  }
}

function isSerializableValueInternal(
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): value is SerializableValue {
  if (value === null || typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'string') {
    return value.length <= MAX_SERIALIZABLE_STRING_LENGTH;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (depth >= MAX_SERIALIZABLE_DEPTH || typeof value !== 'object' || value === null) {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);

  try {
    if (Array.isArray(value)) {
      if (value.length > MAX_SERIALIZABLE_ARRAY_LENGTH) {
        return false;
      }

      for (const item of value) {
        if (!isSerializableValueInternal(item, depth + 1, seen)) {
          return false;
        }
      }

      return true;
    }

    if (!isPlainRecord(value)) {
      return false;
    }

    const keys = getOwnKeys(value);
    if (keys === null || keys.length > MAX_SERIALIZABLE_RECORD_KEYS) {
      return false;
    }

    for (const key of keys) {
      if (FORBIDDEN_OBJECT_KEYS.has(key)) {
        return false;
      }

      const property = getDataProperty(value, key);
      if (!property.found || !isSerializableValueInternal(property.value, depth + 1, seen)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  } finally {
    seen.delete(value);
  }
}

export function isSerializableValue(value: unknown): value is SerializableValue {
  return isSerializableValueInternal(value, 0, new WeakSet<object>());
}

export function isSerializableRecord(value: unknown): value is SerializableRecord {
  return isPlainRecord(value) && isSerializableValue(value);
}

export function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

/** Removes common credential-shaped substrings before user-visible serialization. */
export function redactSensitiveText(value: string): string {
  const boundedValue = value.slice(0, MAX_SERIALIZABLE_STRING_LENGTH);
  return SENSITIVE_TEXT_PATTERNS.reduce(
    (redacted, pattern) => redacted.replace(pattern, REDACTED_VALUE),
    boundedValue
  );
}

function redactValueInternal(
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): SerializableValue {
  if (value === null || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : UNSUPPORTED_VALUE;
  }

  if (depth >= MAX_SERIALIZABLE_DEPTH) {
    return TRUNCATED_VALUE;
  }

  if (typeof value !== 'object' || value === null) {
    return UNSUPPORTED_VALUE;
  }

  if (seen.has(value)) {
    return CIRCULAR_VALUE;
  }

  seen.add(value);

  try {
    if (Array.isArray(value)) {
      const result: SerializableValue[] = [];
      const itemCount = Math.min(value.length, MAX_SERIALIZABLE_ARRAY_LENGTH);

      for (let index = 0; index < itemCount; index += 1) {
        result.push(redactValueInternal(value[index], depth + 1, seen));
      }

      if (value.length > MAX_SERIALIZABLE_ARRAY_LENGTH) {
        result.push(TRUNCATED_VALUE);
      }

      return result;
    }

    if (!isPlainRecord(value)) {
      return UNSUPPORTED_VALUE;
    }

    const result: Record<string, SerializableValue> = {};
    const keys = getOwnKeys(value);
    if (keys === null) {
      return UNSUPPORTED_VALUE;
    }

    const keyCount = Math.min(keys.length, MAX_SERIALIZABLE_RECORD_KEYS);
    for (let index = 0; index < keyCount; index += 1) {
      const key = keys[index];
      if (key === undefined || FORBIDDEN_OBJECT_KEYS.has(key)) {
        continue;
      }

      const property = getDataProperty(value, key);
      result[key] =
        !property.found || isSensitiveKey(key)
          ? REDACTED_VALUE
          : redactValueInternal(property.value, depth + 1, seen);
    }

    if (keys.length > MAX_SERIALIZABLE_RECORD_KEYS) {
      result.truncated = TRUNCATED_VALUE;
    }

    return result;
  } catch {
    return UNSUPPORTED_VALUE;
  } finally {
    seen.delete(value);
  }
}

/**
 * Converts arbitrary values into bounded, JSON-safe diagnostics while
 * removing common credential fields and values.
 */
export function redactSensitiveValue(value: unknown): SerializableValue {
  return redactValueInternal(value, 0, new WeakSet<object>());
}

export function isPublicSettingsPayload(value: unknown): value is SerializableRecord {
  if (!isSerializableRecord(value)) {
    return false;
  }

  const visit = (candidate: SerializableValue): boolean => {
    if (Array.isArray(candidate)) {
      return candidate.every(visit);
    }

    if (candidate !== null && typeof candidate === 'object') {
      return Object.entries(candidate).every(
        ([key, nestedValue]) => !isSensitiveKey(key) && visit(nestedValue)
      );
    }

    return true;
  };

  return visit(value);
}
