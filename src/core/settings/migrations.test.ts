import { describe, expect, it } from 'vitest';

import { createDefaultAppSettings } from './defaults.ts';
import { migrateAppSettings, migrateSettings } from './migrations.ts';

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
      shortcut: { code: 'KeyA', alt: true, ctrl: false, meta: false, shift: false }
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

    result.settings.controls.shortcut.shortcut.alt = false;
    direct.language.source = 'en';

    expect(result).toMatchObject({ migrated: false, recovered: false });
    expect(source.controls.shortcut.shortcut.alt).toBe(true);
    expect(source.language.source).toBe('vi');
  });
});
