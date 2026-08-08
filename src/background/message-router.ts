import { SettingsStore } from '../core/settings/settings-store.ts';
import {
  AppError,
  serializeAppError,
  type SerializedAppError
} from '../shared/errors/index.ts';
import {
  MESSAGE_TYPES,
  parseRequestMessage,
  type RequestMessage,
  type ResponseMessage,
  type TransformErrorResponse
} from '../shared/messaging/index.ts';
import type { RuntimeMessageSender } from '../shared/browser/runtime-messenger.ts';

export class BackgroundMessageRouter {
  constructor(private readonly settingsStore: SettingsStore) {}

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
        return toErrorResponse(message, new AppError('CANCELLED'));
      case MESSAGE_TYPES.transformRequest:
        return toErrorResponse(
          message,
          new AppError(
            'CONFIGURATION',
            'Transforming text is not available until the provider service is configured.'
          )
        );
    }
  }
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
    error: serializeAppError(error) as SerializedAppError
  };
}
