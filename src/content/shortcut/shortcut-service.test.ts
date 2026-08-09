import { afterEach, describe, expect, it } from 'vitest';

import { createDefaultAppSettings } from '../../core/settings/defaults.ts';

import { ShortcutService } from './shortcut-service.ts';

afterEach(() => {
  document.body.replaceChildren();
});

describe('ShortcutService', () => {
  it('handles the configured shortcut only when its callback claims the event', () => {
    let calls = 0;
    const settings = createDefaultAppSettings().controls.shortcut;
    const service = new ShortcutService(
      document,
      () => settings,
      () => {
        calls += 1;
        return true;
      }
    );
    service.start();

    const event = new KeyboardEvent('keydown', {
      altKey: true,
      bubbles: true,
      cancelable: true,
      code: 'KeyA'
    });
    document.dispatchEvent(event);

    expect(calls).toBe(1);
    expect(event.defaultPrevented).toBe(true);
    service.stop();
  });

  it('ignores IME composition, repeats, mismatched modifiers, and disabled settings', () => {
    let calls = 0;
    const settings = createDefaultAppSettings().controls.shortcut;
    const service = new ShortcutService(
      document,
      () => settings,
      () => {
        calls += 1;
        return true;
      }
    );
    service.start();

    document.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    document.dispatchEvent(
      new KeyboardEvent('keydown', { altKey: true, bubbles: true, code: 'KeyA' })
    );
    document.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    document.dispatchEvent(
      new KeyboardEvent('keydown', { altKey: true, bubbles: true, code: 'KeyA', repeat: true })
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyA' }));
    settings.enabled = false;
    document.dispatchEvent(
      new KeyboardEvent('keydown', { altKey: true, bubbles: true, code: 'KeyA' })
    );

    expect(calls).toBe(0);
    service.stop();
  });
});
