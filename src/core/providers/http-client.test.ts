import { describe, expect, it, vi } from 'vitest';

import {
  getAppErrorUserMessage,
  serializeAppError,
  type AppError
} from '../../shared/errors/index.ts';
import {
  DEFAULT_HTTP_TIMEOUT_MS,
  HttpClient,
  MAX_HTTP_TIMEOUT_MS,
  MIN_HTTP_TIMEOUT_MS,
  mapHttpStatusToErrorCode,
  normalizeTimeoutMs,
  type HttpFetch
} from './http-client.ts';

describe('HttpClient', () => {
  it('forwards the request and its abort signal to the injected fetch implementation', async () => {
    const fetch = vi.fn<HttpFetch>().mockResolvedValue(successResponse());
    const client = new HttpClient({ fetch });
    const callerController = new AbortController();
    const headers = { Authorization: 'Bearer super-secret-token' };

    await expect(
      client.request({
        url: 'https://provider.example.test/v1/chat/completions',
        method: 'POST',
        headers,
        body: '{"prompt":"private text"}',
        signal: callerController.signal,
        timeoutMs: 20_000
      })
    ).resolves.toMatchObject({ ok: true });

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      'https://provider.example.test/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers,
        body: '{"prompt":"private text"}',
        signal: expect.any(AbortSignal)
      })
    );
    expect(fetch.mock.calls[0]?.[1]?.signal).not.toBe(callerController.signal);
  });

  it('returns CANCELLED without starting fetch when the caller already aborted', async () => {
    const fetch = vi.fn<HttpFetch>();
    const client = new HttpClient({ fetch });
    const callerController = new AbortController();
    callerController.abort();

    await expect(
      client.request({
        url: 'https://provider.example.test/v1/models',
        signal: callerController.signal,
        timeoutMs: 20_000
      })
    ).rejects.toMatchObject({ code: 'CANCELLED' });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('forwards a caller cancellation and reports CANCELLED even when it races with a timeout', async () => {
    vi.useFakeTimers();

    try {
      const fetch = vi.fn<HttpFetch>((_url, init) => awaitAbort(init?.signal));
      const client = new HttpClient({ fetch });
      const callerController = new AbortController();
      const pending = client.request({
        url: 'https://provider.example.test/v1/models',
        signal: callerController.signal,
        timeoutMs: MIN_HTTP_TIMEOUT_MS
      });
      const rejected = expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });

      callerController.abort();
      await vi.advanceTimersByTimeAsync(MIN_HTTP_TIMEOUT_MS);

      await rejected;
      expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts a slow request at the bounded timeout and reports TIMEOUT', async () => {
    vi.useFakeTimers();

    try {
      const fetch = vi.fn<HttpFetch>((_url, init) => awaitAbort(init?.signal));
      const client = new HttpClient({ fetch });
      const pending = client.request({
        url: 'https://provider.example.test/v1/models',
        timeoutMs: 1
      });
      const rejected = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });

      await vi.advanceTimersByTimeAsync(MIN_HTTP_TIMEOUT_MS);

      await rejected;
      expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the timeout active while a successful response is being read', async () => {
    vi.useFakeTimers();

    try {
      let requestSignal: AbortSignal | undefined;
      const fetch = vi.fn<HttpFetch>((_url, init) => {
        requestSignal = init?.signal ?? undefined;
        return Promise.resolve(successResponse());
      });
      const client = new HttpClient({ fetch });
      const pending = client.request(
        {
          url: 'https://provider.example.test/v1/models',
          timeoutMs: MIN_HTTP_TIMEOUT_MS
        },
        async () => awaitAbort(requestSignal)
      );
      const rejected = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });

      await vi.advanceTimersByTimeAsync(MIN_HTTP_TIMEOUT_MS);

      await rejected;
      expect(requestSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('converts fetch failures to a safe NETWORK error without response or request diagnostics', async () => {
    const privateUrl = 'https://user:password@provider.example.test/v1?api_key=super-secret';
    const privateBody = 'Bearer super-secret-token private prompt';
    const fetch = vi
      .fn<HttpFetch>()
      .mockRejectedValue(new TypeError(`Could not reach ${privateUrl}; ${privateBody}`));
    const client = new HttpClient({ fetch });

    const error = await client
      .request({
        url: privateUrl,
        body: privateBody,
        timeoutMs: 20_000
      })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: 'NETWORK',
      message: getAppErrorUserMessage('NETWORK')
    });
    expect((error as AppError).details).toBeUndefined();
    expect(JSON.stringify(serializeAppError(error))).not.toContain('super-secret');
    expect(JSON.stringify(serializeAppError(error))).not.toContain('provider.example.test');
  });

  it.each([
    [401, 'AUTHENTICATION'],
    [403, 'AUTHENTICATION'],
    [404, 'MODEL_UNAVAILABLE'],
    [408, 'TIMEOUT'],
    [429, 'NETWORK'],
    [500, 'NETWORK'],
    [504, 'TIMEOUT']
  ] as const)('maps HTTP %i to a safe %s error without reading its body', async (status, code) => {
    const readBody = vi.fn(() => Promise.resolve('apiKey=super-secret'));
    const fetch = vi.fn<HttpFetch>().mockResolvedValue({
      ok: false,
      status,
      text: readBody
    } as unknown as Response);
    const client = new HttpClient({ fetch });

    const error = await client
      .request({
        url: 'https://provider.example.test/v1/private',
        timeoutMs: 20_000
      })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code,
      message: getAppErrorUserMessage(code)
    });
    expect(readBody).not.toHaveBeenCalled();
  });
});

describe('HTTP timeout and status helpers', () => {
  it('clamps finite configured timeouts and recovers a safe default for non-finite values', () => {
    expect(normalizeTimeoutMs(1)).toBe(MIN_HTTP_TIMEOUT_MS);
    expect(normalizeTimeoutMs(20_000.8)).toBe(20_000);
    expect(normalizeTimeoutMs(MAX_HTTP_TIMEOUT_MS + 1)).toBe(MAX_HTTP_TIMEOUT_MS);
    expect(normalizeTimeoutMs(Number.NaN)).toBe(DEFAULT_HTTP_TIMEOUT_MS);
    expect(normalizeTimeoutMs(Number.POSITIVE_INFINITY)).toBe(DEFAULT_HTTP_TIMEOUT_MS);
  });

  it.each([
    [401, 'AUTHENTICATION'],
    [404, 'MODEL_UNAVAILABLE'],
    [408, 'TIMEOUT'],
    [502, 'NETWORK']
  ] as const)('maps HTTP %i to %s', (status, code) => {
    expect(mapHttpStatusToErrorCode(status)).toBe(code);
  });
});

function successResponse(): Response {
  return { ok: true, status: 200 } as Response;
}

function awaitAbort(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    signal?.addEventListener('abort', () => reject(createAbortError()), { once: true });
  });
}

function createAbortError(): Error {
  const error = new Error('The request was aborted.');
  error.name = 'AbortError';
  return error;
}
