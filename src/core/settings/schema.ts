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

/** A public style intentionally excludes its private prompt instruction. */
export interface ContentCustomStyleSummary {
  id: string;
  name: string;
}

export interface ContentStylesSettings {
  selected: StyleSelection;
  custom: ContentCustomStyleSummary[];
}

export interface ContentSettingsSnapshot {
  version: SettingsVersion;
  language: LanguageSettings;
  behavior: BehaviorSettings;
  controls: ControlsSettings;
  styles: ContentStylesSettings;
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
export const MAX_CUSTOM_STYLE_COUNT = 30;
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

const APP_SETTINGS_FIELDS = [
  'version',
  'language',
  'behavior',
  'controls',
  'styles',
  'providers'
] as const;
const LANGUAGE_SETTINGS_FIELDS = ['source', 'target'] as const;
const BEHAVIOR_SETTINGS_FIELDS = ['afterTransform', 'showUndoNotification'] as const;
const KEYBOARD_SHORTCUT_FIELDS = ['code', 'alt', 'ctrl', 'meta', 'shift'] as const;
const SHORTCUT_SETTINGS_FIELDS = ['enabled', 'shortcut'] as const;
const FIELD_BUTTON_SETTINGS_FIELDS = [
  'enabled',
  'position',
  'appearance',
  'clickBehavior'
] as const;
const SELECTION_SETTINGS_FIELDS = ['enabled', 'editableBehavior', 'pageBehavior'] as const;
const CONTROLS_SETTINGS_FIELDS = ['shortcut', 'fieldButton', 'selection'] as const;
const CUSTOM_STYLE_FIELDS = ['id', 'name', 'instruction'] as const;
const CONTENT_CUSTOM_STYLE_FIELDS = ['id', 'name'] as const;
const STYLE_SELECTION_FIELDS = ['kind', 'id'] as const;
const STYLES_SETTINGS_FIELDS = ['selected', 'custom'] as const;
const PROVIDER_HEADER_FIELDS = ['name', 'value'] as const;
const PROVIDER_SETTINGS_FIELDS = ['activeProfileId', 'profiles'] as const;
const CONTENT_PROVIDER_SUMMARY_FIELDS = [
  'id',
  'name',
  'kind',
  'selectedModelId',
  'configured'
] as const;
const CONTENT_SETTINGS_SNAPSHOT_FIELDS = [
  'version',
  'language',
  'behavior',
  'controls',
  'styles',
  'activeProvider'
] as const;
const OPENAI_PROFILE_FIELDS = [
  'id',
  'name',
  'kind',
  'selectedModelId',
  'timeoutMs',
  'temperature',
  'maxOutputTokens',
  'baseUrl',
  'apiKey'
] as const;
const OPENAI_COMPATIBLE_PROFILE_FIELDS = [...OPENAI_PROFILE_FIELDS, 'headers'] as const;
const OLLAMA_PROFILE_FIELDS = [
  'id',
  'name',
  'kind',
  'selectedModelId',
  'timeoutMs',
  'temperature',
  'maxOutputTokens',
  'baseUrl',
  'headers'
] as const;
const CUSTOM_JSON_PROFILE_FIELDS = [
  'id',
  'name',
  'kind',
  'selectedModelId',
  'timeoutMs',
  'temperature',
  'maxOutputTokens',
  'endpoint',
  'method',
  'authentication',
  'headers',
  'modelsEndpoint',
  'requestTemplate',
  'responseTextPath'
] as const;

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
  if (!isRecord(value)) {
    return false;
  }

  const kind = getOwnDataValue(value, 'kind');
  switch (kind) {
    case 'openai':
    case 'anthropic':
    case 'gemini': {
      return (
        hasExactOwnDataFields(value, OPENAI_PROFILE_FIELDS) &&
        isProviderProfileBase(value) &&
        isHttpUrl(getOwnDataValue(value, 'baseUrl')) &&
        isSecret(getOwnDataValue(value, 'apiKey'))
      );
    }
    case 'openai-compatible': {
      return (
        hasExactOwnDataFields(value, OPENAI_COMPATIBLE_PROFILE_FIELDS) &&
        isProviderProfileBase(value) &&
        isHttpUrl(getOwnDataValue(value, 'baseUrl')) &&
        isSecret(getOwnDataValue(value, 'apiKey')) &&
        isProviderHeaders(getOwnDataValue(value, 'headers'))
      );
    }
    case 'ollama': {
      return (
        hasExactOwnDataFields(value, OLLAMA_PROFILE_FIELDS) &&
        isProviderProfileBase(value) &&
        isOllamaUrl(getOwnDataValue(value, 'baseUrl')) &&
        isProviderHeaders(getOwnDataValue(value, 'headers'))
      );
    }
    case 'custom-json': {
      return (
        hasExactOwnDataFields(value, CUSTOM_JSON_PROFILE_FIELDS) &&
        isProviderProfileBase(value) &&
        isHttpUrl(getOwnDataValue(value, 'endpoint')) &&
        isOneOf(getOwnDataValue(value, 'method'), HTTP_METHODS) &&
        isCustomApiAuthentication(getOwnDataValue(value, 'authentication')) &&
        isProviderHeaders(getOwnDataValue(value, 'headers')) &&
        (getOwnDataValue(value, 'modelsEndpoint') === null ||
          isHttpUrl(getOwnDataValue(value, 'modelsEndpoint'))) &&
        isBoundedText(getOwnDataValue(value, 'requestTemplate'), MAX_TEMPLATE_LENGTH) &&
        isNonBlankSingleLineText(
          getOwnDataValue(value, 'responseTextPath'),
          MAX_RESPONSE_PATH_LENGTH
        )
      );
    }
    default:
      return false;
  }
}

export function isAppSettings(value: unknown): value is AppSettings {
  return validateAppSettings(value).ok;
}

export function validateAppSettings(value: unknown): SettingsValidationResult {
  const issues: SettingsValidationIssue[] = [];

  if (!isRecord(value) || !hasExactOwnDataFields(value, APP_SETTINGS_FIELDS)) {
    return invalid('settings', 'must contain exactly the current settings fields');
  }

  if (getOwnDataValue(value, 'version') !== CURRENT_SETTINGS_VERSION) {
    issues.push({
      path: 'version',
      message: `must be settings version ${CURRENT_SETTINGS_VERSION}`
    });
  }
  if (!isLanguageSettings(getOwnDataValue(value, 'language'))) {
    issues.push({ path: 'language', message: 'must contain valid source and target languages' });
  }
  if (!isBehaviorSettings(getOwnDataValue(value, 'behavior'))) {
    issues.push({ path: 'behavior', message: 'must contain valid transform behavior' });
  }
  if (!isControlsSettings(getOwnDataValue(value, 'controls'))) {
    issues.push({ path: 'controls', message: 'must contain valid controls' });
  }
  if (!isStylesSettings(getOwnDataValue(value, 'styles'))) {
    issues.push({ path: 'styles', message: 'must contain valid style settings' });
  }
  if (!isProviderSettings(getOwnDataValue(value, 'providers'))) {
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
    language: {
      source: settings.language.source,
      target: settings.language.target
    },
    behavior: {
      afterTransform: settings.behavior.afterTransform,
      showUndoNotification: settings.behavior.showUndoNotification
    },
    controls: {
      shortcut: {
        enabled: settings.controls.shortcut.enabled,
        shortcut: {
          code: settings.controls.shortcut.shortcut.code,
          alt: settings.controls.shortcut.shortcut.alt,
          ctrl: settings.controls.shortcut.shortcut.ctrl,
          meta: settings.controls.shortcut.shortcut.meta,
          shift: settings.controls.shortcut.shortcut.shift
        }
      },
      fieldButton: {
        enabled: settings.controls.fieldButton.enabled,
        position: settings.controls.fieldButton.position,
        appearance: settings.controls.fieldButton.appearance,
        clickBehavior: settings.controls.fieldButton.clickBehavior
      },
      selection: {
        enabled: settings.controls.selection.enabled,
        editableBehavior: settings.controls.selection.editableBehavior,
        pageBehavior: settings.controls.selection.pageBehavior
      }
    },
    styles: {
      selected:
        settings.styles.selected.kind === 'built-in'
          ? { kind: 'built-in', id: settings.styles.selected.id }
          : { kind: 'custom', id: settings.styles.selected.id },
      custom: settings.styles.custom.map((style) => ({ id: style.id, name: style.name }))
    },
    activeProvider: activeProfile ? toContentProviderSummary(activeProfile) : null
  };
}

export function isContentSettingsSnapshot(value: unknown): value is ContentSettingsSnapshot {
  if (!isRecord(value) || !hasExactOwnDataFields(value, CONTENT_SETTINGS_SNAPSHOT_FIELDS)) {
    return false;
  }

  return (
    getOwnDataValue(value, 'version') === CURRENT_SETTINGS_VERSION &&
    isLanguageSettings(getOwnDataValue(value, 'language')) &&
    isBehaviorSettings(getOwnDataValue(value, 'behavior')) &&
    isControlsSettings(getOwnDataValue(value, 'controls')) &&
    isContentStylesSettings(getOwnDataValue(value, 'styles')) &&
    (getOwnDataValue(value, 'activeProvider') === null ||
      isContentProviderSummary(getOwnDataValue(value, 'activeProvider')))
  );
}

export function isContentProviderSummary(value: unknown): value is ContentProviderSummary {
  return (
    isRecord(value) &&
    hasExactOwnDataFields(value, CONTENT_PROVIDER_SUMMARY_FIELDS) &&
    isProfileId(getOwnDataValue(value, 'id')) &&
    isNonBlankText(getOwnDataValue(value, 'name'), MAX_PROFILE_NAME_LENGTH) &&
    isProviderKind(getOwnDataValue(value, 'kind')) &&
    isBoundedText(getOwnDataValue(value, 'selectedModelId'), MAX_MODEL_ID_LENGTH) &&
    typeof getOwnDataValue(value, 'configured') === 'boolean'
  );
}

export function isLanguageSettings(value: unknown): value is LanguageSettings {
  return (
    isRecord(value) &&
    hasExactOwnDataFields(value, LANGUAGE_SETTINGS_FIELDS) &&
    isSourceLanguage(getOwnDataValue(value, 'source')) &&
    isTargetLanguage(getOwnDataValue(value, 'target'))
  );
}

export function isBehaviorSettings(value: unknown): value is BehaviorSettings {
  return (
    isRecord(value) &&
    hasExactOwnDataFields(value, BEHAVIOR_SETTINGS_FIELDS) &&
    (getOwnDataValue(value, 'afterTransform') === 'replace' ||
      getOwnDataValue(value, 'afterTransform') === 'preview') &&
    typeof getOwnDataValue(value, 'showUndoNotification') === 'boolean'
  );
}

export function isControlsSettings(value: unknown): value is ControlsSettings {
  return (
    isRecord(value) &&
    hasExactOwnDataFields(value, CONTROLS_SETTINGS_FIELDS) &&
    isShortcutSettings(getOwnDataValue(value, 'shortcut')) &&
    isFieldButtonSettings(getOwnDataValue(value, 'fieldButton')) &&
    isSelectionSettings(getOwnDataValue(value, 'selection'))
  );
}

export function isStylesSettings(value: unknown): value is StylesSettings {
  if (
    !isRecord(value) ||
    !hasExactOwnDataFields(value, STYLES_SETTINGS_FIELDS) ||
    !Array.isArray(getOwnDataValue(value, 'custom')) ||
    !isStyleSelection(getOwnDataValue(value, 'selected'))
  ) {
    return false;
  }

  const custom = getOwnDataValue(value, 'custom');
  const selected = getOwnDataValue(value, 'selected');
  if (
    !Array.isArray(custom) ||
    !isStyleSelection(selected) ||
    custom.length > MAX_CUSTOM_STYLE_COUNT
  ) {
    return false;
  }

  const styleIds = new Set<string>();
  for (const style of custom) {
    if (!isCustomStyle(style) || styleIds.has(style.id)) {
      return false;
    }
    styleIds.add(style.id);
  }

  return selected.kind !== 'custom' || styleIds.has(selected.id);
}

export function isContentStylesSettings(value: unknown): value is ContentStylesSettings {
  if (
    !isRecord(value) ||
    !hasExactOwnDataFields(value, STYLES_SETTINGS_FIELDS) ||
    !Array.isArray(getOwnDataValue(value, 'custom')) ||
    !isStyleSelection(getOwnDataValue(value, 'selected'))
  ) {
    return false;
  }

  const custom = getOwnDataValue(value, 'custom');
  const selected = getOwnDataValue(value, 'selected');
  if (
    !Array.isArray(custom) ||
    !isStyleSelection(selected) ||
    custom.length > MAX_CUSTOM_STYLE_COUNT
  ) {
    return false;
  }

  const styleIds = new Set<string>();
  for (const style of custom) {
    if (!isContentCustomStyleSummary(style) || styleIds.has(style.id)) {
      return false;
    }
    styleIds.add(style.id);
  }

  return selected.kind !== 'custom' || styleIds.has(selected.id);
}

export function isContentCustomStyleSummary(value: unknown): value is ContentCustomStyleSummary {
  return (
    isRecord(value) &&
    hasExactOwnDataFields(value, CONTENT_CUSTOM_STYLE_FIELDS) &&
    isProfileId(getOwnDataValue(value, 'id')) &&
    isNonBlankText(getOwnDataValue(value, 'name'), MAX_CUSTOM_STYLE_NAME_LENGTH)
  );
}

export function isProviderSettings(value: unknown): value is ProviderSettings {
  if (
    !isRecord(value) ||
    !hasExactOwnDataFields(value, PROVIDER_SETTINGS_FIELDS) ||
    !Array.isArray(getOwnDataValue(value, 'profiles'))
  ) {
    return false;
  }

  const profiles = getOwnDataValue(value, 'profiles');
  const activeProfileId = getOwnDataValue(value, 'activeProfileId');
  if (!Array.isArray(profiles)) {
    return false;
  }

  const profileIds = new Set<string>();
  for (const profile of profiles) {
    if (!isProviderProfile(profile) || profileIds.has(profile.id)) {
      return false;
    }
    profileIds.add(profile.id);
  }

  return (
    activeProfileId === null || (isProfileId(activeProfileId) && profileIds.has(activeProfileId))
  );
}

export function isCustomStyle(value: unknown): value is CustomStyle {
  return (
    isRecord(value) &&
    hasExactOwnDataFields(value, CUSTOM_STYLE_FIELDS) &&
    isProfileId(getOwnDataValue(value, 'id')) &&
    isNonBlankText(getOwnDataValue(value, 'name'), MAX_CUSTOM_STYLE_NAME_LENGTH) &&
    isNonBlankText(getOwnDataValue(value, 'instruction'), MAX_CUSTOM_STYLE_INSTRUCTION_LENGTH)
  );
}

export function isStyleSelection(value: unknown): value is StyleSelection {
  if (
    !isRecord(value) ||
    !hasExactOwnDataFields(value, STYLE_SELECTION_FIELDS) ||
    !isNonBlankText(getOwnDataValue(value, 'id'), MAX_PROFILE_ID_LENGTH)
  ) {
    return false;
  }

  return (
    (getOwnDataValue(value, 'kind') === 'built-in' &&
      isBuiltInStyleId(getOwnDataValue(value, 'id'))) ||
    (getOwnDataValue(value, 'kind') === 'custom' && isProfileId(getOwnDataValue(value, 'id')))
  );
}

export function isShortcutSettings(value: unknown): value is ShortcutSettings {
  return (
    isRecord(value) &&
    hasExactOwnDataFields(value, SHORTCUT_SETTINGS_FIELDS) &&
    typeof getOwnDataValue(value, 'enabled') === 'boolean' &&
    isKeyboardShortcut(getOwnDataValue(value, 'shortcut'))
  );
}

export function isKeyboardShortcut(value: unknown): value is KeyboardShortcut {
  return (
    isRecord(value) &&
    hasExactOwnDataFields(value, KEYBOARD_SHORTCUT_FIELDS) &&
    isNonBlankSingleLineText(getOwnDataValue(value, 'code'), 64) &&
    typeof getOwnDataValue(value, 'alt') === 'boolean' &&
    typeof getOwnDataValue(value, 'ctrl') === 'boolean' &&
    typeof getOwnDataValue(value, 'meta') === 'boolean' &&
    typeof getOwnDataValue(value, 'shift') === 'boolean'
  );
}

export function isFieldButtonSettings(value: unknown): value is FieldButtonSettings {
  return (
    isRecord(value) &&
    hasExactOwnDataFields(value, FIELD_BUTTON_SETTINGS_FIELDS) &&
    typeof getOwnDataValue(value, 'enabled') === 'boolean' &&
    isOneOf(getOwnDataValue(value, 'position'), FIELD_BUTTON_POSITIONS) &&
    (getOwnDataValue(value, 'appearance') === 'tynly-icon' ||
      getOwnDataValue(value, 'appearance') === 'monochrome-icon') &&
    (getOwnDataValue(value, 'clickBehavior') === 'transform-immediately' ||
      getOwnDataValue(value, 'clickBehavior') === 'show-preview')
  );
}

export function isSelectionSettings(value: unknown): value is SelectionSettings {
  return (
    isRecord(value) &&
    hasExactOwnDataFields(value, SELECTION_SETTINGS_FIELDS) &&
    typeof getOwnDataValue(value, 'enabled') === 'boolean' &&
    (getOwnDataValue(value, 'editableBehavior') === 'replace' ||
      getOwnDataValue(value, 'editableBehavior') === 'preview') &&
    getOwnDataValue(value, 'pageBehavior') === 'show-result'
  );
}

export function isCustomApiAuthentication(value: unknown): value is CustomApiAuthentication {
  if (!isRecord(value)) {
    return false;
  }

  switch (getOwnDataValue(value, 'kind')) {
    case 'none':
      return hasExactOwnDataFields(value, ['kind']);
    case 'bearer':
      return (
        hasExactOwnDataFields(value, ['kind', 'token']) && isSecret(getOwnDataValue(value, 'token'))
      );
    case 'header':
      return (
        hasExactOwnDataFields(value, ['kind', 'headerName', 'value']) &&
        isHeaderName(getOwnDataValue(value, 'headerName')) &&
        isSecret(getOwnDataValue(value, 'value'))
      );
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
        hasExactOwnDataFields(header, PROVIDER_HEADER_FIELDS) &&
        isHeaderName(getOwnDataValue(header, 'name')) &&
        isSingleLineText(getOwnDataValue(header, 'value'), MAX_HEADER_VALUE_LENGTH)
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

export function isHttpUrl(value: unknown): value is string {
  const url = toSafeProviderUrl(value);
  return url !== null && url.protocol === 'https:';
}

/** Ollama may use HTTP only when its endpoint is local to the browser machine. */
export function isOllamaUrl(value: unknown): value is string {
  const url = toSafeProviderUrl(value);
  return url !== null && (url.protocol === 'https:' || isLoopbackHost(url.hostname));
}

function toSafeProviderUrl(value: unknown): URL | null {
  if (!isNonBlankSingleLineText(value, MAX_ENDPOINT_LENGTH)) {
    return null;
  }

  try {
    const url = new URL(value);
    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:') ||
      url.username ||
      url.password ||
      url.hash ||
      url.search
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/u.test(hostname)
  );
}

function hasExactOwnDataFields(
  value: Record<string, unknown>,
  expectedFields: readonly string[]
): boolean {
  try {
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== expectedFields.length ||
      !ownKeys.every((key) => typeof key === 'string' && expectedFields.includes(key))
    ) {
      return false;
    }

    return expectedFields.every((field) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, field);
      return (
        descriptor !== undefined && descriptor.enumerable && Object.hasOwn(descriptor, 'value')
      );
    });
  } catch {
    return false;
  }
}

function getOwnDataValue(value: Record<string, unknown>, field: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    return descriptor !== undefined && Object.hasOwn(descriptor, 'value')
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function isProviderProfileBase(value: Record<string, unknown>): boolean {
  return (
    isProfileId(getOwnDataValue(value, 'id')) &&
    isNonBlankText(getOwnDataValue(value, 'name'), MAX_PROFILE_NAME_LENGTH) &&
    isProviderKind(getOwnDataValue(value, 'kind')) &&
    isBoundedText(getOwnDataValue(value, 'selectedModelId'), MAX_MODEL_ID_LENGTH) &&
    isFiniteIntegerInRange(getOwnDataValue(value, 'timeoutMs'), MIN_TIMEOUT_MS, MAX_TIMEOUT_MS) &&
    (getOwnDataValue(value, 'temperature') === null ||
      isFiniteNumberInRange(getOwnDataValue(value, 'temperature'), 0, 2)) &&
    (getOwnDataValue(value, 'maxOutputTokens') === null ||
      isFiniteIntegerInRange(getOwnDataValue(value, 'maxOutputTokens'), 1, MAX_OUTPUT_TOKENS))
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
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
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
