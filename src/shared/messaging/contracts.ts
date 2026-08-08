import {
  isContentSettingsSnapshot,
  type ContentSettingsSnapshot
} from '../../core/settings/schema.ts';
import { isSerializedAppError, type SerializedAppError } from '../errors/index.ts';

export const MESSAGE_TYPES = {
  cancelTransform: 'tynly.transform.cancel',
  contentSettings: 'tynly.content-settings.result',
  getContentSettings: 'tynly.content-settings.get',
  transformError: 'tynly.transform.error',
  transformRequest: 'tynly.transform.request',
  transformResult: 'tynly.transform.result'
} as const;

export const MAX_MESSAGE_ID_LENGTH = 128;
export const MAX_TRANSFORM_TEXT_LENGTH = 50_000;

export type TransformTrigger = 'field-button' | 'selection-button' | 'shortcut';

export interface TransformRequestMessage {
  readonly operationId: string;
  readonly requestId: string;
  readonly text: string;
  readonly trigger: TransformTrigger;
  readonly type: typeof MESSAGE_TYPES.transformRequest;
}

export interface CancelTransformMessage {
  readonly operationId: string;
  readonly requestId: string;
  readonly type: typeof MESSAGE_TYPES.cancelTransform;
}

export interface GetContentSettingsMessage {
  readonly requestId: string;
  readonly type: typeof MESSAGE_TYPES.getContentSettings;
}

export interface TransformResultResponse {
  readonly operationId: string;
  readonly requestId: string;
  readonly text: string;
  readonly type: typeof MESSAGE_TYPES.transformResult;
}

export interface TransformErrorResponse {
  readonly error: SerializedAppError;
  readonly operationId: string;
  readonly requestId: string;
  readonly type: typeof MESSAGE_TYPES.transformError;
}

/** A content-settings response is validated against the public snapshot schema. */
export interface ContentSettingsResponse {
  readonly requestId: string;
  readonly settings: ContentSettingsSnapshot;
  readonly type: typeof MESSAGE_TYPES.contentSettings;
}

export type RequestMessage =
  CancelTransformMessage | GetContentSettingsMessage | TransformRequestMessage;

export type ResponseMessage =
  ContentSettingsResponse | TransformErrorResponse | TransformResultResponse;

type UnknownRecord = Record<string, unknown>;

const MESSAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const TRANSFORM_TRIGGERS = new Set<TransformTrigger>([
  'field-button',
  'selection-button',
  'shortcut'
]);

function isRecord(value: unknown): value is UnknownRecord {
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

function hasExactKeys(value: UnknownRecord, expectedKeys: readonly string[]): boolean {
  try {
    const keys = Object.keys(value);
    if (keys.length !== expectedKeys.length || !keys.every((key) => expectedKeys.includes(key))) {
      return false;
    }

    return expectedKeys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && Object.hasOwn(descriptor, 'value');
    });
  } catch {
    return false;
  }
}

function getValue(value: UnknownRecord, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && Object.hasOwn(descriptor, 'value')
    ? descriptor.value
    : undefined;
}

function isMessageId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_MESSAGE_ID_LENGTH &&
    MESSAGE_ID_PATTERN.test(value)
  );
}

function isTransformText(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.trim().length > 0 &&
    value.length <= MAX_TRANSFORM_TEXT_LENGTH
  );
}

function isTransformTrigger(value: unknown): value is TransformTrigger {
  return typeof value === 'string' && TRANSFORM_TRIGGERS.has(value as TransformTrigger);
}

function isTransformRequestMessage(value: unknown): value is TransformRequestMessage {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['operationId', 'requestId', 'text', 'trigger', 'type'])
  ) {
    return false;
  }

  return (
    getValue(value, 'type') === MESSAGE_TYPES.transformRequest &&
    isMessageId(getValue(value, 'requestId')) &&
    isMessageId(getValue(value, 'operationId')) &&
    isTransformText(getValue(value, 'text')) &&
    isTransformTrigger(getValue(value, 'trigger'))
  );
}

function isCancelTransformMessage(value: unknown): value is CancelTransformMessage {
  if (!isRecord(value) || !hasExactKeys(value, ['operationId', 'requestId', 'type'])) {
    return false;
  }

  return (
    getValue(value, 'type') === MESSAGE_TYPES.cancelTransform &&
    isMessageId(getValue(value, 'requestId')) &&
    isMessageId(getValue(value, 'operationId'))
  );
}

function isGetContentSettingsMessage(value: unknown): value is GetContentSettingsMessage {
  if (!isRecord(value) || !hasExactKeys(value, ['requestId', 'type'])) {
    return false;
  }

  return (
    getValue(value, 'type') === MESSAGE_TYPES.getContentSettings &&
    isMessageId(getValue(value, 'requestId'))
  );
}

function isTransformResultResponse(value: unknown): value is TransformResultResponse {
  if (!isRecord(value) || !hasExactKeys(value, ['operationId', 'requestId', 'text', 'type'])) {
    return false;
  }

  return (
    getValue(value, 'type') === MESSAGE_TYPES.transformResult &&
    isMessageId(getValue(value, 'requestId')) &&
    isMessageId(getValue(value, 'operationId')) &&
    isTransformText(getValue(value, 'text'))
  );
}

function isTransformErrorResponse(value: unknown): value is TransformErrorResponse {
  if (!isRecord(value) || !hasExactKeys(value, ['error', 'operationId', 'requestId', 'type'])) {
    return false;
  }

  return (
    getValue(value, 'type') === MESSAGE_TYPES.transformError &&
    isMessageId(getValue(value, 'requestId')) &&
    isMessageId(getValue(value, 'operationId')) &&
    isSerializedAppError(getValue(value, 'error'))
  );
}

function isContentSettingsResponse(value: unknown): value is ContentSettingsResponse {
  if (!isRecord(value) || !hasExactKeys(value, ['requestId', 'settings', 'type'])) {
    return false;
  }

  return (
    getValue(value, 'type') === MESSAGE_TYPES.contentSettings &&
    isMessageId(getValue(value, 'requestId')) &&
    isContentSettingsSnapshot(getValue(value, 'settings'))
  );
}

export function isRequestMessage(value: unknown): value is RequestMessage {
  return (
    isTransformRequestMessage(value) ||
    isCancelTransformMessage(value) ||
    isGetContentSettingsMessage(value)
  );
}

export function isResponseMessage(value: unknown): value is ResponseMessage {
  return (
    isTransformResultResponse(value) ||
    isTransformErrorResponse(value) ||
    isContentSettingsResponse(value)
  );
}

export function parseRequestMessage(value: unknown): RequestMessage | null {
  return isRequestMessage(value) ? value : null;
}

export function parseResponseMessage(value: unknown): ResponseMessage | null {
  return isResponseMessage(value) ? value : null;
}
