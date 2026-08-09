import {
  BUILT_IN_STYLE_IDS,
  MAX_SHORTCUT_COUNT,
  SUPPORTED_LANGUAGE_CODES,
  type AppSettings,
  type KeyboardShortcut,
  type ProviderKind,
  type ProviderProfile,
  type StyleSelection
} from '../../core/settings/schema.ts';
import type { ProviderCapabilities } from '../../core/providers/types.ts';
import {
  BUILT_IN_STYLES,
  LANGUAGE_LABELS,
  swapTransformLanguagePair
} from '../../core/transform/style-registry.ts';

export const PROVIDER_KIND_LABELS: Readonly<Record<ProviderKind, string>> = Object.freeze({
  openai: 'OpenAI',
  'openai-compatible': 'OpenAI-compatible',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  ollama: 'Ollama',
  'custom-json': 'Custom JSON API'
});

/** Mirrors the adapter capability contracts without importing provider HTTP code into the UI. */
export const PROVIDER_CAPABILITIES: Readonly<Record<ProviderKind, ProviderCapabilities>> =
  Object.freeze({
    openai: immutableCapabilities(),
    'openai-compatible': immutableCapabilities({ customHeaders: true }),
    anthropic: immutableCapabilities(),
    gemini: immutableCapabilities(),
    ollama: immutableCapabilities({ customHeaders: true }),
    'custom-json': immutableCapabilities({
      customHeaders: true,
      maxOutputTokens: false,
      temperature: false
    })
  });

export interface StyleOption {
  readonly label: string;
  readonly selection: StyleSelection;
  readonly value: string;
}

export const MAX_SHORTCUT_BINDINGS = MAX_SHORTCUT_COUNT;

export function getSourceLanguageOptions(): readonly {
  readonly label: string;
  readonly value: string;
}[] {
  return [
    { label: LANGUAGE_LABELS.auto, value: 'auto' },
    ...SUPPORTED_LANGUAGE_CODES.map((value) => ({ label: LANGUAGE_LABELS[value], value }))
  ];
}

export function getTargetLanguageOptions(): readonly {
  readonly label: string;
  readonly value: string;
}[] {
  return SUPPORTED_LANGUAGE_CODES.map((value) => ({ label: LANGUAGE_LABELS[value], value }));
}

export function getStyleOptions(settings: AppSettings): readonly StyleOption[] {
  const builtIn = BUILT_IN_STYLE_IDS.map((id) => ({
    label: BUILT_IN_STYLES[id].name,
    selection: { id, kind: 'built-in' } as const,
    value: styleSelectionValue({ id, kind: 'built-in' })
  }));
  const custom = settings.styles.custom.map((style) => ({
    label: `Custom: ${style.name}`,
    selection: { id: style.id, kind: 'custom' } as const,
    value: styleSelectionValue({ id: style.id, kind: 'custom' })
  }));
  return [...builtIn, ...custom];
}

export function styleSelectionValue(selection: StyleSelection): string {
  return `${selection.kind}:${selection.id}`;
}

export function parseStyleSelection(value: string, settings: AppSettings): StyleSelection | null {
  const separator = value.indexOf(':');
  if (separator <= 0 || separator === value.length - 1) {
    return null;
  }
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (
    kind === 'built-in' &&
    BUILT_IN_STYLE_IDS.includes(id as (typeof BUILT_IN_STYLE_IDS)[number])
  ) {
    return { id: id as (typeof BUILT_IN_STYLE_IDS)[number], kind };
  }
  if (kind === 'custom' && settings.styles.custom.some((style) => style.id === id)) {
    return { id, kind };
  }
  return null;
}

export function updateLanguage(
  settings: AppSettings,
  source: AppSettings['language']['source'],
  target: AppSettings['language']['target']
): AppSettings {
  return { ...settings, language: { source, target } };
}

export function swapLanguages(settings: AppSettings): AppSettings {
  const swapped = swapTransformLanguagePair(settings.language);
  return swapped === null ? settings : { ...settings, language: swapped };
}

export function updateSelectedStyle(settings: AppSettings, selection: StyleSelection): AppSettings {
  return { ...settings, styles: { ...settings.styles, selected: selection } };
}

export function getActiveProvider(settings: AppSettings): ProviderProfile | null {
  const id = settings.providers.activeProfileId;
  return id === null
    ? null
    : (settings.providers.profiles.find((profile) => profile.id === id) ?? null);
}

export function updateSelectedModel(
  settings: AppSettings,
  profileId: string,
  selectedModelId: string
): AppSettings {
  return {
    ...settings,
    providers: {
      ...settings.providers,
      profiles: settings.providers.profiles.map((profile) =>
        profile.id === profileId ? { ...profile, selectedModelId: selectedModelId.trim() } : profile
      )
    }
  };
}

export function createProviderProfile(kind: ProviderKind, id: string): ProviderProfile {
  const common = {
    id,
    kind,
    name: PROVIDER_KIND_LABELS[kind],
    selectedModelId: '',
    timeoutMs: 30_000,
    temperature: null,
    maxOutputTokens: null
  } as const;

  switch (kind) {
    case 'openai':
      return { ...common, kind, baseUrl: 'https://api.openai.com/v1', apiKey: '' };
    case 'openai-compatible':
      return { ...common, kind, baseUrl: 'https://api.openai.com/v1', apiKey: '', headers: [] };
    case 'anthropic':
      return { ...common, kind, baseUrl: 'https://api.anthropic.com', apiKey: '' };
    case 'gemini':
      return {
        ...common,
        kind,
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: ''
      };
    case 'ollama':
      return { ...common, kind, baseUrl: 'http://localhost:11434', headers: [] };
    case 'custom-json':
      return {
        ...common,
        kind,
        endpoint: 'https://api.example.com/transform',
        method: 'POST',
        authentication: { kind: 'none' },
        headers: [],
        modelsEndpoint: null,
        requestTemplate: '{"model":"{{model}}","prompt":"{{prompt}}"}',
        responseTextPath: 'choices.0.message.content'
      };
  }
}

export function formatShortcut(shortcut: KeyboardShortcut): string {
  const modifiers = [
    shortcut.ctrl ? 'Ctrl' : null,
    shortcut.alt ? 'Alt' : null,
    shortcut.shift ? 'Shift' : null,
    shortcut.meta ? 'Cmd' : null
  ].filter((value): value is string => value !== null);
  return [...modifiers, formatShortcutCode(shortcut.code)].join(' + ');
}

/** Formats the compact list used in the popup and shortcut settings summary. */
export function formatShortcutBindings(shortcuts: readonly KeyboardShortcut[]): string {
  return shortcuts.map(formatShortcut).join(' · ');
}

/** Adds a binding only when it is unique and the supported limit has not been reached. */
export function addShortcutBinding(
  shortcuts: readonly KeyboardShortcut[],
  shortcut: KeyboardShortcut
): KeyboardShortcut[] | null {
  if (
    shortcuts.length >= MAX_SHORTCUT_BINDINGS ||
    shortcuts.some((candidate) => shortcutsEqual(candidate, shortcut))
  ) {
    return null;
  }
  return [...shortcuts.map(cloneShortcut), cloneShortcut(shortcut)];
}

/** Replaces one binding without permitting a duplicate combination. */
export function replaceShortcutBinding(
  shortcuts: readonly KeyboardShortcut[],
  index: number,
  shortcut: KeyboardShortcut
): KeyboardShortcut[] | null {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= shortcuts.length ||
    shortcuts.some(
      (candidate, candidateIndex) => candidateIndex !== index && shortcutsEqual(candidate, shortcut)
    )
  ) {
    return null;
  }
  return shortcuts.map((candidate, candidateIndex) =>
    candidateIndex === index ? cloneShortcut(shortcut) : cloneShortcut(candidate)
  );
}

/** Removes one binding while preserving the required minimum of one. */
export function removeShortcutBinding(
  shortcuts: readonly KeyboardShortcut[],
  index: number
): KeyboardShortcut[] | null {
  if (!Number.isInteger(index) || index < 0 || index >= shortcuts.length || shortcuts.length <= 1) {
    return null;
  }
  return shortcuts.filter((_, candidateIndex) => candidateIndex !== index).map(cloneShortcut);
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent): KeyboardShortcut | null {
  if (
    event.isComposing ||
    isModifierCode(event.code) ||
    (!event.altKey && !event.ctrlKey && !event.metaKey)
  ) {
    return null;
  }
  return {
    code: event.code,
    alt: event.altKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey
  };
}

export function createSettingsIdentifier(
  prefix: 'profile' | 'style',
  createUuid: () => string = createPlatformUuid
): string {
  const suffix = createUuid();
  const identifier = `${prefix}-${suffix}`;
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(identifier)) {
    throw new Error('Settings identifier factory returned an invalid identifier.');
  }
  return identifier;
}

function immutableCapabilities(
  overrides: Partial<ProviderCapabilities> = {}
): ProviderCapabilities {
  return Object.freeze({
    connectionTest: true,
    customHeaders: false,
    manualModelId: true,
    maxOutputTokens: true,
    modelDiscovery: true,
    requestCancellation: true,
    temperature: true,
    ...overrides
  });
}

function formatShortcutCode(code: string): string {
  if (code.startsWith('Key') && code.length === 4) {
    return code.slice(3);
  }
  if (code.startsWith('Digit') && code.length === 6) {
    return code.slice(5);
  }
  return code;
}

function shortcutsEqual(left: KeyboardShortcut, right: KeyboardShortcut): boolean {
  return (
    left.code === right.code &&
    left.alt === right.alt &&
    left.ctrl === right.ctrl &&
    left.meta === right.meta &&
    left.shift === right.shift
  );
}

function cloneShortcut(shortcut: KeyboardShortcut): KeyboardShortcut {
  return { ...shortcut };
}

function isModifierCode(code: string): boolean {
  return [
    'AltLeft',
    'AltRight',
    'ControlLeft',
    'ControlRight',
    'MetaLeft',
    'MetaRight',
    'ShiftLeft',
    'ShiftRight'
  ].includes(code);
}

function createPlatformUuid(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('Secure settings identifiers are unavailable.');
  }
  return globalThis.crypto.randomUUID();
}
