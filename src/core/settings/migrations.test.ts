import { describe, expect, it } from 'vitest';

import { createDefaultAppSettings } from './defaults.ts';
import { migrateAppSettings, migrateSettings } from './migrations.ts';
import { isAppSettings } from './schema.ts';

describe('migrateAppSettings', () => {
  it('migrates a legacy shape while retaining valid user choices', () => {
    const result = migrateAppSettings({
      version: 0,
      sourceLanguage: 'Vietnamese',
      targetLanguage: 'English',
      style: 'formal',
      replaceAutomatically: false,
      showUndo: false,
      shortcut: 'Alt + A',
      shortcutEnabled: false,
      fieldButtonEnabled: false,
      selectionEnabled: false,
      customStyles: [
        {
          id: 'direct',
          name: 'Direct',
          instruction: 'Use short direct sentences.'
        }
      ]
    });

    expect(result).toMatchObject({ sourceVersion: 0, migrated: true, recovered: true });
    expect(result.settings.language).toEqual({ source: 'vi', target: 'en' });
    expect(result.settings.styles.selected).toEqual({ kind: 'built-in', id: 'formal' });
    expect(result.settings.behavior).toEqual({
      afterTransform: 'preview',
      showUndoNotification: false
    });
    expect(result.settings.controls.shortcut).toEqual({
      enabled: false,
      shortcuts: [{ code: 'KeyA', alt: true, ctrl: false, meta: false, shift: false }]
    });
    expect(result.settings.controls.fieldButton.enabled).toBe(false);
    expect(result.settings.controls.selection.enabled).toBe(false);
    expect(result.settings.styles.custom).toEqual([
      { id: 'direct', name: 'Direct', instruction: 'Use short direct sentences.' }
    ]);
  });

  it('recovers malformed fields independently instead of resetting valid settings', () => {
    const result = migrateAppSettings({
      version: 1,
      language: { source: 'auto', target: 'auto' },
      behavior: { afterTransform: 'preview', showUndoNotification: false },
      providers: {
        activeProfileId: 'valid-openai',
        profiles: [
          {
            id: 'valid-openai',
            name: 'OpenAI',
            kind: 'openai',
            selectedModelId: 'gpt-4.1-mini',
            timeoutMs: 20_000,
            temperature: 0.2,
            maxOutputTokens: 1_000,
            baseUrl: 'https://api.openai.com/v1',
            apiKey: 'private-key'
          },
          {
            id: 'bad-profile',
            name: '',
            kind: 'openai',
            selectedModelId: 'bad',
            timeoutMs: 1,
            temperature: null,
            maxOutputTokens: null,
            baseUrl: 'not a URL',
            apiKey: ''
          }
        ]
      }
    });

    expect(result.settings.language).toEqual({ source: 'auto', target: 'en' });
    expect(result.settings.behavior).toEqual({
      afterTransform: 'preview',
      showUndoNotification: false
    });
    expect(result.settings.providers.activeProfileId).toBe('valid-openai');
    expect(result.settings.providers.profiles).toHaveLength(1);
    expect(result.settings.providers.profiles[0]?.id).toBe('valid-openai');
  });

  it('returns safe defaults for missing and unsupported future schemas', () => {
    const missing = migrateAppSettings(null);
    const future = migrateAppSettings({ version: 999, language: { source: 'en', target: 'vi' } });

    expect(missing).toMatchObject({ sourceVersion: null, migrated: true, recovered: true });
    expect(missing.settings).toEqual(createDefaultAppSettings());
    expect(future).toMatchObject({ sourceVersion: 999, migrated: true, recovered: true });
    expect(future.settings).toEqual(createDefaultAppSettings());
  });

  it('does not retain references to already valid settings', () => {
    const source = createDefaultAppSettings();
    const result = migrateAppSettings(source);
    const direct = migrateSettings(source);

    result.settings.controls.shortcut.shortcuts[0]!.alt = false;
    result.settings.controls.shortcut.shortcuts.push({
      code: 'KeyB',
      alt: true,
      ctrl: false,
      meta: false,
      shift: false
    });
    direct.language.source = 'en';

    expect(result).toMatchObject({ migrated: false, recovered: false });
    expect(source.controls.shortcut.shortcuts[0]?.alt).toBe(true);
    expect(source.controls.shortcut.shortcuts).toHaveLength(1);
    expect(source.language.source).toBe('vi');
  });

  it('bounds recovered custom styles so migrations always return valid settings', () => {
    const customStyles = Array.from({ length: 31 }, (_, index) => ({
      id: `style-${index + 1}`,
      name: `Style ${index + 1}`,
      instruction: 'Use concise, natural language.'
    }));

    const result = migrateAppSettings({
      version: 0,
      customStyles,
      selectedStyle: 'style-1'
    });

    expect(result.settings.styles.custom).toHaveLength(30);
    expect(result.settings.styles.selected).toEqual({ kind: 'custom', id: 'style-1' });
    expect(isAppSettings(result.settings)).toBe(true);
  });

  it('migrates version 1 controls to one behavior and an independent shortcut array', () => {
    const v1Settings = {
      version: 1,
      language: { source: 'vi', target: 'en' },
      behavior: { afterTransform: 'preview', showUndoNotification: false },
      controls: {
        shortcut: {
          enabled: false,
          shortcut: { code: 'KeyB', alt: true, ctrl: false, meta: false, shift: true }
        },
        fieldButton: {
          enabled: false,
          position: 'top-left',
          appearance: 'monochrome-icon',
          clickBehavior: 'transform-immediately'
        },
        selection: {
          enabled: false,
          editableBehavior: 'replace',
          pageBehavior: 'show-result'
        }
      },
      styles: { selected: { kind: 'built-in', id: 'natural' }, custom: [] },
      providers: { activeProfileId: null, profiles: [] }
    };

    const result = migrateAppSettings(v1Settings);

    expect(result).toMatchObject({ sourceVersion: 1, migrated: true, recovered: true });
    expect(result.settings.behavior).toEqual({
      afterTransform: 'preview',
      showUndoNotification: false
    });
    expect(result.settings.controls).toEqual({
      shortcut: {
        enabled: false,
        shortcuts: [{ code: 'KeyB', alt: true, ctrl: false, meta: false, shift: true }]
      },
      fieldButton: { enabled: false, position: 'top-left', appearance: 'monochrome-icon' },
      selection: { enabled: false }
    });
    expect(isAppSettings(result.settings)).toBe(true);
  });

  it('drops unsafe or duplicate recovered shortcuts without losing a valid binding', () => {
    const result = migrateAppSettings({
      version: 1,
      controls: {
        shortcut: {
          enabled: true,
          shortcuts: [
            { code: 'KeyA', alt: true, ctrl: false, meta: false, shift: false },
            { code: 'KeyA', alt: true, ctrl: false, meta: false, shift: false },
            { code: 'KeyB', alt: false, ctrl: false, meta: false, shift: true },
            { code: 'KeyC', alt: false, ctrl: true, meta: false, shift: false }
          ]
        }
      }
    });

    expect(result.settings.controls.shortcut.shortcuts).toEqual([
      { code: 'KeyA', alt: true, ctrl: false, meta: false, shift: false },
      { code: 'KeyC', alt: false, ctrl: true, meta: false, shift: false }
    ]);
    expect(isAppSettings(result.settings)).toBe(true);
  });
});
