import type { ShortcutSettings } from '../../core/settings/schema.ts';

export type ShortcutHandler = () => boolean;

export interface ShortcutServiceOptions {
  /** Production uses Event.isTrusted; tests can provide a deterministic substitute. */
  readonly isTrustedEvent?: (event: Event) => boolean;
}

/**
 * Event-driven shortcut handling that remains inactive during IME composition
 * and leaves browser-reserved combinations alone unless Tynly actually handles
 * the matching shortcut.
 */
export class ShortcutService {
  private composing = false;
  private readonly isTrustedEvent: (event: Event) => boolean;
  private started = false;

  constructor(
    private readonly document: Document,
    private readonly getSettings: () => ShortcutSettings,
    private readonly onShortcut: ShortcutHandler,
    options: ShortcutServiceOptions = {}
  ) {
    this.isTrustedEvent = options.isTrustedEvent ?? isTrustedUserEvent;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.document.addEventListener('compositionstart', this.handleCompositionStart, true);
    this.document.addEventListener('compositionend', this.handleCompositionEnd, true);
    this.document.addEventListener('keydown', this.handleKeydown, true);
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.composing = false;
    this.document.removeEventListener('compositionstart', this.handleCompositionStart, true);
    this.document.removeEventListener('compositionend', this.handleCompositionEnd, true);
    this.document.removeEventListener('keydown', this.handleKeydown, true);
  }

  private readonly handleCompositionStart = (event: CompositionEvent): void => {
    if (this.isTrustedEvent(event)) {
      this.composing = true;
    }
  };

  private readonly handleCompositionEnd = (event: CompositionEvent): void => {
    if (this.isTrustedEvent(event)) {
      this.composing = false;
    }
  };

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    const settings = this.getSettings();
    if (
      !this.isTrustedEvent(event) ||
      !settings.enabled ||
      this.composing ||
      event.isComposing ||
      event.repeat ||
      event.defaultPrevented ||
      (event.ctrlKey && event.altKey && event.getModifierState('AltGraph')) ||
      !matchesShortcut(event, settings)
    ) {
      return;
    }

    if (this.onShortcut()) {
      event.preventDefault();
    }
  };
}

function isTrustedUserEvent(event: Event): boolean {
  return event.isTrusted;
}

function matchesShortcut(event: KeyboardEvent, settings: ShortcutSettings): boolean {
  const shortcut = settings.shortcut;
  return (
    event.code === shortcut.code &&
    event.altKey === shortcut.alt &&
    event.ctrlKey === shortcut.ctrl &&
    event.metaKey === shortcut.meta &&
    event.shiftKey === shortcut.shift
  );
}
