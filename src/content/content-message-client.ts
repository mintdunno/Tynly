import type { ContentSettingsSnapshot } from '../core/settings/schema.ts';
import type { TransformTrigger } from '../core/transform/types.ts';
import {
  MESSAGE_TYPES,
  parseResponseMessage,
  type TransformErrorResponse
} from '../shared/messaging/index.ts';

export interface ContentRuntimeSender {
  sendMessage(message: unknown): Promise<unknown>;
}

export type ContentTransformResponse =
  | { readonly kind: 'error'; readonly error: TransformErrorResponse['error'] }
  | { readonly kind: 'result'; readonly text: string }
  | null;

export type ContentRequestIdFactory = () => string;

/**
 * The sole content-side runtime messaging boundary. It validates every reply
 * and never exposes raw runtime or provider errors to page-facing code.
 */
export class ContentMessageClient {
  constructor(
    private readonly runtime: ContentRuntimeSender = getContentRuntimeSender(),
    private readonly createRequestId: ContentRequestIdFactory = createPlatformRequestId
  ) {}

  async getSettings(): Promise<ContentSettingsSnapshot | null> {
    const requestId = this.nextRequestId('settings');
    const response = await this.send({ requestId, type: MESSAGE_TYPES.getContentSettings });
    return response?.type === MESSAGE_TYPES.contentSettings && response.requestId === requestId
      ? response.settings
      : null;
  }

  async transform(
    operationId: string,
    text: string,
    trigger: TransformTrigger
  ): Promise<ContentTransformResponse> {
    const requestId = this.nextRequestId('transform');
    const response = await this.send({
      operationId,
      requestId,
      text,
      trigger,
      type: MESSAGE_TYPES.transformRequest
    });
    if (
      response === null ||
      response.requestId !== requestId ||
      (response.type !== MESSAGE_TYPES.transformResult &&
        response.type !== MESSAGE_TYPES.transformError) ||
      response.operationId !== operationId
    ) {
      return null;
    }
    if (response.type === MESSAGE_TYPES.transformResult) {
      return { kind: 'result', text: response.text };
    }
    return response.type === MESSAGE_TYPES.transformError
      ? { error: response.error, kind: 'error' }
      : null;
  }

  async cancel(operationId: string): Promise<void> {
    const requestId = this.nextRequestId('cancel');
    await this.send({ operationId, requestId, type: MESSAGE_TYPES.cancelTransform });
  }

  private async send(message: unknown) {
    try {
      return parseResponseMessage(await this.runtime.sendMessage(message));
    } catch {
      return null;
    }
  }

  private nextRequestId(prefix: string): string {
    const suffix = this.createRequestId();
    const requestId = `${prefix}:${suffix}`;
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(requestId)) {
      throw new Error('Content request ID factory returned an invalid identifier.');
    }
    return requestId;
  }
}

function getContentRuntimeSender(): ContentRuntimeSender {
  return chrome.runtime as unknown as ContentRuntimeSender;
}

function createPlatformRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('Secure request identifiers are unavailable.');
  }
  return globalThis.crypto.randomUUID();
}
