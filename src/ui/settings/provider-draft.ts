import type {
  CustomApiAuthentication,
  ProviderHeader,
  ProviderProfile
} from '../../core/settings/schema.ts';

export interface HeaderDraft {
  readonly originalName: string | null;
  name: string;
  value: string;
  readonly hasSavedValue: boolean;
}

interface ProviderDraftBase {
  readonly id: string;
  readonly kind: ProviderProfile['kind'];
  name: string;
  selectedModelId: string;
  timeoutMs: string;
  temperature: string;
  maxOutputTokens: string;
}

interface ApiKeyProviderDraft extends ProviderDraftBase {
  readonly kind: 'anthropic' | 'gemini' | 'openai';
  apiKey: string;
  readonly hasSavedApiKey: boolean;
  baseUrl: string;
}

interface ApiKeyHeadersProviderDraft extends ProviderDraftBase {
  readonly kind: 'openai-compatible';
  apiKey: string;
  readonly hasSavedApiKey: boolean;
  baseUrl: string;
  headers: HeaderDraft[];
}

interface OllamaProviderDraft extends ProviderDraftBase {
  readonly kind: 'ollama';
  baseUrl: string;
  headers: HeaderDraft[];
}

interface CustomJsonProviderDraft extends ProviderDraftBase {
  readonly kind: 'custom-json';
  endpoint: string;
  method: 'PATCH' | 'POST' | 'PUT';
  authentication: AuthenticationDraft;
  headers: HeaderDraft[];
  modelsEndpoint: string;
  requestTemplate: string;
  responseTextPath: string;
}

export interface AuthenticationDraft {
  kind: CustomApiAuthentication['kind'];
  headerName: string;
  secret: string;
  readonly hasSavedSecret: boolean;
}

/** Sensitive values are intentionally absent from every editable form draft. */
export type ProviderDraft =
  ApiKeyHeadersProviderDraft | ApiKeyProviderDraft | CustomJsonProviderDraft | OllamaProviderDraft;

export function toProviderDraft(profile: ProviderProfile): ProviderDraft {
  const common = {
    id: profile.id,
    kind: profile.kind,
    name: profile.name,
    selectedModelId: profile.selectedModelId,
    timeoutMs: String(profile.timeoutMs),
    temperature: profile.temperature === null ? '' : String(profile.temperature),
    maxOutputTokens: profile.maxOutputTokens === null ? '' : String(profile.maxOutputTokens)
  } as const;

  switch (profile.kind) {
    case 'openai':
    case 'anthropic':
    case 'gemini':
      return {
        ...common,
        kind: profile.kind,
        apiKey: '',
        hasSavedApiKey: profile.apiKey.trim().length > 0,
        baseUrl: profile.baseUrl
      };
    case 'openai-compatible':
      return {
        ...common,
        kind: profile.kind,
        apiKey: '',
        hasSavedApiKey: profile.apiKey.trim().length > 0,
        baseUrl: profile.baseUrl,
        headers: toHeaderDrafts(profile.headers)
      };
    case 'ollama':
      return {
        ...common,
        kind: profile.kind,
        baseUrl: profile.baseUrl,
        headers: toHeaderDrafts(profile.headers)
      };
    case 'custom-json':
      return {
        ...common,
        kind: profile.kind,
        endpoint: profile.endpoint,
        method: profile.method,
        authentication: toAuthenticationDraft(profile.authentication),
        headers: toHeaderDrafts(profile.headers),
        modelsEndpoint: profile.modelsEndpoint ?? '',
        requestTemplate: profile.requestTemplate,
        responseTextPath: profile.responseTextPath
      };
  }
}

/** Preserves saved secrets unless the user deliberately supplies a replacement. */
export function applyProviderDraft(
  previous: ProviderProfile,
  draft: ProviderDraft
): ProviderProfile {
  if (previous.id !== draft.id) {
    throw new Error('A provider draft can only update its original profile.');
  }

  const common = {
    id: previous.id,
    kind: previous.kind,
    name: draft.name.trim(),
    selectedModelId: draft.selectedModelId.trim(),
    timeoutMs: parseRequiredInteger(draft.timeoutMs, previous.timeoutMs),
    temperature: parseOptionalNumber(draft.temperature),
    maxOutputTokens: parseOptionalInteger(draft.maxOutputTokens)
  } as const;

  switch (draft.kind) {
    case 'openai':
      if (previous.kind !== 'openai') {
        throw new Error('A provider draft can only update its original profile.');
      }
      return {
        ...common,
        kind: draft.kind,
        baseUrl: draft.baseUrl.trim(),
        apiKey: replacementOrSavedSecret(draft.apiKey, previous.apiKey)
      };
    case 'anthropic':
      if (previous.kind !== 'anthropic') {
        throw new Error('A provider draft can only update its original profile.');
      }
      return {
        ...common,
        kind: draft.kind,
        baseUrl: draft.baseUrl.trim(),
        apiKey: replacementOrSavedSecret(draft.apiKey, previous.apiKey)
      };
    case 'gemini':
      if (previous.kind !== 'gemini') {
        throw new Error('A provider draft can only update its original profile.');
      }
      return {
        ...common,
        kind: draft.kind,
        baseUrl: draft.baseUrl.trim(),
        apiKey: replacementOrSavedSecret(draft.apiKey, previous.apiKey)
      };
    case 'openai-compatible':
      if (previous.kind !== 'openai-compatible') {
        throw new Error('A provider draft can only update its original profile.');
      }
      return {
        ...common,
        kind: draft.kind,
        baseUrl: draft.baseUrl.trim(),
        apiKey: replacementOrSavedSecret(draft.apiKey, previous.apiKey),
        headers: applyHeaderDrafts(previous.headers, draft.headers)
      };
    case 'ollama':
      if (previous.kind !== 'ollama') {
        throw new Error('A provider draft can only update its original profile.');
      }
      return {
        ...common,
        kind: draft.kind,
        baseUrl: draft.baseUrl.trim(),
        headers: applyHeaderDrafts(previous.headers, draft.headers)
      };
    case 'custom-json':
      if (previous.kind !== 'custom-json') {
        throw new Error('A provider draft can only update its original profile.');
      }
      return {
        ...common,
        kind: draft.kind,
        endpoint: draft.endpoint.trim(),
        method: draft.method,
        authentication: applyAuthenticationDraft(previous.authentication, draft.authentication),
        headers: applyHeaderDrafts(previous.headers, draft.headers),
        modelsEndpoint: blankToNull(draft.modelsEndpoint),
        requestTemplate: draft.requestTemplate,
        responseTextPath: draft.responseTextPath.trim()
      };
  }
}

export function addHeaderDraft(headers: readonly HeaderDraft[]): HeaderDraft[] {
  return [...headers, { originalName: null, name: '', value: '', hasSavedValue: false }];
}

function toHeaderDrafts(headers: readonly ProviderHeader[]): HeaderDraft[] {
  return headers.map((header) => ({
    originalName: header.name,
    name: header.name,
    value: '',
    hasSavedValue: header.value.trim().length > 0
  }));
}

function toAuthenticationDraft(authentication: CustomApiAuthentication): AuthenticationDraft {
  switch (authentication.kind) {
    case 'none':
      return { kind: 'none', headerName: '', secret: '', hasSavedSecret: false };
    case 'bearer':
      return {
        kind: 'bearer',
        headerName: '',
        secret: '',
        hasSavedSecret: authentication.token.trim().length > 0
      };
    case 'header':
      return {
        kind: 'header',
        headerName: authentication.headerName,
        secret: '',
        hasSavedSecret: authentication.value.trim().length > 0
      };
  }
}

function applyHeaderDrafts(
  previous: readonly ProviderHeader[],
  drafts: readonly HeaderDraft[]
): ProviderHeader[] {
  return drafts.flatMap((draft) => {
    const name = draft.name.trim();
    if (name.length === 0) {
      return [];
    }
    const original = previous.find((header) => header.name === draft.originalName);
    const value =
      draft.value.length > 0
        ? draft.value
        : original !== undefined && original.name === name
          ? original.value
          : '';
    return [{ name, value }];
  });
}

function applyAuthenticationDraft(
  previous: CustomApiAuthentication,
  draft: AuthenticationDraft
): CustomApiAuthentication {
  switch (draft.kind) {
    case 'none':
      return { kind: 'none' };
    case 'bearer':
      return {
        kind: 'bearer',
        token:
          draft.secret.length > 0 ? draft.secret : previous.kind === 'bearer' ? previous.token : ''
      };
    case 'header':
      return {
        kind: 'header',
        headerName: draft.headerName.trim(),
        value:
          draft.secret.length > 0
            ? draft.secret
            : previous.kind === 'header' && previous.headerName === draft.headerName.trim()
              ? previous.value
              : ''
      };
  }
}

function replacementOrSavedSecret(replacement: string, saved: string): string {
  return replacement.length > 0 ? replacement : saved;
}

function parseRequiredInteger(value: string, fallback: number): number {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function parseOptionalNumber(value: string): number | null {
  if (value.trim().length === 0) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseOptionalInteger(value: string): number | null {
  if (value.trim().length === 0) {
    return null;
  }
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function blankToNull(value: string): string | null {
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}
