import {
  isContentSettingsSnapshot,
  isProfileId,
  type ContentSettingsSnapshot
} from '../../core/settings/schema.ts';
import type {
  ProviderConnectionTestResult,
  ProviderModelInfo
} from '../../core/providers/types.ts';
import { TRANSFORM_TRIGGERS, type TransformTrigger } from '../../core/transform/types.ts';
import { isSerializedAppError, type SerializedAppError } from '../errors/index.ts';

export type { TransformTrigger } from '../../core/transform/types.ts';

export const MESSAGE_TYPES = {
  cancelTransform: 'tynly.transform.cancel',
  contentSettings: 'tynly.content-settings.result',
  getContentSettings: 'tynly.content-settings.get',
  listProviderModels: 'tynly.provider.models.list',
  providerConnectionTest: 'tynly.provider.connection.result',
  providerModels: 'tynly.provider.models.result',
  providerOperationError: 'tynly.provider.operation.error',
  testProviderConnection: 'tynly.provider.connection.test',
  transformError: 'tynly.transform.error',
  transformRequest: 'tynly.transform.request',
  transformResult: 'tynly.transform.result'
} as const;

export const MAX_MESSAGE_ID_LENGTH = 128;
export const MAX_TRANSFORM_TEXT_LENGTH = 50_000;

/** Bound model discovery data before it crosses from the background worker. */
export const MAX_PROVIDER_MODELS_PER_RESPONSE = 500;
const MAX_PROVIDER_MODEL_TEXT_LENGTH = 256;

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

/** Only a trusted extension page may ask the background to run these operations. */
export interface ListProviderModelsMessage {
  readonly profileId: string;
  readonly requestId: string;
  readonly type: typeof MESSAGE_TYPES.listProviderModels;
}

/** Only a trusted extension page may ask the background to run these operations. */
export interface TestProviderConnectionMessage {
  readonly profileId: string;
  readonly requestId: string;
  readonly type: typeof MESSAGE_TYPES.testProviderConnection;
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

export interface ProviderModelsResponse {
  readonly models: readonly ProviderModelInfo[];
  readonly profileId: string;
  readonly requestId: string;
  readonly type: typeof MESSAGE_TYPES.providerModels;
}

export interface ProviderConnectionTestResponse {
  readonly profileId: string;
  readonly requestId: string;
  readonly result: ProviderConnectionTestResult;
  readonly type: typeof MESSAGE_TYPES.providerConnectionTest;
}

/** A fixed public envelope for trusted-page provider operation failures. */
export interface ProviderOperationErrorResponse {
  readonly error: SerializedAppError;
  readonly requestId: string;
  readonly type: typeof MESSAGE_TYPES.providerOperationError;
}

export type ProviderOperationRequestMessage =
  ListProviderModelsMessage | TestProviderConnectionMessage;

export type RequestMessage =
  | CancelTransformMessage
  | GetContentSettingsMessage
  | ProviderOperationRequestMessage
  | TransformRequestMessage;

export type ResponseMessage =
  | ContentSettingsResponse
  | ProviderConnectionTestResponse
  | ProviderModelsResponse
  | ProviderOperationErrorResponse
  | TransformErrorResponse
  | TransformResultResponse;

type UnknownRecord = Record<string, unknown>;

const MESSAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const TRANSFORM_TRIGGER_SET = new Set<TransformTrigger>(TRANSFORM_TRIGGERS);

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
  return typeof value === 'string' && TRANSFORM_TRIGGER_SET.has(value as TransformTrigger);
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

function isListProviderModelsMessage(value: unknown): value is ListProviderModelsMessage {
  if (!isRecord(value) || !hasExactKeys(value, ['profileId', 'requestId', 'type'])) {
    return false;
  }

  return (
    getValue(value, 'type') === MESSAGE_TYPES.listProviderModels &&
    isMessageId(getValue(value, 'requestId')) &&
    isProfileId(getValue(value, 'profileId'))
  );
}

function isTestProviderConnectionMessage(value: unknown): value is TestProviderConnectionMessage {
  if (!isRecord(value) || !hasExactKeys(value, ['profileId', 'requestId', 'type'])) {
    return false;
  }

  return (
    getValue(value, 'type') === MESSAGE_TYPES.testProviderConnection &&
    isMessageId(getValue(value, 'requestId')) &&
    isProfileId(getValue(value, 'profileId'))
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

function isProviderModelsResponse(value: unknown): value is ProviderModelsResponse {
  if (!isRecord(value) || !hasExactKeys(value, ['models', 'profileId', 'requestId', 'type'])) {
    return false;
  }

  return (
    getValue(value, 'type') === MESSAGE_TYPES.providerModels &&
    isMessageId(getValue(value, 'requestId')) &&
    isProfileId(getValue(value, 'profileId')) &&
    isProviderModelList(getValue(value, 'models'))
  );
}

function isProviderConnectionTestResponse(value: unknown): value is ProviderConnectionTestResponse {
  if (!isRecord(value) || !hasExactKeys(value, ['profileId', 'requestId', 'result', 'type'])) {
    return false;
  }

  return (
    getValue(value, 'type') === MESSAGE_TYPES.providerConnectionTest &&
    isMessageId(getValue(value, 'requestId')) &&
    isProfileId(getValue(value, 'profileId')) &&
    isProviderConnectionTestResult(getValue(value, 'result'))
  );
}

function isProviderOperationErrorResponse(value: unknown): value is ProviderOperationErrorResponse {
  if (!isRecord(value) || !hasExactKeys(value, ['error', 'requestId', 'type'])) {
    return false;
  }

  return (
    getValue(value, 'type') === MESSAGE_TYPES.providerOperationError &&
    isMessageId(getValue(value, 'requestId')) &&
    isSerializedAppError(getValue(value, 'error'))
  );
}

function isProviderModelList(value: unknown): value is readonly ProviderModelInfo[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_PROVIDER_MODELS_PER_RESPONSE &&
    value.every(isProviderModelInfo)
  );
}

function isProviderModelInfo(value: unknown): value is ProviderModelInfo {
  if (!isRecord(value) || !hasExactKeys(value, ['id', 'label'])) {
    return false;
  }

  return (
    isProviderModelText(getValue(value, 'id')) && isProviderModelText(getValue(value, 'label'))
  );
}

function isProviderModelText(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= MAX_PROVIDER_MODEL_TEXT_LENGTH &&
    !/[\r\n]/u.test(value)
  );
}

function isProviderConnectionTestResult(value: unknown): value is ProviderConnectionTestResult {
  if (!isRecord(value)) {
    return false;
  }

  if (getValue(value, 'ok') === true) {
    return hasExactKeys(value, ['ok']);
  }

  return (
    getValue(value, 'ok') === false &&
    hasExactKeys(value, ['error', 'ok']) &&
    isSerializedAppError(getValue(value, 'error'))
  );
}

export function isRequestMessage(value: unknown): value is RequestMessage {
  return (
    isTransformRequestMessage(value) ||
    isCancelTransformMessage(value) ||
    isGetContentSettingsMessage(value) ||
    isListProviderModelsMessage(value) ||
    isTestProviderConnectionMessage(value)
  );
}

export function isResponseMessage(value: unknown): value is ResponseMessage {
  return (
    isTransformResultResponse(value) ||
    isTransformErrorResponse(value) ||
    isContentSettingsResponse(value) ||
    isProviderModelsResponse(value) ||
    isProviderConnectionTestResponse(value) ||
    isProviderOperationErrorResponse(value)
  );
}

export function parseRequestMessage(value: unknown): RequestMessage | null {
  return isRequestMessage(value) ? value : null;
}

export function parseResponseMessage(value: unknown): ResponseMessage | null {
  return isResponseMessage(value) ? value : null;
}
