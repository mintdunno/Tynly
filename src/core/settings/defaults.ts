import { CURRENT_SETTINGS_VERSION } from './schema.ts';

import type { AppSettings } from './schema.ts';

/**
 * Always create a fresh value. Settings are mutable while being edited, so a
 * shared exported object would make one caller's edits visible to another.
 */
export function createDefaultAppSettings(): AppSettings {
  return {
    version: CURRENT_SETTINGS_VERSION,
    language: {
      source: 'vi',
      target: 'en'
    },
    behavior: {
      afterTransform: 'replace',
      showUndoNotification: true
    },
    controls: {
      shortcut: {
        enabled: true,
        shortcut: {
          code: 'KeyA',
          alt: true,
          ctrl: false,
          meta: false,
          shift: false
        }
      },
      fieldButton: {
        enabled: true,
        position: 'bottom-right',
        appearance: 'tynly-icon',
        clickBehavior: 'transform-immediately'
      },
      selection: {
        enabled: true,
        editableBehavior: 'replace',
        pageBehavior: 'show-result'
      }
    },
    styles: {
      selected: {
        kind: 'built-in',
        id: 'natural'
      },
      custom: []
    },
    providers: {
      activeProfileId: null,
      profiles: []
    }
  };
}
