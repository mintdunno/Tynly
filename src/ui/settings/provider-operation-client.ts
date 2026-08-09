import type {
  ProviderConnectionTestResult,
  ProviderModelInfo
} from '../../core/providers/types.ts';
import { AppError, serializeAppError, type SerializedAppError } from '../../shared/errors/index.ts';
import { MESSAGE_TYPES, parseResponseMessage } from '../../shared/messaging/index.ts';

export interface ProviderOperationRuntime {
  sendMessage(message: unknown): Promise<unknown>;
}

export type ProviderOperationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly error: SerializedAppError; readonly ok: false };

export type RequestIdFactory = () => string;

/**
 * The settings-page-only client for background-owned model discovery and
 * connection testing. It never sends a provider endpoint, secret, or header.
 */
export class ProviderOperationClient {
  constructor(
    private readonly runtime: ProviderOperationRuntime = getProviderOperationRuntime(),
    private readonly createRequestId: RequestIdFactory = createPlatformRequestId
  ) {}

  async listModels(
    profileId: string
  ): Promise<ProviderOperationResult<readonly ProviderModelInfo[]>> {
    const requestId = this.nextRequestId('models');
    const response = await this.send({
      type: MESSAGE_TYPES.listProviderModels,
      requestId,
      profileId
    });
    if (
      response?.type === MESSAGE_TYPES.providerModels &&
      response.requestId === requestId &&
      response.profileId === profileId
    ) {
      return { ok: true, value: response.models };
    }
    return readProviderOperationError(response, requestId);
  }

  async testConnection(
    profileId: string
  ): Promise<ProviderOperationResult<ProviderConnectionTestResult>> {
    const requestId = this.nextRequestId('connection');
    const response = await this.send({
      type: MESSAGE_TYPES.testProviderConnection,
      requestId,
      profileId
    });
    if (
      response?.type === MESSAGE_TYPES.providerConnectionTest &&
      response.requestId === requestId &&
      response.profileId === profileId
    ) {
      return { ok: true, value: response.result };
    }
    return readProviderOperationError(response, requestId);
  }

  private async send(message: unknown) {
    try {
      return parseResponseMessage(await this.runtime.sendMessage(message));
    } catch {
      return null;
    }
  }

  private nextRequestId(prefix: string): string {
    const requestId = `${prefix}:${this.createRequestId()}`;
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(requestId)) {
      throw new Error('Provider operation request ID factory returned an invalid identifier.');
    }
    return requestId;
  }
}

function readProviderOperationError(
  response: ReturnType<typeof parseResponseMessage>,
  requestId: string
): ProviderOperationResult<never> {
  if (response?.type === MESSAGE_TYPES.providerOperationError && response.requestId === requestId) {
    return { error: response.error, ok: false };
  }
  return { error: serializeAppError(new AppError('UNKNOWN')), ok: false };
}

function getProviderOperationRuntime(): ProviderOperationRuntime {
  return chrome.runtime as unknown as ProviderOperationRuntime;
}

function createPlatformRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('Secure request identifiers are unavailable.');
  }
  return globalThis.crypto.randomUUID();
}
