import type { SettingsStore } from '../core/settings/settings-store.ts';
import {
  ProviderService,
  type ProviderServiceTransformInput
} from '../core/providers/provider-service.ts';
import { createDefaultProviderRegistry } from '../core/providers/provider-factory.ts';
import { AppError, serializeAppError } from '../shared/errors/index.ts';
import {
  MESSAGE_TYPES,
  parseRequestMessage,
  type RequestMessage,
  type ResponseMessage,
  type TransformErrorResponse
} from '../shared/messaging/index.ts';
import type { RuntimeMessageSender } from '../shared/browser/runtime-messenger.ts';
import type { TransformResult } from '../core/transform/types.ts';

export interface TransformMessageService {
  cancel(operationId: string): boolean;
  transform(input: ProviderServiceTransformInput): Promise<TransformResult>;
}

export class BackgroundMessageRouter {
  private readonly transformService: TransformMessageService;

  constructor(
    private readonly settingsStore: SettingsStore,
    transformService: TransformMessageService = new ProviderService(
      settingsStore,
      createDefaultProviderRegistry()
    )
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

    if (message === null) {
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
