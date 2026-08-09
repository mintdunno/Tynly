/** The only placeholders permitted inside custom JSON template string values. */
export const CUSTOM_JSON_TEMPLATE_VARIABLES = [
  'prompt',
  'text',
  'model',
  'source',
  'target',
  'style'
] as const;

export type CustomJsonTemplateVariable = (typeof CUSTOM_JSON_TEMPLATE_VARIABLES)[number];

export type CustomJsonTemplateValues = Readonly<Record<CustomJsonTemplateVariable, string>>;

export type CustomJsonValue =
  boolean | null | number | string | CustomJsonValue[] | CustomJsonObject;

export interface CustomJsonObject {
  readonly [key: string]: CustomJsonValue;
}

const MAX_TEMPLATE_DEPTH = 32;
const MAX_TEMPLATE_NODES = 1_024;
const MAX_INTERPOLATED_TEMPLATE_CHARACTERS = 200_000;
const MAX_RESPONSE_PATH_SEGMENTS = 64;
const MAX_RESPONSE_PATH_SEGMENT_LENGTH = 128;
const MAX_ARRAY_INDEX = 4_294_967_294;

const ALLOWED_TEMPLATE_VARIABLES = new Set<string>(CUSTOM_JSON_TEMPLATE_VARIABLES);
const DANGEROUS_COMPONENTS = new Set(['__proto__', 'constructor', 'prototype']);
const SAFE_HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;
const SAFE_PROPERTY_SEGMENT = /^[A-Za-z_$][A-Za-z0-9_$-]*$/u;
const SAFE_ARRAY_INDEX_SEGMENT = /^(0|[1-9][0-9]{0,9})$/u;
const FORBIDDEN_HEADER_NAMES = new Set([
  'connection',
  'content-length',
  'content-type',
  'cookie',
  'host',
  'origin',
  'referer',
  'set-cookie',
  'transfer-encoding',
  'user-agent'
]);
const MISSING_VALUE = Symbol('missing-custom-json-value');

interface TemplateValidationState {
  nodeCount: number;
}

interface InterpolationBudget {
  characterCount: number;
}

type InterpolationResult =
  { readonly ok: true; readonly value: CustomJsonValue } | { readonly ok: false };

/**
 * Parses a custom request template as inert JSON only. Template keys and all
 * nested values are bounded before any user request is constructed.
 */
export function parseCustomJsonRequestTemplate(
  value: unknown,
  maximumLength: number
): CustomJsonObject | null {
  if (
    typeof value !== 'string' ||
    !Number.isInteger(maximumLength) ||
    maximumLength <= 0 ||
    value.length === 0 ||
    value.length > maximumLength
  ) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return null;
  }

  if (!isPlainRecord(parsed)) {
    return null;
  }

  const state: TemplateValidationState = { nodeCount: 0 };
  return isSafeTemplateValue(parsed, 0, state) ? (parsed as CustomJsonObject) : null;
}

/**
 * Replaces only approved placeholders in already-parsed string values. The
 * result is a new data-only object, never code or an executable template.
 */
export function interpolateCustomJsonRequestTemplate(
  template: string,
  variables: CustomJsonTemplateValues,
  maximumLength: number
): CustomJsonObject | null {
  const parsed = parseCustomJsonRequestTemplate(template, maximumLength);
  if (parsed === null || !hasTemplateVariables(variables)) {
    return null;
  }

  const budget: InterpolationBudget = { characterCount: 0 };
  const result = interpolateTemplateValue(parsed, variables, budget);
  return result.ok && isPlainRecord(result.value) ? (result.value as CustomJsonObject) : null;
}

/** Parses a dot-only response path without permitting prototype traversal syntax. */
export function parseCustomJsonResponsePath(
  value: unknown,
  maximumLength: number
): readonly string[] | null {
  if (
    typeof value !== 'string' ||
    !Number.isInteger(maximumLength) ||
    maximumLength <= 0 ||
    value.length === 0 ||
    value.length > maximumLength ||
    value !== value.trim() ||
    /[\r\n]/u.test(value)
  ) {
    return null;
  }

  const segments = value.split('.');
  if (
    segments.length === 0 ||
    segments.length > MAX_RESPONSE_PATH_SEGMENTS ||
    !segments.every(isSafeResponsePathSegment)
  ) {
    return null;
  }

  return segments;
}

/** Reads an own data property path and accepts only bounded, nonblank text at its end. */
export function readCustomJsonResponseText(
  value: unknown,
  path: readonly string[],
  maximumTextLength: number
): string | null {
  if (
    !Array.isArray(path) ||
    path.length === 0 ||
    path.length > MAX_RESPONSE_PATH_SEGMENTS ||
    !Number.isInteger(maximumTextLength) ||
    maximumTextLength <= 0 ||
    !path.every(isSafeResponsePathSegment)
  ) {
    return null;
  }

  let current: unknown = value;
  for (const segment of path) {
    if (Array.isArray(current)) {
      if (!isSafeArrayIndexSegment(segment)) {
        return null;
      }
      const item = readOwnDataValue(current, segment);
      if (item === MISSING_VALUE) {
        return null;
      }
      current = item;
      continue;
    }

    if (!isPlainRecord(current)) {
      return null;
    }

    const item = readOwnDataValue(current, segment);
    if (item === MISSING_VALUE) {
      return null;
    }
    current = item;
  }

  return typeof current === 'string' &&
    current.length <= maximumTextLength &&
    current.trim().length > 0
    ? current
    : null;
}

/** Validates a custom request/authentication header name before it reaches fetch. */
export function isSafeCustomJsonHeaderName(
  value: unknown,
  options: { readonly allowAuthorization?: boolean } = {}
): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 128 ||
    !SAFE_HEADER_NAME.test(value)
  ) {
    return false;
  }

  const normalized = value.toLowerCase();
  if (normalized === 'authorization') {
    return options.allowAuthorization === true;
  }

  return (
    !FORBIDDEN_HEADER_NAMES.has(normalized) &&
    !DANGEROUS_COMPONENTS.has(normalized) &&
    !normalized.startsWith('proxy-') &&
    !normalized.startsWith('sec-') &&
    !normalized.startsWith('x-forwarded-')
  );
}

function isSafeTemplateValue(
  value: unknown,
  depth: number,
  state: TemplateValidationState
): value is CustomJsonValue {
  state.nodeCount += 1;
  if (depth > MAX_TEMPLATE_DEPTH || state.nodeCount > MAX_TEMPLATE_NODES) {
    return false;
  }

  if (value === null || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'string') {
    return hasOnlySupportedPlaceholders(value);
  }
  if (Array.isArray(value)) {
    return value.every((entry) => isSafeTemplateValue(entry, depth + 1, state));
  }
  if (!isPlainRecord(value)) {
    return false;
  }

  for (const key of Object.keys(value)) {
    if (isDangerousComponent(key) || key.includes('{{') || key.includes('}}')) {
      return false;
    }

    const nested = readOwnDataValue(value, key);
    if (nested === MISSING_VALUE || !isSafeTemplateValue(nested, depth + 1, state)) {
      return false;
    }
  }

  return true;
}

function interpolateTemplateValue(
  value: CustomJsonValue,
  variables: CustomJsonTemplateValues,
  budget: InterpolationBudget
): InterpolationResult {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return { ok: true, value };
  }
  if (typeof value === 'string') {
    const interpolated = interpolateTemplateString(value, variables, budget);
    return interpolated === null ? { ok: false } : { ok: true, value: interpolated };
  }
  if (Array.isArray(value)) {
    const output: CustomJsonValue[] = [];
    for (const entry of value) {
      const result = interpolateTemplateValue(entry, variables, budget);
      if (!result.ok) {
        return result;
      }
      output.push(result.value);
    }
    return { ok: true, value: output };
  }

  const output: Record<string, CustomJsonValue> = Object.create(null) as Record<
    string,
    CustomJsonValue
  >;
  for (const key of Object.keys(value)) {
    const nested = readOwnDataValue(value, key);
    if (nested === MISSING_VALUE || !isCustomJsonValue(nested)) {
      return { ok: false };
    }

    const result = interpolateTemplateValue(nested, variables, budget);
    if (!result.ok) {
      return result;
    }
    output[key] = result.value;
  }
  return { ok: true, value: output };
}

function interpolateTemplateString(
  template: string,
  variables: CustomJsonTemplateValues,
  budget: InterpolationBudget
): string | null {
  let cursor = 0;
  let output = '';

  while (cursor < template.length) {
    const opening = template.indexOf('{{', cursor);
    if (opening === -1) {
      const tail = template.slice(cursor);
      return appendInterpolatedText(output, tail, budget);
    }

    const prefix = template.slice(cursor, opening);
    const afterPrefix = appendInterpolatedText(output, prefix, budget);
    if (afterPrefix === null) {
      return null;
    }
    output = afterPrefix;

    const closing = template.indexOf('}}', opening + 2);
    if (closing === -1) {
      return null;
    }

    const variable = template.slice(opening + 2, closing);
    if (!ALLOWED_TEMPLATE_VARIABLES.has(variable)) {
      return null;
    }

    const replacement = variables[variable as CustomJsonTemplateVariable];
    const afterReplacement = appendInterpolatedText(output, replacement, budget);
    if (afterReplacement === null) {
      return null;
    }
    output = afterReplacement;
    cursor = closing + 2;
  }

  return output;
}

function appendInterpolatedText(
  current: string,
  appended: string,
  budget: InterpolationBudget
): string | null {
  if (budget.characterCount + appended.length > MAX_INTERPOLATED_TEMPLATE_CHARACTERS) {
    return null;
  }

  budget.characterCount += appended.length;
  return current + appended;
}

function hasOnlySupportedPlaceholders(value: string): boolean {
  let cursor = 0;
  while (cursor < value.length) {
    const opening = value.indexOf('{{', cursor);
    const closing = value.indexOf('}}', cursor);
    if (opening === -1) {
      return closing === -1;
    }
    if (closing !== -1 && closing < opening) {
      return false;
    }

    const end = value.indexOf('}}', opening + 2);
    if (end === -1 || !ALLOWED_TEMPLATE_VARIABLES.has(value.slice(opening + 2, end))) {
      return false;
    }
    cursor = end + 2;
  }

  return true;
}

function hasTemplateVariables(value: CustomJsonTemplateValues): boolean {
  return CUSTOM_JSON_TEMPLATE_VARIABLES.every((key) => typeof value[key] === 'string');
}

function isSafeResponsePathSegment(segment: string): boolean {
  return (
    typeof segment === 'string' &&
    segment.length > 0 &&
    segment.length <= MAX_RESPONSE_PATH_SEGMENT_LENGTH &&
    !isDangerousComponent(segment) &&
    (isSafeArrayIndexSegment(segment) || SAFE_PROPERTY_SEGMENT.test(segment))
  );
}

function isSafeArrayIndexSegment(segment: string): boolean {
  return SAFE_ARRAY_INDEX_SEGMENT.test(segment) && Number(segment) <= MAX_ARRAY_INDEX;
}

function isDangerousComponent(value: string): boolean {
  return DANGEROUS_COMPONENTS.has(value.toLowerCase());
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
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

function isCustomJsonValue(value: unknown): value is CustomJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isCustomJsonValue);
  }
  return isPlainRecord(value) && Object.keys(value).every((key) => isCustomJsonValue(value[key]));
}

function readOwnDataValue(value: object, key: string): unknown | typeof MISSING_VALUE {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && Object.hasOwn(descriptor, 'value')
      ? descriptor.value
      : MISSING_VALUE;
  } catch {
    return MISSING_VALUE;
  }
}
