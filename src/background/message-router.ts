import type { SettingsStore } from '../core/settings/settings-store.ts';
import {
  ProviderService,
  type ProviderServiceTransformInput
} from '../core/providers/provider-service.ts';
import { createDefaultProviderRegistry } from '../core/providers/provider-factory.ts';
import type { ProviderConnectionTestResult, ProviderModelInfo } from '../core/providers/types.ts';
import { AppError, serializeAppError } from '../shared/errors/index.ts';
import {
  MESSAGE_TYPES,
  MAX_PROVIDER_MODELS_PER_RESPONSE,
  parseRequestMessage,
  type ListProviderModelsMessage,
  type ProviderOperationRequestMessage,
  type RequestMessage,
  type ResponseMessage,
  type TestProviderConnectionMessage,
  type TransformErrorResponse
} from '../shared/messaging/index.ts';
import type { RuntimeMessageSender } from '../shared/browser/runtime-messenger.ts';
import type { TransformResult } from '../core/transform/types.ts';

export interface TransformMessageService {
  cancel(operationId: string): boolean;
  transform(input: ProviderServiceTransformInput): Promise<TransformResult>;
}

/** Network-capable provider actions retained by the background service worker. */
export interface ProviderOperationMessageService {
  listModels(profileId: string): Promise<readonly ProviderModelInfo[]>;
  testConnection(profileId: string): Promise<ProviderConnectionTestResult>;
}

export class BackgroundMessageRouter {
  private readonly transformService: TransformMessageService;

  constructor(
    private readonly settingsStore: SettingsStore,
    transformService: TransformMessageService = new ProviderService(
      settingsStore,
      createDefaultProviderRegistry()
    ),
    private readonly providerOperations: ProviderOperationMessageService = transformService as unknown as ProviderOperationMessageService
  ) {
    this.transformService = transformService;
  }

  async handle(
    rawMessage: unknown,
    sender: RuntimeMessageSender,
    extensionId: string
  ): Promise<ResponseMessage | null> {
    if (sender.id !== extensionId) {
      return null;
    }

    const message = parseRequestMessage(rawMessage);

    if (message === null || !isAllowedMessageSender(message, sender, extensionId)) {
      return null;
    }

    try {
      return await this.route(message);
    } catch (error) {
      return toErrorResponse(message, error);
    }
  }

  private async route(message: RequestMessage): Promise<ResponseMessage> {
    switch (message.type) {
      case MESSAGE_TYPES.getContentSettings:
        return {
          type: MESSAGE_TYPES.contentSettings,
          requestId: message.requestId,
          settings: await this.settingsStore.getContentSettings()
        };
      case MESSAGE_TYPES.cancelTransform:
        this.transformService.cancel(message.operationId);
        return toErrorResponse(message, new AppError('CANCELLED'));
      case MESSAGE_TYPES.transformRequest:
        return toTransformResponse(
          message,
          await this.transformService.transform({
            operationId: message.operationId,
            text: message.text,
            trigger: message.trigger
          })
        );
      case MESSAGE_TYPES.listProviderModels:
        return this.listProviderModels(message);
      case MESSAGE_TYPES.testProviderConnection:
        return this.testProviderConnection(message);
    }
  }

  private async listProviderModels(message: ListProviderModelsMessage): Promise<ResponseMessage> {
    try {
      return {
        type: MESSAGE_TYPES.providerModels,
        requestId: message.requestId,
        profileId: message.profileId,
        models: (await this.providerOperations.listModels(message.profileId)).slice(
          0,
          MAX_PROVIDER_MODELS_PER_RESPONSE
        )
      };
    } catch (error) {
      return toProviderOperationError(message, error);
    }
  }

  private async testProviderConnection(
    message: TestProviderConnectionMessage
  ): Promise<ResponseMessage> {
    try {
      return {
        type: MESSAGE_TYPES.providerConnectionTest,
        requestId: message.requestId,
        profileId: message.profileId,
        result: await this.providerOperations.testConnection(message.profileId)
      };
    } catch (error) {
      return toProviderOperationError(message, error);
    }
  }
}

function toTransformResponse(
  message: Extract<RequestMessage, { type: typeof MESSAGE_TYPES.transformRequest }>,
  result: TransformResult
): ResponseMessage {
  if (result.operationId !== message.operationId) {
    throw new AppError('INVALID_RESPONSE');
  }

  return {
    type: MESSAGE_TYPES.transformResult,
    requestId: message.requestId,
    operationId: message.operationId,
    text: result.text
  };
}

function toErrorResponse(
  message: Exclude<RequestMessage, { type: typeof MESSAGE_TYPES.getContentSettings }>,
  error: unknown
): TransformErrorResponse;
function toErrorResponse(message: RequestMessage, error: unknown): TransformErrorResponse;
function toErrorResponse(message: RequestMessage, error: unknown): TransformErrorResponse {
  return {
    type: MESSAGE_TYPES.transformError,
    requestId: message.requestId,
    operationId: 'operationId' in message ? message.operationId : message.requestId,
    error: serializeAppError(error)
  };
}

function toProviderOperationError(
  message: ProviderOperationRequestMessage,
  error: unknown
): ResponseMessage {
  return {
    type: MESSAGE_TYPES.providerOperationError,
    requestId: message.requestId,
    error: serializeAppError(error)
  };
}

function isAllowedMessageSender(
  message: RequestMessage,
  sender: RuntimeMessageSender,
  extensionId: string
): boolean {
  return !isProviderOperationRequest(message) || isTrustedExtensionPageSender(sender, extensionId);
}

function isProviderOperationRequest(
  message: RequestMessage
): message is ProviderOperationRequestMessage {
  return (
    message.type === MESSAGE_TYPES.listProviderModels ||
    message.type === MESSAGE_TYPES.testProviderConnection
  );
}

const SETTINGS_PAGE_PATH = '/src/ui/settings/index.html';

function isTrustedExtensionPageSender(sender: RuntimeMessageSender, extensionId: string): boolean {
  if (typeof sender.url !== 'string') {
    return false;
  }

  try {
    const url = new URL(sender.url);
    return (
      url.protocol === 'chrome-extension:' &&
      url.hostname === extensionId &&
      url.pathname === SETTINGS_PAGE_PATH
    );
  } catch {
    return false;
  }
}
