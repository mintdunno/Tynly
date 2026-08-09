import { afterEach, describe, expect, it } from 'vitest';

import { createDefaultAppSettings } from '../../core/settings/defaults.ts';

import { ShortcutService } from './shortcut-service.ts';

afterEach(() => {
  document.body.replaceChildren();
});

describe('ShortcutService', () => {
  it('handles each configured binding only when its callback claims the event', () => {
    let calls = 0;
    const settings = createDefaultAppSettings().controls.shortcut;
    settings.shortcuts = [
      { alt: true, code: 'KeyA', ctrl: false, meta: false, shift: false },
      { alt: false, code: 'KeyT', ctrl: true, meta: false, shift: false },
      { alt: false, code: 'KeyK', ctrl: false, meta: true, shift: false }
    ];
    const service = new ShortcutService(
      document,
      () => settings,
      () => {
        calls += 1;
        return true;
      },
      { isTrustedEvent: () => true }
    );
    service.start();

    const first = new KeyboardEvent('keydown', {
      altKey: true,
      bubbles: true,
      cancelable: true,
      code: 'KeyA'
    });
    const second = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyT',
      ctrlKey: true
    });
    const third = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyK',
      metaKey: true
    });
    document.dispatchEvent(first);
    document.dispatchEvent(second);
    document.dispatchEvent(third);

    expect(calls).toBe(3);
    expect(first.defaultPrevented).toBe(true);
    expect(second.defaultPrevented).toBe(true);
    expect(third.defaultPrevented).toBe(true);
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
      },
      { isTrustedEvent: () => true }
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

  it('does not claim bare or shift-only keys if unsafe settings bypass validation', () => {
    let calls = 0;
    const settings = createDefaultAppSettings().controls.shortcut;
    settings.shortcuts = [
      { alt: false, code: 'KeyT', ctrl: false, meta: false, shift: false },
      { alt: false, code: 'KeyY', ctrl: false, meta: false, shift: true }
    ];
    const service = new ShortcutService(
      document,
      () => settings,
      () => {
        calls += 1;
        return true;
      },
      { isTrustedEvent: () => true }
    );
    service.start();

    const bare = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyT'
    });
    const shiftOnly = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyY',
      shiftKey: true
    });
    document.dispatchEvent(bare);
    document.dispatchEvent(shiftOnly);

    expect(calls).toBe(0);
    expect(bare.defaultPrevented).toBe(false);
    expect(shiftOnly.defaultPrevented).toBe(false);
    service.stop();
  });

  it('ignores a synthetic matching shortcut by default', () => {
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

    expect(calls).toBe(0);
    expect(event.defaultPrevented).toBe(false);
    service.stop();
  });

  it('does not let synthetic composition events suppress a trusted shortcut', () => {
    let calls = 0;
    const settings = createDefaultAppSettings().controls.shortcut;
    const service = new ShortcutService(
      document,
      () => settings,
      () => {
        calls += 1;
        return true;
      },
      { isTrustedEvent: (event) => event.type === 'keydown' }
    );
    service.start();

    document.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    const shortcut = new KeyboardEvent('keydown', {
      altKey: true,
      bubbles: true,
      cancelable: true,
      code: 'KeyA'
    });
    document.dispatchEvent(shortcut);

    expect(calls).toBe(1);
    expect(shortcut.defaultPrevented).toBe(true);
    service.stop();
  });
});
