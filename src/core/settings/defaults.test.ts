import { describe, expect, it } from 'vitest';

import { createDefaultAppSettings } from './defaults.ts';
import { isAppSettings } from './schema.ts';

describe('createDefaultAppSettings', () => {
  it('uses the approved Vietnamese-to-English auto-replace defaults', () => {
    const settings = createDefaultAppSettings();

    expect(settings).toMatchObject({
      version: 2,
      language: { source: 'vi', target: 'en' },
      behavior: { afterTransform: 'replace', showUndoNotification: true },
      controls: {
        shortcut: {
          enabled: true,
          shortcuts: [{ code: 'KeyA', alt: true, ctrl: false, meta: false, shift: false }]
        },
        fieldButton: {
          enabled: true,
          position: 'bottom-right',
          appearance: 'tynly-icon'
        },
        selection: {
          enabled: true
        }
      },
      styles: { selected: { kind: 'built-in', id: 'natural' }, custom: [] },
      providers: { activeProfileId: null, profiles: [] }
    });
    expect(isAppSettings(settings)).toBe(true);
  });

  it('returns independent values for callers that edit settings', () => {
    const first = createDefaultAppSettings();
    const second = createDefaultAppSettings();

    first.language.source = 'en';
    first.controls.shortcut.shortcuts[0]!.alt = false;
    first.styles.custom.push({ id: 'brief', name: 'Brief', instruction: 'Keep it brief.' });

    expect(second.language.source).toBe('vi');
    expect(second.controls.shortcut.shortcuts[0]?.alt).toBe(true);
    expect(second.styles.custom).toEqual([]);
  });
});
