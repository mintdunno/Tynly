import type { ContentSettingsSnapshot } from '../core/settings/schema.ts';
import type { TransformInputLimitReason } from '../core/transform/limits.ts';
import { ContentMessageClient } from './content-message-client.ts';
import { FocusTracker } from './focus/focus-tracker.ts';
import { InputAdapterRegistry, type ResolvedInputTarget } from './input/input-adapter-registry.ts';
import { SelectionTracker, type SelectionContext } from './selection/selection-tracker.ts';
import { ShortcutService } from './shortcut/shortcut-service.ts';
import {
  TransformController,
  type ContentTransformClient,
  type TransformPresentation
} from './transform-controller.ts';
import { TynlyUiHost } from './ui/ui-host.ts';

export interface ContentBootstrapClient extends ContentTransformClient {
  getSettings(): Promise<ContentSettingsSnapshot | null>;
}

/** Wires event-driven content interactions without exposing provider settings or secrets. */
export class ContentBootstrap {
  private readonly adapters = new InputAdapterRegistry();
  private controller: TransformController | null = null;
  private focus: FocusTracker | null = null;
  private selection: SelectionTracker | null = null;
  private settings: ContentSettingsSnapshot | null = null;
  private shortcut: ShortcutService | null = null;
  private started = false;

  constructor(
    private readonly document: Document,
    private readonly client: ContentBootstrapClient = new ContentMessageClient(),
    private readonly ui: TynlyUiHost = new TynlyUiHost(document)
  ) {}

  async start(): Promise<boolean> {
    if (this.started) {
      return true;
    }
    const settings = await this.client.getSettings();
    if (settings === null) {
      return false;
    }

    this.settings = settings;
    this.controller = new TransformController(this.client, this.createPresentation(), {
      adapters: this.adapters
    });
    this.focus = new FocusTracker(this.document, this.adapters, (target) =>
      this.handleFocus(target)
    );
    this.selection = new SelectionTracker(
      this.document,
      this.adapters,
      (selection) => this.handleSelection(selection),
      { isIgnoredNode: (node) => this.ui.owns(node) }
    );
    this.shortcut = new ShortcutService(
      this.document,
      () => this.currentSettings().controls.shortcut,
      () => this.activateShortcut()
    );
    this.started = true;
    this.focus.start();
    this.selection.start();
    this.shortcut.start();
    return true;
  }

  stop(): void {
    this.controller?.cancelAll();
    this.shortcut?.stop();
    this.selection?.stop();
    this.focus?.stop();
    this.shortcut = null;
    this.selection = null;
    this.focus = null;
    this.controller = null;
    this.settings = null;
    this.started = false;
    this.ui.destroy();
  }

  private handleFocus(target: ResolvedInputTarget | null): void {
    const settings = this.settings;
    if (settings === null || target === null || !settings.controls.fieldButton.enabled) {
      this.ui.hideFieldButton();
      return;
    }
    if (this.selection?.current !== null) {
      return;
    }
    this.showFieldButton(target);
  }

  private handleSelection(selection: SelectionContext | null): void {
    const settings = this.settings;
    if (settings === null) {
      return;
    }
    this.ui.hideSelectionButton();
    if (selection === null) {
      const focused = this.focus?.current;
      if (focused !== null && focused !== undefined && settings.controls.fieldButton.enabled) {
        this.showFieldButton(focused);
      }
      return;
    }

    this.ui.hideFieldButton();
    if (!settings.controls.selection.enabled) {
      return;
    }
    this.ui.showSelectionButton({
      anchor: selection.anchor,
      onActivate: () => {
        if (this.selection?.current !== selection) {
          return;
        }
        this.activateSelection(selection, 'selection-button');
      }
    });
  }

  private showFieldButton(target: ResolvedInputTarget): void {
    const settings = this.currentSettings();
    this.ui.showFieldButton({
      appearance: settings.controls.fieldButton.appearance,
      onActivate: () => {
        this.controller?.startEditable(
          target.target,
          'field-button',
          settings.behavior.afterTransform,
          settings.behavior.showUndoNotification
        );
      },
      position: settings.controls.fieldButton.position,
      target: target.target
    });
  }

  private activateSelection(
    selection: SelectionContext,
    trigger: 'selection-button' | 'shortcut'
  ): boolean {
    const controller = this.controller;
    if (controller === null) {
      return false;
    }
    const settings = this.currentSettings();
    if (selection.kind === 'page') {
      return controller.startPageSelection(selection.text, trigger, selection.anchor);
    }
    return controller.startEditable(
      selection.target.target,
      trigger,
      settings.behavior.afterTransform,
      settings.behavior.showUndoNotification
    );
  }

  private activateShortcut(): boolean {
    const selection = this.selection?.current;
    if (selection !== null && selection !== undefined) {
      return this.activateSelection(selection, 'shortcut');
    }
    const focused = this.focus?.current;
    if (focused === null || focused === undefined || this.controller === null) {
      return false;
    }
    const settings = this.currentSettings();
    return this.controller.startEditable(
      focused.target,
      'shortcut',
      settings.behavior.afterTransform,
      settings.behavior.showUndoNotification
    );
  }

  private createPresentation(): TransformPresentation {
    return {
      onEditablePreview: (result) => {
        this.ui.showPreview({
          onClose: () => this.ui.hidePanel(),
          onCopy: () => this.copyText(result.text),
          onReplace: () => {
            this.ui.hidePanel();
            if (!this.controller?.applyPreview(result.operationId)) {
              this.ui.showError('The selected text changed before it could be replaced.');
            }
          },
          target: result.target,
          text: result.text
        });
      },
      onError: (error) => this.ui.showError(error.message),
      onInputRejected: (reason) => this.ui.showError(inputRejectionMessage(reason)),
      onLoading: (_operationId, loading) => this.ui.setLoading(loading),
      onPageResult: (result) => {
        this.ui.showPageResult({
          anchor: result.anchor,
          onClose: () => this.ui.hidePanel(),
          onCopy: () => this.copyText(result.text),
          text: result.text
        });
      },
      onReplacement: (result) => {
        this.ui.hidePanel();
        if (!result.undoAvailable) {
          return;
        }
        this.ui.showToast({
          message: 'Transformed',
          onUndo: () => {
            const undo = this.controller?.undoLast(result.operationId);
            if (undo === undefined || !undo.ok) {
              this.ui.showError('Undo is no longer available because the text changed.');
            }
          }
        });
      }
    };
  }

  private async copyText(text: string): Promise<void> {
    if (await writeTextToClipboard(this.document, text)) {
      this.ui.showToast({ message: 'Copied' });
      return;
    }
    this.ui.showError('Copy failed.');
  }

  private currentSettings(): ContentSettingsSnapshot {
    if (this.settings === null) {
      throw new Error('Content bootstrap has not started.');
    }
    return this.settings;
  }
}

export interface ClipboardWriter {
  writeText(text: string): Promise<void>;
}

/** Uses the async clipboard API first, with a user-gesture fallback for HTTP pages. */
export async function writeTextToClipboard(
  document: Document,
  text: string,
  clipboard: ClipboardWriter | undefined = document.defaultView?.navigator.clipboard
): Promise<boolean> {
  if (clipboard !== undefined) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Some HTTP pages do not grant content scripts the async Clipboard API.
    }
  }
  return writeTextWithLegacyCommand(document, text);
}

function writeTextWithLegacyCommand(document: Document, text: string): boolean {
  const parent = document.body ?? document.documentElement;
  if (parent === null || typeof document.execCommand !== 'function') {
    return false;
  }

  const previousFocus = document.activeElement;
  const textarea = document.createElement('textarea');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.cssText =
    'height: 1px; left: -9999px; opacity: 0; pointer-events: none; position: fixed; top: 0; width: 1px;';
  textarea.value = text;
  parent.append(textarea);
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
      try {
        previousFocus.focus({ preventScroll: true });
      } catch {
        // The original focus target may refuse programmatic focus.
      }
    }
  }
}

function inputRejectionMessage(reason: TransformInputLimitReason): string {
  switch (reason) {
    case 'too-long':
      return 'Select a shorter passage before transforming.';
    case 'empty':
    case 'not-text':
      return 'Select some text before transforming.';
  }
}

export function startContentBootstrap(document: Document = globalThis.document): Promise<boolean> {
  return new ContentBootstrap(document).start();
}
