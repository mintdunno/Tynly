/**
 * The persisted settings format is intentionally independent from Chrome storage
 * APIs.  Only trusted extension contexts may read an AppSettings value; content
 * scripts receive ContentSettingsSnapshot instead.
 */

export const CURRENT_SETTINGS_VERSION = 1 as const;

export const SUPPORTED_LANGUAGE_CODES = ['vi', 'en', 'ja', 'ko', 'zh', 'fr', 'de', 'es'] as const;

export const BUILT_IN_STYLE_IDS = [
  'natural',
  'professional',
  'casual',
  'formal',
  'concise',
  'literal'
] as const;

export const PROVIDER_KINDS = [
  'openai',
  'openai-compatible',
  'anthropic',
  'gemini',
  'ollama',
  'custom-json'
] as const;

export const FIELD_BUTTON_POSITIONS = [
  'bottom-right',
  'bottom-left',
  'top-right',
  'top-left'
] as const;

export const HTTP_METHODS = ['POST', 'PUT', 'PATCH'] as const;

export type SettingsVersion = typeof CURRENT_SETTINGS_VERSION;
export type LanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];
export type SourceLanguage = LanguageCode | 'auto';
export type TargetLanguage = LanguageCode;
export type BuiltInStyleId = (typeof BUILT_IN_STYLE_IDS)[number];
export type ProviderKind = (typeof PROVIDER_KINDS)[number];
export type FieldButtonPosition = (typeof FIELD_BUTTON_POSITIONS)[number];
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface LanguageSettings {
  source: SourceLanguage;
  target: TargetLanguage;
}

export interface BehaviorSettings {
  afterTransform: 'replace' | 'preview';
  showUndoNotification: boolean;
}

/** The physical key code keeps shortcuts layout-independent. */
export interface KeyboardShortcut {
  code: string;
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

export interface ShortcutSettings {
  enabled: boolean;
  shortcut: KeyboardShortcut;
}

export interface FieldButtonSettings {
  enabled: boolean;
  position: FieldButtonPosition;
  appearance: 'tynly-icon' | 'monochrome-icon';
  clickBehavior: 'transform-immediately' | 'show-preview';
}

export interface SelectionSettings {
  enabled: boolean;
  editableBehavior: 'replace' | 'preview';
  pageBehavior: 'show-result';
}

export interface ControlsSettings {
  shortcut: ShortcutSettings;
  fieldButton: FieldButtonSettings;
  selection: SelectionSettings;
}

export interface CustomStyle {
  id: string;
  name: string;
  instruction: string;
}

export type StyleSelection =
  { kind: 'built-in'; id: BuiltInStyleId } | { kind: 'custom'; id: string };

export interface StylesSettings {
  selected: StyleSelection;
  custom: CustomStyle[];
}

/**
 * Header values are private.  This applies even to apparently harmless values:
 * a custom header can be an authorization mechanism in disguise.
 */
export interface ProviderHeader {
  name: string;
  value: string;
}

export interface ProviderProfileBase {
  id: string;
  name: string;
  kind: ProviderKind;
  /** An empty value is valid while a user is still configuring a profile. */
  selectedModelId: string;
  timeoutMs: number;
  /** Null means the provider default should be used. */
  temperature: number | null;
  /** Null means the provider default should be used. */
  maxOutputTokens: number | null;
}

export interface OpenAiProviderProfile extends ProviderProfileBase {
  kind: 'openai';
  baseUrl: string;
  apiKey: string;
}

export interface OpenAiCompatibleProviderProfile extends ProviderProfileBase {
  kind: 'openai-compatible';
  baseUrl: string;
  apiKey: string;
  headers: ProviderHeader[];
}

export interface AnthropicProviderProfile extends ProviderProfileBase {
  kind: 'anthropic';
  baseUrl: string;
  apiKey: string;
}

export interface GeminiProviderProfile extends ProviderProfileBase {
  kind: 'gemini';
  baseUrl: string;
  apiKey: string;
}

export interface OllamaProviderProfile extends ProviderProfileBase {
  kind: 'ollama';
  baseUrl: string;
  headers: ProviderHeader[];
}

export type CustomApiAuthentication =
  | { kind: 'none' }
  | { kind: 'bearer'; token: string }
  | { kind: 'header'; headerName: string; value: string };

export interface CustomJsonProviderProfile extends ProviderProfileBase {
  kind: 'custom-json';
  endpoint: string;
  method: HttpMethod;
  authentication: CustomApiAuthentication;
  headers: ProviderHeader[];
  modelsEndpoint: string | null;
  requestTemplate: string;
  responseTextPath: string;
}

export type ProviderProfile =
  | OpenAiProviderProfile
  | OpenAiCompatibleProviderProfile
  | AnthropicProviderProfile
  | GeminiProviderProfile
  | OllamaProviderProfile
  | CustomJsonProviderProfile;

export interface ProviderSettings {
  activeProfileId: string | null;
  profiles: ProviderProfile[];
}

/** Private, local-only canonical settings. */
export interface AppSettings {
  version: SettingsVersion;
  language: LanguageSettings;
  behavior: BehaviorSettings;
  controls: ControlsSettings;
  styles: StylesSettings;
  providers: ProviderSettings;
}

/**
 * The only provider information which may cross into a content script.  It
 * intentionally omits endpoints, headers, templates, response paths, and all
 * authentication values.
 */
export interface ContentProviderSummary {
  id: string;
  name: string;
  kind: ProviderKind;
  selectedModelId: string;
  configured: boolean;
}

export interface ContentSettingsSnapshot {
  version: SettingsVersion;
  language: LanguageSettings;
  behavior: BehaviorSettings;
  controls: ControlsSettings;
  styles: StylesSettings;
  activeProvider: ContentProviderSummary | null;
}

export interface SettingsValidationIssue {
  path: string;
  message: string;
}

export type SettingsValidationResult =
  { ok: true; value: AppSettings } | { ok: false; issues: readonly SettingsValidationIssue[] };

const MAX_PROFILE_ID_LENGTH = 64;
const MAX_PROFILE_NAME_LENGTH = 120;
const MAX_MODEL_ID_LENGTH = 256;
const MAX_SECRET_LENGTH = 16_384;
const MAX_HEADER_COUNT = 32;
const MAX_HEADER_VALUE_LENGTH = 8_192;
const MAX_CUSTOM_STYLE_COUNT = 30;
const MAX_CUSTOM_STYLE_NAME_LENGTH = 80;
const MAX_CUSTOM_STYLE_INSTRUCTION_LENGTH = 500;
const MAX_ENDPOINT_LENGTH = 2_048;
const MAX_TEMPLATE_LENGTH = 32_768;
const MAX_RESPONSE_PATH_LENGTH = 512;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_TOKENS = 16_384;

const profileIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const headerNamePattern = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

export function isLanguageCode(value: unknown): value is LanguageCode {
  return isOneOf(value, SUPPORTED_LANGUAGE_CODES);
}

export function isSourceLanguage(value: unknown): value is SourceLanguage {
  return value === 'auto' || isLanguageCode(value);
}

export function isTargetLanguage(value: unknown): value is TargetLanguage {
  return isLanguageCode(value);
}

export function isBuiltInStyleId(value: unknown): value is BuiltInStyleId {
  return isOneOf(value, BUILT_IN_STYLE_IDS);
}

export function isProviderKind(value: unknown): value is ProviderKind {
  return isOneOf(value, PROVIDER_KINDS);
}

export function isProviderProfile(value: unknown): value is ProviderProfile {
  if (!isRecord(value) || !isProviderProfileBase(value)) {
    return false;
  }

  switch (value.kind) {
    case 'openai':
    case 'anthropic':
    case 'gemini':
      return isHttpUrl(value.baseUrl) && isSecret(value.apiKey);
    case 'openai-compatible':
      return isHttpUrl(value.baseUrl) && isSecret(value.apiKey) && isProviderHeaders(value.headers);
    case 'ollama':
      return isHttpUrl(value.baseUrl) && isProviderHeaders(value.headers);
    case 'custom-json':
      return (
        isHttpUrl(value.endpoint) &&
        isOneOf(value.method, HTTP_METHODS) &&
        isCustomApiAuthentication(value.authentication) &&
        isProviderHeaders(value.headers) &&
        (value.modelsEndpoint === null || isHttpUrl(value.modelsEndpoint)) &&
        isBoundedText(value.requestTemplate, MAX_TEMPLATE_LENGTH) &&
        isNonBlankSingleLineText(value.responseTextPath, MAX_RESPONSE_PATH_LENGTH)
      );
    default:
      return false;
  }
}

export function isAppSettings(value: unknown): value is AppSettings {
  return validateAppSettings(value).ok;
}

export function validateAppSettings(value: unknown): SettingsValidationResult {
  const issues: SettingsValidationIssue[] = [];

  if (!isRecord(value)) {
    return invalid('settings', 'must be an object');
  }

  if (value.version !== CURRENT_SETTINGS_VERSION) {
    issues.push({
      path: 'version',
      message: `must be settings version ${CURRENT_SETTINGS_VERSION}`
    });
  }
  if (!isLanguageSettings(value.language)) {
    issues.push({ path: 'language', message: 'must contain valid source and target languages' });
  }
  if (!isBehaviorSettings(value.behavior)) {
    issues.push({ path: 'behavior', message: 'must contain valid transform behavior' });
  }
  if (!isControlsSettings(value.controls)) {
    issues.push({ path: 'controls', message: 'must contain valid controls' });
  }
  if (!isStylesSettings(value.styles)) {
    issues.push({ path: 'styles', message: 'must contain valid style settings' });
  }
  if (!isProviderSettings(value.providers)) {
    issues.push({ path: 'providers', message: 'must contain valid provider settings' });
  }

  return issues.length === 0
    ? { ok: true, value: value as unknown as AppSettings }
    : { ok: false, issues };
}

export function toContentSettingsSnapshot(settings: AppSettings): ContentSettingsSnapshot {
  const activeProfile = settings.providers.activeProfileId
    ? settings.providers.profiles.find(
        (profile) => profile.id === settings.providers.activeProfileId
      )
    : undefined;

  return {
    version: settings.version,
    language: { ...settings.language },
    behavior: { ...settings.behavior },
    controls: {
      shortcut: {
        enabled: settings.controls.shortcut.enabled,
        shortcut: { ...settings.controls.shortcut.shortcut }
      },
      fieldButton: { ...settings.controls.fieldButton },
      selection: { ...settings.controls.selection }
    },
    styles: {
      selected: { ...settings.styles.selected },
      custom: settings.styles.custom.map((style) => ({ ...style }))
    },
    activeProvider: activeProfile ? toContentProviderSummary(activeProfile) : null
  };
}

export function isContentSettingsSnapshot(value: unknown): value is ContentSettingsSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === CURRENT_SETTINGS_VERSION &&
    isLanguageSettings(value.language) &&
    isBehaviorSettings(value.behavior) &&
    isControlsSettings(value.controls) &&
    isStylesSettings(value.styles) &&
    (value.activeProvider === null || isContentProviderSummary(value.activeProvider))
  );
}

export function isContentProviderSummary(value: unknown): value is ContentProviderSummary {
  return (
    isRecord(value) &&
    isProfileId(value.id) &&
    isNonBlankText(value.name, MAX_PROFILE_NAME_LENGTH) &&
    isProviderKind(value.kind) &&
    isBoundedText(value.selectedModelId, MAX_MODEL_ID_LENGTH) &&
    typeof value.configured === 'boolean'
  );
}

export function isLanguageSettings(value: unknown): value is LanguageSettings {
  return isRecord(value) && isSourceLanguage(value.source) && isTargetLanguage(value.target);
}

export function isBehaviorSettings(value: unknown): value is BehaviorSettings {
  return (
    isRecord(value) &&
    (value.afterTransform === 'replace' || value.afterTransform === 'preview') &&
    typeof value.showUndoNotification === 'boolean'
  );
}

export function isControlsSettings(value: unknown): value is ControlsSettings {
  return (
    isRecord(value) &&
    isShortcutSettings(value.shortcut) &&
    isFieldButtonSettings(value.fieldButton) &&
    isSelectionSettings(value.selection)
  );
}

export function isStylesSettings(value: unknown): value is StylesSettings {
  if (!isRecord(value) || !Array.isArray(value.custom) || !isStyleSelection(value.selected)) {
    return false;
  }

  if (value.custom.length > MAX_CUSTOM_STYLE_COUNT) {
    return false;
  }

  const styleIds = new Set<string>();
  for (const style of value.custom) {
    if (!isCustomStyle(style) || styleIds.has(style.id)) {
      return false;
    }
    styleIds.add(style.id);
  }

  return value.selected.kind !== 'custom' || styleIds.has(value.selected.id);
}

export function isProviderSettings(value: unknown): value is ProviderSettings {
  if (!isRecord(value) || !Array.isArray(value.profiles)) {
    return false;
  }

  const profileIds = new Set<string>();
  for (const profile of value.profiles) {
    if (!isProviderProfile(profile) || profileIds.has(profile.id)) {
      return false;
    }
    profileIds.add(profile.id);
  }

  return (
    value.activeProfileId === null ||
    (isProfileId(value.activeProfileId) && profileIds.has(value.activeProfileId))
  );
}

export function isCustomStyle(value: unknown): value is CustomStyle {
  return (
    isRecord(value) &&
    isProfileId(value.id) &&
    isNonBlankText(value.name, MAX_CUSTOM_STYLE_NAME_LENGTH) &&
    isNonBlankText(value.instruction, MAX_CUSTOM_STYLE_INSTRUCTION_LENGTH)
  );
}

export function isStyleSelection(value: unknown): value is StyleSelection {
  if (!isRecord(value) || !isNonBlankText(value.id, MAX_PROFILE_ID_LENGTH)) {
    return false;
  }

  return (
    (value.kind === 'built-in' && isBuiltInStyleId(value.id)) ||
    (value.kind === 'custom' && isProfileId(value.id))
  );
}

export function isShortcutSettings(value: unknown): value is ShortcutSettings {
  return (
    isRecord(value) && typeof value.enabled === 'boolean' && isKeyboardShortcut(value.shortcut)
  );
}

export function isKeyboardShortcut(value: unknown): value is KeyboardShortcut {
  return (
    isRecord(value) &&
    isNonBlankSingleLineText(value.code, 64) &&
    typeof value.alt === 'boolean' &&
    typeof value.ctrl === 'boolean' &&
    typeof value.meta === 'boolean' &&
    typeof value.shift === 'boolean'
  );
}

export function isFieldButtonSettings(value: unknown): value is FieldButtonSettings {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    isOneOf(value.position, FIELD_BUTTON_POSITIONS) &&
    (value.appearance === 'tynly-icon' || value.appearance === 'monochrome-icon') &&
    (value.clickBehavior === 'transform-immediately' || value.clickBehavior === 'show-preview')
  );
}

export function isSelectionSettings(value: unknown): value is SelectionSettings {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    (value.editableBehavior === 'replace' || value.editableBehavior === 'preview') &&
    value.pageBehavior === 'show-result'
  );
}

export function isCustomApiAuthentication(value: unknown): value is CustomApiAuthentication {
  if (!isRecord(value)) {
    return false;
  }

  switch (value.kind) {
    case 'none':
      return true;
    case 'bearer':
      return isSecret(value.token);
    case 'header':
      return isHeaderName(value.headerName) && isSecret(value.value);
    default:
      return false;
  }
}

export function isProviderHeaders(value: unknown): value is ProviderHeader[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_HEADER_COUNT &&
    value.every(
      (header) =>
        isRecord(header) &&
        isHeaderName(header.name) &&
        isSingleLineText(header.value, MAX_HEADER_VALUE_LENGTH)
    )
  );
}

export function isProfileId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_PROFILE_ID_LENGTH &&
    profileIdPattern.test(value)
  );
}

export function isHttpUrl(value: unknown): value is string {
  if (!isNonBlankSingleLineText(value, MAX_ENDPOINT_LENGTH)) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

function toContentProviderSummary(profile: ProviderProfile): ContentProviderSummary {
  return {
    id: profile.id,
    name: profile.name,
    kind: profile.kind,
    selectedModelId: profile.selectedModelId,
    configured: isProfileConfigured(profile)
  };
}

function isProfileConfigured(profile: ProviderProfile): boolean {
  if (profile.selectedModelId.trim().length === 0) {
    return false;
  }

  switch (profile.kind) {
    case 'openai':
    case 'openai-compatible':
    case 'anthropic':
    case 'gemini':
      return profile.apiKey.trim().length > 0;
    case 'ollama':
      return true;
    case 'custom-json':
      return (
        profile.authentication.kind === 'none' ||
        (profile.authentication.kind === 'bearer' &&
          profile.authentication.token.trim().length > 0) ||
        (profile.authentication.kind === 'header' && profile.authentication.value.trim().length > 0)
      );
  }
}

function isProviderProfileBase(value: Record<string, unknown>): boolean {
  return (
    isProfileId(value.id) &&
    isNonBlankText(value.name, MAX_PROFILE_NAME_LENGTH) &&
    isProviderKind(value.kind) &&
    isBoundedText(value.selectedModelId, MAX_MODEL_ID_LENGTH) &&
    isFiniteIntegerInRange(value.timeoutMs, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS) &&
    (value.temperature === null || isFiniteNumberInRange(value.temperature, 0, 2)) &&
    (value.maxOutputTokens === null ||
      isFiniteIntegerInRange(value.maxOutputTokens, 1, MAX_OUTPUT_TOKENS))
  );
}

function isHeaderName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    headerNamePattern.test(value)
  );
}

function isSecret(value: unknown): value is string {
  return isSingleLineText(value, MAX_SECRET_LENGTH);
}

function isNonBlankText(value: unknown, maxLength: number): value is string {
  return isBoundedText(value, maxLength) && value.trim().length > 0;
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

function isNonBlankSingleLineText(value: unknown, maxLength: number): value is string {
  return isSingleLineText(value, maxLength) && value.trim().length > 0;
}

function isSingleLineText(value: unknown, maxLength: number): value is string {
  return isBoundedText(value, maxLength) && !/[\r\n]/u.test(value);
}

function isFiniteNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isFiniteIntegerInRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && isFiniteNumberInRange(value, min, max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  options: T
): value is T[number] {
  return typeof value === 'string' && (options as readonly string[]).includes(value);
}

function invalid(path: string, message: string): SettingsValidationResult {
  return { ok: false, issues: [{ path, message }] };
}
