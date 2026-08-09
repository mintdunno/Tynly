import type { InputAdapterRegistry, ResolvedInputTarget } from '../input/input-adapter-registry.ts';

export type FocusChangeHandler = (target: ResolvedInputTarget | null) => void;

/** Tracks only safe, supported editors and never scans the page. */
export class FocusTracker {
  private active: ResolvedInputTarget | null = null;
  private started = false;

  constructor(
    private readonly document: Document,
    private readonly adapters: InputAdapterRegistry,
    private readonly onChange: FocusChangeHandler
  ) {}

  get current(): ResolvedInputTarget | null {
    return this.active;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.document.addEventListener('focusin', this.handleFocusChange, true);
    this.document.addEventListener('focusout', this.handleFocusOut, true);
    this.refresh();
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.document.removeEventListener('focusin', this.handleFocusChange, true);
    this.document.removeEventListener('focusout', this.handleFocusOut, true);
    this.setActive(null);
  }

  refresh(): void {
    this.setActive(this.adapters.resolve(this.document.activeElement));
  }

  private readonly handleFocusChange = (): void => {
    this.refresh();
  };

  private readonly handleFocusOut = (): void => {
    queueMicrotask(() => {
      if (this.started) {
        this.refresh();
      }
    });
  };

  private setActive(next: ResolvedInputTarget | null): void {
    if (this.active?.target === next?.target && this.active?.adapter === next?.adapter) {
      return;
    }
    this.active = next;
    this.onChange(next);
  }
}
