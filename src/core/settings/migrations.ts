import { createDefaultAppSettings } from './defaults.ts';
import {
  CURRENT_SETTINGS_VERSION,
  isAppSettings,
  isBehaviorSettings,
  isBuiltInStyleId,
  isControlsSettings,
  isCustomStyle,
  isFieldButtonSettings,
  isKeyboardShortcut,
  isLanguageSettings,
  isProviderProfile,
  isSelectionSettings,
  isShortcutSettings,
  isSourceLanguage,
  isStyleSelection,
  isTargetLanguage
} from './schema.ts';

import type {
  AppSettings,
  BehaviorSettings,
  ControlsSettings,
  CustomApiAuthentication,
  CustomStyle,
  FieldButtonSettings,
  KeyboardShortcut,
  LanguageSettings,
  ProviderProfile,
  ProviderSettings,
  SelectionSettings,
  ShortcutSettings,
  StyleSelection,
  StylesSettings
} from './schema.ts';

export interface SettingsMigrationResult {
  settings: AppSettings;
  /** Null means the stored value did not identify a numeric schema version. */
  sourceVersion: number | null;
  /** True whenever the stored value was not already a valid current schema. */
  migrated: boolean;
  /** True when one or more unknown, malformed, or unsupported values were recovered. */
  recovered: boolean;
}

/**
 * Produce a current, valid settings object from any storage value. Invalid
 * portions fall back independently so a damaged field does not reset the rest
 * of a user's configuration.
 */
export function migrateAppSettings(raw: unknown): SettingsMigrationResult {
  if (isAppSettings(raw)) {
    return {
      settings: cloneAppSettings(raw),
      sourceVersion: CURRENT_SETTINGS_VERSION,
      migrated: false,
      recovered: false
    };
  }

  const source = asRecord(raw);
  const sourceVersion = typeof source?.version === 'number' ? source.version : null;

  if (sourceVersion !== null && sourceVersion > CURRENT_SETTINGS_VERSION) {
    return {
      settings: createDefaultAppSettings(),
      sourceVersion,
      migrated: true,
      recovered: true
    };
  }

  const defaults = createDefaultAppSettings();
  if (!source) {
    return {
      settings: defaults,
      sourceVersion,
      migrated: true,
      recovered: true
    };
  }

  const settings: AppSettings = {
    version: CURRENT_SETTINGS_VERSION,
    language: migrateLanguageSettings(source, defaults.language),
    behavior: migrateBehaviorSettings(source, defaults.behavior),
    controls: migrateControlsSettings(source, defaults.controls),
    styles: migrateStylesSettings(source, defaults.styles),
    providers: migrateProviderSettings(source, defaults.providers)
  };

  return {
    settings,
    sourceVersion,
    migrated: true,
    recovered: true
  };
}

/** Convenience form for storage callers that only need the recovered value. */
export function migrateSettings(raw: unknown): AppSettings {
  return migrateAppSettings(raw).settings;
}

/** Return a deep-enough copy for callers that will edit a settings value. */
export function cloneAppSettings(settings: AppSettings): AppSettings {
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
      selected: cloneStyleSelection(settings.styles.selected),
      custom: settings.styles.custom.map((style) => ({ ...style }))
    },
    providers: {
      activeProfileId: settings.providers.activeProfileId,
      profiles: settings.providers.profiles.map(cloneProviderProfile)
    }
  };
}

function migrateLanguageSettings(
  source: Record<string, unknown>,
  defaults: LanguageSettings
): LanguageSettings {
  const nested = asRecord(source.language);
  if (isLanguageSettings(nested)) {
    return { ...nested };
  }

  const migrated = { ...defaults };
  const sourceLanguage = toSourceLanguage(
    firstDefined(nested?.source, source.sourceLanguage, source.source)
  );
  const targetLanguage = toTargetLanguage(
    firstDefined(nested?.target, source.targetLanguage, source.target)
  );

  if (sourceLanguage) {
    migrated.source = sourceLanguage;
  }
  if (targetLanguage) {
    migrated.target = targetLanguage;
  }

  return migrated;
}

function migrateBehaviorSettings(
  source: Record<string, unknown>,
  defaults: BehaviorSettings
): BehaviorSettings {
  const nested = asRecord(source.behavior);
  if (isBehaviorSettings(nested)) {
    return { ...nested };
  }

  const migrated = { ...defaults };
  const mode = firstDefined(
    nested?.afterTransform,
    nested?.mode,
    source.afterTransform,
    source.mode
  );
  if (mode === 'replace' || mode === 'preview') {
    migrated.afterTransform = mode;
  } else if (typeof source.replaceAutomatically === 'boolean') {
    migrated.afterTransform = source.replaceAutomatically ? 'replace' : 'preview';
  }

  const showUndo = firstDefined(
    nested?.showUndoNotification,
    nested?.showUndo,
    source.showUndoNotification,
    source.showUndo
  );
  if (typeof showUndo === 'boolean') {
    migrated.showUndoNotification = showUndo;
  }

  return migrated;
}

function migrateControlsSettings(
  source: Record<string, unknown>,
  defaults: ControlsSettings
): ControlsSettings {
  const nested = asRecord(source.controls);
  if (isControlsSettings(nested)) {
    return cloneControlsSettings(nested);
  }

  return {
    shortcut: migrateShortcutSettings(nested, source, defaults.shortcut),
    fieldButton: migrateFieldButtonSettings(nested, source, defaults.fieldButton),
    selection: migrateSelectionSettings(nested, source, defaults.selection)
  };
}

function migrateShortcutSettings(
  controls: Record<string, unknown> | undefined,
  source: Record<string, unknown>,
  defaults: ShortcutSettings
): ShortcutSettings {
  const nested = asRecord(firstDefined(controls?.shortcut, source.shortcut));
  if (isShortcutSettings(nested)) {
    return {
      enabled: nested.enabled,
      shortcut: { ...nested.shortcut }
    };
  }

  const migrated: ShortcutSettings = {
    enabled: defaults.enabled,
    shortcut: { ...defaults.shortcut }
  };
  const enabled = firstDefined(nested?.enabled, controls?.shortcutEnabled, source.shortcutEnabled);
  if (typeof enabled === 'boolean') {
    migrated.enabled = enabled;
  }

  const shortcut = toKeyboardShortcut(firstDefined(nested?.shortcut, source.shortcut));
  if (shortcut) {
    migrated.shortcut = shortcut;
  }

  return migrated;
}

function migrateFieldButtonSettings(
  controls: Record<string, unknown> | undefined,
  source: Record<string, unknown>,
  defaults: FieldButtonSettings
): FieldButtonSettings {
  const nested = asRecord(firstDefined(controls?.fieldButton, source.fieldButton));
  if (isFieldButtonSettings(nested)) {
    return { ...nested };
  }

  const migrated = { ...defaults };
  const enabled = firstDefined(
    nested?.enabled,
    controls?.fieldButtonEnabled,
    source.fieldButtonEnabled
  );
  if (typeof enabled === 'boolean') {
    migrated.enabled = enabled;
  }
  const position = firstDefined(nested?.position, source.fieldButtonPosition);
  if (
    position === 'bottom-right' ||
    position === 'bottom-left' ||
    position === 'top-right' ||
    position === 'top-left'
  ) {
    migrated.position = position;
  }
  const appearance = firstDefined(nested?.appearance, source.fieldButtonAppearance);
  if (appearance === 'tynly-icon' || appearance === 'monochrome-icon') {
    migrated.appearance = appearance;
  }
  const clickBehavior = firstDefined(nested?.clickBehavior, source.fieldButtonClickBehavior);
  if (clickBehavior === 'transform-immediately' || clickBehavior === 'show-preview') {
    migrated.clickBehavior = clickBehavior;
  }

  return migrated;
}

function migrateSelectionSettings(
  controls: Record<string, unknown> | undefined,
  source: Record<string, unknown>,
  defaults: SelectionSettings
): SelectionSettings {
  const nested = asRecord(firstDefined(controls?.selection, source.selection));
  if (isSelectionSettings(nested)) {
    return { ...nested };
  }

  const migrated = { ...defaults };
  const enabled = firstDefined(
    nested?.enabled,
    controls?.selectionEnabled,
    source.selectionEnabled
  );
  if (typeof enabled === 'boolean') {
    migrated.enabled = enabled;
  }
  const editableBehavior = firstDefined(nested?.editableBehavior, source.editableSelectionBehavior);
  if (editableBehavior === 'replace' || editableBehavior === 'preview') {
    migrated.editableBehavior = editableBehavior;
  }
  if (firstDefined(nested?.pageBehavior, source.pageSelectionBehavior) === 'show-result') {
    migrated.pageBehavior = 'show-result';
  }

  return migrated;
}

function migrateStylesSettings(
  source: Record<string, unknown>,
  defaults: StylesSettings
): StylesSettings {
  const nested = asRecord(source.styles);
  if (nested && isStylesSettingsWithSelection(nested)) {
    return {
      selected: cloneStyleSelection(nested.selected),
      custom: nested.custom.map((style) => ({ ...style }))
    };
  }

  const rawCustom = firstDefined(nested?.custom, source.customStyles);
  const custom = collectCustomStyles(rawCustom);
  const candidate = firstDefined(nested?.selected, source.selectedStyle, source.style);
  const selected = toStyleSelection(candidate, custom) ?? defaults.selected;

  return {
    selected: cloneStyleSelection(selected),
    custom
  };
}

function migrateProviderSettings(
  source: Record<string, unknown>,
  defaults: ProviderSettings
): ProviderSettings {
  const nested = asRecord(source.providers);
  const rawProfiles = firstDefined(nested?.profiles, source.providerProfiles);
  const profiles = collectProviderProfiles(rawProfiles);
  const requestedActiveId = firstDefined(nested?.activeProfileId, source.activeProviderId);
  const activeProfileId =
    typeof requestedActiveId === 'string' &&
    profiles.some((profile) => profile.id === requestedActiveId)
      ? requestedActiveId
      : defaults.activeProfileId;

  return { activeProfileId, profiles };
}

function collectCustomStyles(value: unknown): CustomStyle[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const styleIds = new Set<string>();
  const styles: CustomStyle[] = [];
  for (const style of value) {
    if (isCustomStyle(style) && !styleIds.has(style.id)) {
      styleIds.add(style.id);
      styles.push({ ...style });
    }
  }
  return styles;
}

function collectProviderProfiles(value: unknown): ProviderProfile[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const profileIds = new Set<string>();
  const profiles: ProviderProfile[] = [];
  for (const profile of value) {
    if (isProviderProfile(profile) && !profileIds.has(profile.id)) {
      profileIds.add(profile.id);
      profiles.push(cloneProviderProfile(profile));
    }
  }
  return profiles;
}

function toSourceLanguage(value: unknown): LanguageSettings['source'] | undefined {
  const normalized = normalizeLanguageToken(value);
  return normalized && isSourceLanguage(normalized) ? normalized : undefined;
}

function toTargetLanguage(value: unknown): LanguageSettings['target'] | undefined {
  const normalized = normalizeLanguageToken(value);
  return normalized && isTargetLanguage(normalized) ? normalized : undefined;
}

function normalizeLanguageToken(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    auto: 'auto',
    vietnamese: 'vi',
    english: 'en',
    japanese: 'ja',
    korean: 'ko',
    chinese: 'zh',
    french: 'fr',
    german: 'de',
    spanish: 'es'
  };
  return aliases[normalized] ?? normalized;
}

function toKeyboardShortcut(value: unknown): KeyboardShortcut | undefined {
  if (isKeyboardShortcut(value)) {
    return { ...value };
  }
  if (typeof value !== 'string') {
    return undefined;
  }

  const tokens = value
    .split('+')
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return undefined;
  }

  const modifiers = new Set(
    tokens.filter((token) => ['alt', 'ctrl', 'control', 'meta', 'cmd', 'shift'].includes(token))
  );
  const key = tokens.find((token) => !modifiers.has(token));
  const code = key ? toKeyboardCode(key) : undefined;
  if (!code) {
    return undefined;
  }

  return {
    code,
    alt: modifiers.has('alt'),
    ctrl: modifiers.has('ctrl') || modifiers.has('control'),
    meta: modifiers.has('meta') || modifiers.has('cmd'),
    shift: modifiers.has('shift')
  };
}

function toKeyboardCode(value: string): string | undefined {
  if (/^[a-z]$/u.test(value)) {
    return `Key${value.toUpperCase()}`;
  }
  if (/^[0-9]$/u.test(value)) {
    return `Digit${value}`;
  }
  const namedKeys: Record<string, string> = {
    enter: 'Enter',
    space: 'Space',
    escape: 'Escape'
  };
  return namedKeys[value];
}

function toStyleSelection(value: unknown, custom: CustomStyle[]): StyleSelection | undefined {
  if (isStyleSelection(value)) {
    if (value.kind === 'custom' && !custom.some((style) => style.id === value.id)) {
      return undefined;
    }
    return cloneStyleSelection(value);
  }
  if (isBuiltInStyleId(value)) {
    return { kind: 'built-in', id: value };
  }
  if (typeof value === 'string' && custom.some((style) => style.id === value)) {
    return { kind: 'custom', id: value };
  }
  return undefined;
}

function isStylesSettingsWithSelection(value: unknown): value is StylesSettings {
  const record = asRecord(value);
  const selected = record?.selected;
  if (!record || !Array.isArray(record.custom) || !isStyleSelection(selected)) {
    return false;
  }
  const custom = collectCustomStyles(record.custom);
  return (
    custom.length === record.custom.length &&
    (selected.kind !== 'custom' || custom.some((style) => style.id === selected.id))
  );
}

function cloneControlsSettings(settings: ControlsSettings): ControlsSettings {
  return {
    shortcut: {
      enabled: settings.shortcut.enabled,
      shortcut: { ...settings.shortcut.shortcut }
    },
    fieldButton: { ...settings.fieldButton },
    selection: { ...settings.selection }
  };
}

function cloneStyleSelection(selection: StyleSelection): StyleSelection {
  return selection.kind === 'built-in'
    ? { kind: 'built-in', id: selection.id }
    : { kind: 'custom', id: selection.id };
}

function cloneProviderProfile(profile: ProviderProfile): ProviderProfile {
  switch (profile.kind) {
    case 'openai':
    case 'anthropic':
    case 'gemini':
      return { ...profile };
    case 'openai-compatible':
    case 'ollama':
      return { ...profile, headers: profile.headers.map((header) => ({ ...header })) };
    case 'custom-json':
      return {
        ...profile,
        authentication: cloneAuthentication(profile.authentication),
        headers: profile.headers.map((header) => ({ ...header }))
      };
  }
}

function cloneAuthentication(authentication: CustomApiAuthentication): CustomApiAuthentication {
  switch (authentication.kind) {
    case 'none':
      return { kind: 'none' };
    case 'bearer':
      return { kind: 'bearer', token: authentication.token };
    case 'header':
      return {
        kind: 'header',
        headerName: authentication.headerName,
        value: authentication.value
      };
  }
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
