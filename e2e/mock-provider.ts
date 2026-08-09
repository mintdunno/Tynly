import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export const MOCK_TRANSFORM_RESULT = 'Mocked transform complete.';

export interface MockProviderRequest {
  readonly body: unknown;
  readonly method: string;
  readonly path: string;
}

export interface MockProvider {
  readonly baseUrl: string;
  readonly fixtureUrl: string;
  readonly requests: readonly MockProviderRequest[];
  close(): Promise<void>;
}

/**
 * Local-only Ollama-shaped provider and fixture page used by Playwright. It
 * makes browser coverage deterministic without a real model or network call.
 */
export async function startMockProvider(): Promise<MockProvider> {
  const requests: MockProviderRequest[] = [];
  const server = createServer((request, response) => {
    void handleRequest(request, response, requests).catch(() => {
      if (!response.headersSent) {
        sendJson(response, 500, { error: 'mock provider failed' });
      }
    });
  });

  await listen(server);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    fixtureUrl: `${baseUrl}/fixture.html`,
    requests,
    close: () => close(server)
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  requests: MockProviderRequest[]
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://mock-provider.invalid');

  if (request.method === 'GET' && url.pathname === '/fixture.html') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(FIXTURE_PAGE);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/tags') {
    requests.push({ body: null, method: request.method, path: url.pathname });
    sendJson(response, 200, { models: [{ name: 'tynly-mock' }] });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/chat') {
    const body = await readJsonBody(request);
    requests.push({ body, method: request.method, path: url.pathname });
    sendJson(response, 200, {
      done: true,
      message: {
        content: getPrompt(body) === 'Reply with OK.' ? 'OK' : MOCK_TRANSFORM_RESULT,
        role: 'assistant'
      }
    });
    return;
  }

  sendJson(response, 404, { error: 'not found' });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  let body = '';
  for await (const chunk of request) {
    body += String(chunk);
    if (body.length > 1_000_000) {
      throw new Error('Mock provider request was unexpectedly large.');
    }
  }
  return JSON.parse(body) as unknown;
}

function getPrompt(body: unknown): string | null {
  if (!isRecord(body) || !Array.isArray(body.messages)) {
    return null;
  }
  const message = body.messages[0];
  return isRecord(message) && typeof message.content === 'string' ? message.content : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function listen(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}

const FIXTURE_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tynly browser fixture</title>
  </head>
  <body>
    <label for="message">Draft message</label>
    <textarea id="message">A draft message.</textarea>
    <label for="secret">Sensitive field</label>
    <input id="secret" name="password" type="password" value="do-not-send" />
    <p id="page-text">A normal webpage selection.</p>
  </body>
</html>`;
