import { AppError } from '../../shared/errors/index.ts';

import { MAX_TRANSFORM_OUTPUT_TOKENS, MIN_TRANSFORM_OUTPUT_TOKENS } from '../transform/limits.ts';

import type { ProviderHeader } from '../settings/schema.ts';
import type { HttpRequest } from './http-client.ts';

/** Provider payloads are deliberately kept well below unbounded response sizes. */
export const MAX_PROVIDER_MODELS = 512;
export const MAX_PROVIDER_MODEL_ID_LENGTH = 256;
export const MAX_PROVIDER_MODEL_LABEL_LENGTH = 256;
export const MAX_PROVIDER_TEXT_LENGTH = 50_000;
export const MAX_PROVIDER_RESPONSE_BYTES = 1_000_000;

/** Headers controlled by an adapter or by the browser must never be replaced by user input. */
const RESERVED_CUSTOM_HEADERS = new Set([
  'authorization',
  'cookie',
  'connection',
  'content-length',
  'content-type',
  'host',
  'transfer-encoding'
]);

export interface BoundedModel {
  readonly id: string;
  readonly label: string;
}

/** Reads an API root without allowing credentials, query strings, or fragments into requests. */
export function joinProviderUrl(
  baseUrl: string,
  path: string,
  protocol: 'https' | 'ollama'
): string {
  if (typeof baseUrl !== 'string' || baseUrl.length === 0 || /[\r\n]/u.test(baseUrl)) {
    throw new AppError('CONFIGURATION');
  }

  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new AppError('CONFIGURATION');
  }

  const allowsProtocol =
    protocol === 'https'
      ? url.protocol === 'https:'
      : url.protocol === 'https:' || (url.protocol === 'http:' && isLoopbackHost(url.hostname));
  if (
    !allowsProtocol ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0 ||
    !path.startsWith('/') ||
    path.includes('?') ||
    path.includes('#')
  ) {
    throw new AppError('CONFIGURATION');
  }

  const rootPath = url.pathname.replace(/\/+$/u, '');
  return `${url.origin}${rootPath}${path}`;
}

/** Merges safe user headers while preventing auth and transport header spoofing. */
export function mergeProviderHeaders(
  baseHeaders: Readonly<Record<string, string>>,
  customHeaders: readonly ProviderHeader[] | undefined,
  options: { readonly allowAuthorization?: boolean } = {}
): Readonly<Record<string, string>> {
  const custom: Record<string, string> = {};
  const seenCustomNames = new Set<string>();
  const reservedHeaders = new Set(RESERVED_CUSTOM_HEADERS);
  if (options.allowAuthorization === true) {
    reservedHeaders.delete('authorization');
  }

  if (customHeaders === undefined) {
    return { ...baseHeaders };
  }

  if (!Array.isArray(customHeaders) || customHeaders.length > 32) {
    throw new AppError('CONFIGURATION');
  }

  for (const header of customHeaders) {
    if (!isSafeHeaderPart(header?.name) || !isSafeHeaderValue(header?.value)) {
      throw new AppError('CONFIGURATION');
    }

    const normalizedName = header.name.toLowerCase();
    if (
      reservedHeaders.has(normalizedName) ||
      normalizedName.startsWith('sec-') ||
      normalizedName.startsWith('proxy-') ||
      seenCustomNames.has(normalizedName)
    ) {
      throw new AppError('CONFIGURATION');
    }
    seenCustomNames.add(normalizedName);
    custom[header.name] = header.value;
  }

  // Custom values are collected first. Mandatory adapter headers always win.
  const merged: Record<string, string> = { ...custom };
  for (const [name, value] of Object.entries(baseHeaders)) {
    for (const existingName of Object.keys(merged)) {
      if (existingName.toLowerCase() === name.toLowerCase()) {
        delete merged[existingName];
      }
    }
    merged[name] = value;
  }
  return merged;
}

export function withOptionalSignal(
  request: Omit<HttpRequest, 'signal'>,
  signal?: AbortSignal
): HttpRequest {
  return signal === undefined ? request : { ...request, signal };
}

/** Keeps a Phase 3 estimate and a profile override within the provider-safe envelope. */
export function effectiveOutputTokens(requested: number, configured: number | null): number {
  const requestBudget = Number.isFinite(requested)
    ? Math.trunc(requested)
    : MIN_TRANSFORM_OUTPUT_TOKENS;
  const boundedRequest = Math.min(
    MAX_TRANSFORM_OUTPUT_TOKENS,
    Math.max(MIN_TRANSFORM_OUTPUT_TOKENS, requestBudget)
  );

  if (configured === null || !Number.isFinite(configured)) {
    return boundedRequest;
  }

  return Math.min(boundedRequest, Math.max(1, Math.trunc(configured)));
}

/** Adds a validated optional temperature while preserving an intentional zero. */
export function appendTemperature(
  body: Record<string, unknown>,
  temperature: number | null | undefined
): void {
  if (temperature === null || temperature === undefined) {
    return;
  }
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new AppError('CONFIGURATION');
  }
  body.temperature = temperature;
}

/** Reads only plain JSON records. Accessors and class instances are not provider payloads. */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
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

export function readDataProperty(record: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor !== undefined && Object.hasOwn(descriptor, 'value')
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

export function isBoundedText(
  value: unknown,
  maximum: number,
  options: { readonly allowEmpty?: boolean; readonly allowNewlines?: boolean } = {}
): value is string {
  return (
    typeof value === 'string' &&
    value.length <= maximum &&
    (options.allowNewlines === true || !/[\r\n]/u.test(value)) &&
    (options.allowEmpty === true || value.trim().length > 0)
  );
}

export function parseModelList(
  value: unknown,
  readModel: (entry: Record<string, unknown>) => string | null
): readonly BoundedModel[] {
  if (!isPlainRecord(value)) {
    throw new AppError('INVALID_RESPONSE');
  }

  const rawModels = readDataProperty(value, 'data');
  if (!Array.isArray(rawModels)) {
    throw new AppError('INVALID_RESPONSE');
  }

  return dedupeModels(rawModels, readModel);
}

export function parseOllamaModelList(value: unknown): readonly BoundedModel[] {
  if (!isPlainRecord(value)) {
    throw new AppError('INVALID_RESPONSE');
  }

  const rawModels = readDataProperty(value, 'models');
  if (!Array.isArray(rawModels)) {
    throw new AppError('INVALID_RESPONSE');
  }

  return dedupeModels(rawModels, (entry) => {
    const name = readDataProperty(entry, 'name');
    const model = readDataProperty(entry, 'model');
    return validModelId(name) ? name : validModelId(model) ? model : null;
  });
}

/** Parses one successful JSON body without preserving parser/provider diagnostics. */
export async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    const contentLength =
      typeof response.headers?.get === 'function' ? response.headers.get('content-length') : null;
    if (contentLength !== null) {
      const parsedLength = Number(contentLength);
      if (
        !Number.isFinite(parsedLength) ||
        parsedLength < 0 ||
        parsedLength > MAX_PROVIDER_RESPONSE_BYTES
      ) {
        throw new AppError('INVALID_RESPONSE');
      }
    }
    return JSON.parse(await readBoundedResponseText(response)) as unknown;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('INVALID_RESPONSE');
  }
}

/**
 * Reads a successful provider body as UTF-8 while limiting the actual byte
 * count. `Response.text()` buffers an entire stream first, so it cannot enforce
 * the cap for chunked responses with no Content-Length header.
 */
async function readBoundedResponseText(response: Response): Promise<string> {
  const stream = response.body;
  if (stream === null) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_PROVIDER_RESPONSE_BYTES) {
      throw new AppError('INVALID_RESPONSE');
    }
    return text;
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > MAX_PROVIDER_RESPONSE_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // The response is already rejected; cancellation diagnostics are not safe to expose.
        }
        throw new AppError('INVALID_RESPONSE');
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function readChatText(value: unknown, path: 'openai' | 'ollama'): string {
  if (!isPlainRecord(value)) {
    throw new AppError('INVALID_RESPONSE');
  }

  const content = path === 'openai' ? readOpenAiContent(value) : readOllamaContent(value);
  if (!isBoundedText(content, MAX_PROVIDER_TEXT_LENGTH, { allowNewlines: true })) {
    throw new AppError('INVALID_RESPONSE');
  }

  return content;
}

function readOpenAiContent(value: Record<string, unknown>): unknown {
  const choices = readDataProperty(value, 'choices');
  if (!Array.isArray(choices) || choices.length === 0 || choices.length > 16) {
    return undefined;
  }

  const firstChoice = choices[0];
  if (!isPlainRecord(firstChoice)) {
    return undefined;
  }

  const message = readDataProperty(firstChoice, 'message');
  if (!isPlainRecord(message)) {
    return undefined;
  }

  return readDataProperty(message, 'content');
}

function readOllamaContent(value: Record<string, unknown>): unknown {
  const message = readDataProperty(value, 'message');
  if (!isPlainRecord(message)) {
    return undefined;
  }

  return readDataProperty(message, 'content');
}

function dedupeModels(
  rawModels: readonly unknown[],
  readModel: (entry: Record<string, unknown>) => string | null
): readonly BoundedModel[] {
  const models: BoundedModel[] = [];
  const seen = new Set<string>();

  for (const rawModel of rawModels) {
    if (models.length >= MAX_PROVIDER_MODELS) {
      break;
    }
    if (!isPlainRecord(rawModel)) {
      continue;
    }

    let id: string | null;
    try {
      id = readModel(rawModel);
    } catch {
      id = null;
    }
    if (id === null || !validModelId(id) || seen.has(id)) {
      continue;
    }

    seen.add(id);
    models.push({ id, label: id.slice(0, MAX_PROVIDER_MODEL_LABEL_LENGTH) });
  }

  return models;
}

function validModelId(value: unknown): value is string {
  return isBoundedText(value, MAX_PROVIDER_MODEL_ID_LENGTH) && value === value.trim();
}

function isSafeHeaderPart(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= 128 && !/[\r\n]/u.test(value)
  );
}

function isSafeHeaderValue(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 8_192 && !/[\r\n]/u.test(value);
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/u.test(hostname)
  );
}
