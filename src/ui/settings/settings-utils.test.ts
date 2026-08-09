import { describe, expect, it } from 'vitest';

import { createDefaultAppSettings } from '../../core/settings/defaults.ts';

import {
  PROVIDER_CAPABILITIES,
  MAX_SHORTCUT_BINDINGS,
  addShortcutBinding,
  createProviderProfile,
  createSettingsIdentifier,
  formatShortcut,
  formatShortcutBindings,
  getActiveProvider,
  parseStyleSelection,
  removeShortcutBinding,
  replaceShortcutBinding,
  shortcutFromKeyboardEvent,
  styleSelectionValue,
  swapLanguages,
  updateSelectedModel
} from './settings-utils.ts';

describe('settings UI utilities', () => {
  it('keeps Auto source valid by refusing an invalid language swap', () => {
    const auto = createDefaultAppSettings();
    auto.language.source = 'auto';

    expect(swapLanguages(auto)).toBe(auto);

    const known = createDefaultAppSettings();
    known.language.source = 'vi';
    known.language.target = 'en';
    expect(swapLanguages(known).language).toEqual({ source: 'en', target: 'vi' });
  });

  it('resolves only built-in or existing custom style selections', () => {
    const settings = createDefaultAppSettings();
    settings.styles.custom.push({
      id: 'team-tone',
      name: 'Team tone',
      instruction: 'Sound direct but warm.'
    });

    expect(parseStyleSelection('built-in:natural', settings)).toEqual({
      id: 'natural',
      kind: 'built-in'
    });
    expect(parseStyleSelection('custom:team-tone', settings)).toEqual({
      id: 'team-tone',
      kind: 'custom'
    });
    expect(parseStyleSelection('custom:missing', settings)).toBeNull();
    expect(styleSelectionValue({ id: 'team-tone', kind: 'custom' })).toBe('custom:team-tone');
  });

  it('creates valid per-provider profiles and keeps their model selections independent', () => {
    const settings = createDefaultAppSettings();
    const openAi = createProviderProfile('openai', 'openai-main');
    const ollama = createProviderProfile('ollama', 'ollama-local');
    settings.providers = { activeProfileId: openAi.id, profiles: [openAi, ollama] };

    const withOpenAiModel = updateSelectedModel(settings, openAi.id, 'gpt-test');
    const withOllamaModel = updateSelectedModel(withOpenAiModel, ollama.id, 'llama3');

    expect(withOllamaModel.providers.profiles).toMatchObject([
      { id: 'openai-main', selectedModelId: 'gpt-test' },
      { id: 'ollama-local', selectedModelId: 'llama3' }
    ]);
    expect(getActiveProvider(withOllamaModel)?.id).toBe('openai-main');
    expect(PROVIDER_CAPABILITIES['custom-json'].maxOutputTokens).toBe(false);
    expect(PROVIDER_CAPABILITIES['custom-json'].temperature).toBe(false);
    expect(PROVIDER_CAPABILITIES.ollama.customHeaders).toBe(true);
  });

  it('creates bounded identifiers and records only safe keyboard shortcuts', () => {
    expect(createSettingsIdentifier('profile', () => 'abc-123')).toBe('profile-abc-123');
    expect(() => createSettingsIdentifier('style', () => 'contains spaces')).toThrow();

    expect(
      shortcutFromKeyboardEvent(new KeyboardEvent('keydown', { altKey: true, code: 'KeyA' }))
    ).toEqual({ alt: true, code: 'KeyA', ctrl: false, meta: false, shift: false });
    expect(shortcutFromKeyboardEvent(new KeyboardEvent('keydown', { code: 'AltLeft' }))).toBeNull();
    expect(shortcutFromKeyboardEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))).toBeNull();
    expect(
      shortcutFromKeyboardEvent(new KeyboardEvent('keydown', { code: 'KeyA', shiftKey: true }))
    ).toBeNull();
    expect(formatShortcut({ alt: false, code: 'KeyK', ctrl: true, meta: false, shift: true })).toBe(
      'Ctrl + Shift + K'
    );
  });

  it('keeps shortcut bindings unique, bounded, and non-empty', () => {
    const first = { alt: true, code: 'KeyA', ctrl: false, meta: false, shift: false };
    const second = { alt: false, code: 'KeyK', ctrl: true, meta: false, shift: false };
    const third = { alt: false, code: 'KeyP', ctrl: true, meta: false, shift: true };
    const fourth = { alt: false, code: 'KeyT', ctrl: false, meta: true, shift: false };

    expect(addShortcutBinding([first], first)).toBeNull();
    expect(addShortcutBinding([first], second)).toEqual([first, second]);
    expect(addShortcutBinding([first, second, third], fourth)).toBeNull();
    expect(MAX_SHORTCUT_BINDINGS).toBe(3);

    expect(replaceShortcutBinding([first, second], 1, first)).toBeNull();
    expect(replaceShortcutBinding([first, second], 1, third)).toEqual([first, third]);
    expect(removeShortcutBinding([first], 0)).toBeNull();
    expect(removeShortcutBinding([first, second], 0)).toEqual([second]);
    expect(formatShortcutBindings([first, second, third])).toBe(
      'Alt + A · Ctrl + K · Ctrl + Shift + P'
    );
  });
});
