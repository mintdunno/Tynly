import { AppError, type AppErrorCode } from '../../shared/errors/index.ts';

/** Settings validation uses the same bounds, while this client enforces them defensively. */
export const MIN_HTTP_TIMEOUT_MS = 1_000;
export const MAX_HTTP_TIMEOUT_MS = 120_000;
export const DEFAULT_HTTP_TIMEOUT_MS = 30_000;

export type HttpFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** A background-only request. Callers keep endpoint and credential material out of errors. */
export interface HttpRequest {
  readonly body?: BodyInit | null;
  readonly headers?: HeadersInit;
  readonly method?: string;
  readonly signal?: AbortSignal | undefined;
  readonly timeoutMs: number;
  readonly url: string;
}

export interface HttpClientOptions {
  /** Injectable for deterministic provider tests; defaults to the service worker's fetch. */
  readonly fetch?: HttpFetch;
}

/**
 * A minimal, provider-neutral fetch boundary for the extension background.
 * It intentionally never reads or records response error bodies because they
 * can contain provider diagnostics, request text, or credentials.
 */
export class HttpClient {
  private readonly fetchImplementation: HttpFetch;

  constructor(options: HttpClientOptions = {}) {
    this.fetchImplementation = options.fetch ?? defaultFetch;
  }

  async request(request: HttpRequest): Promise<Response> {
    if (request.signal?.aborted) {
      throw new AppError('CANCELLED');
    }

    const controller = new AbortController();
    let cancelledByCaller = false;
    let timedOut = false;
    const forwardCallerAbort = () => {
      cancelledByCaller = true;
      controller.abort();
    };

    request.signal?.addEventListener('abort', forwardCallerAbort, { once: true });

    const timeoutId = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, normalizeTimeoutMs(request.timeoutMs));

    try {
      const response = await this.fetchImplementation(
        request.url,
        toRequestInit(request, controller.signal)
      );

      if (cancelledByCaller || request.signal?.aborted) {
        throw new AppError('CANCELLED');
      }

      if (timedOut) {
        throw new AppError('TIMEOUT');
      }

      if (!response.ok) {
        throw new AppError(mapHttpStatusToErrorCode(response.status));
      }

      return response;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      // A caller abort always takes precedence when it races with the timeout.
      if (cancelledByCaller || request.signal?.aborted) {
        throw new AppError('CANCELLED');
      }

      if (timedOut) {
        throw new AppError('TIMEOUT');
      }

      if (isAbortError(error)) {
        throw new AppError('CANCELLED');
      }

      // Do not propagate a raw fetch error: it may include a URL or request details.
      throw new AppError('NETWORK');
    } finally {
      globalThis.clearTimeout(timeoutId);
      request.signal?.removeEventListener('abort', forwardCallerAbort);
    }
  }
}

/** Keeps a malformed caller value within the configured provider timeout envelope. */
export function normalizeTimeoutMs(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs)) {
    return DEFAULT_HTTP_TIMEOUT_MS;
  }

  return Math.min(MAX_HTTP_TIMEOUT_MS, Math.max(MIN_HTTP_TIMEOUT_MS, Math.trunc(timeoutMs)));
}

/** Maps only HTTP status metadata to fixed application error categories. */
export function mapHttpStatusToErrorCode(status: number): AppErrorCode {
  switch (status) {
    case 401:
    case 403:
      return 'AUTHENTICATION';
    case 404:
      return 'MODEL_UNAVAILABLE';
    case 408:
    case 504:
      return 'TIMEOUT';
    default:
      return 'NETWORK';
  }
}

function defaultFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(input, init);
}

function toRequestInit(request: HttpRequest, signal: AbortSignal): RequestInit {
  const init: RequestInit = { signal };

  if (request.method !== undefined) {
    init.method = request.method;
  }

  if (request.headers !== undefined) {
    init.headers = request.headers;
  }

  if (request.body !== undefined) {
    init.body = request.body;
  }

  return init;
}

function isAbortError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }

  try {
    return 'name' in error && error.name === 'AbortError';
  } catch {
    return false;
  }
}
