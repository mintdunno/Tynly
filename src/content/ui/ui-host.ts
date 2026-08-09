import type { FieldButtonPosition } from '../../core/settings/schema.ts';
import type { ViewportAnchor } from '../selection/selection-tracker.ts';

export const TYNLY_UI_HOST_ATTRIBUTE = 'data-tynly-ui-host';

export interface FieldButtonPresentation {
  readonly appearance: 'monochrome-icon' | 'tynly-icon';
  readonly onActivate: () => void;
  readonly position: FieldButtonPosition;
  readonly target: Element;
}

export interface SelectionButtonPresentation {
  readonly anchor: ViewportAnchor;
  readonly onActivate: () => void;
}

export interface PreviewPresentation {
  readonly onClose: () => void;
  readonly onCopy: () => void;
  readonly onReplace: () => void;
  readonly target: Element;
  readonly text: string;
}

export interface PageResultPresentation {
  readonly anchor: ViewportAnchor;
  readonly onClose: () => void;
  readonly onCopy: () => void;
  readonly text: string;
}

export interface ToastPresentation {
  readonly message: string;
  readonly onDismiss?: () => void;
  readonly onUndo?: () => void;
}

/**
 * A lazy, isolated content UI. Its Shadow DOM contains only static developer
 * markup and provider text is assigned through textContent, never HTML.
 */
export class TynlyUiHost {
  private fieldAction: (() => void) | null = null;
  private fieldButton: HTMLButtonElement | null = null;
  private fieldPresentation: FieldButtonPresentation | null = null;
  private geometryActive = false;
  private geometryQueued = false;
  private host: HTMLDivElement | null = null;
  private interactionButton: HTMLButtonElement | null = null;
  private panel: HTMLDivElement | null = null;
  private selectionAction: (() => void) | null = null;
  private selectionButton: HTMLButtonElement | null = null;
  private shadow: ShadowRoot | null = null;
  private toast: HTMLDivElement | null = null;
  private toastTimer: number | null = null;

  constructor(private readonly document: Document) {}

  showFieldButton(presentation: FieldButtonPresentation): void {
    this.ensure();
    this.fieldPresentation = presentation;
    this.fieldAction = presentation.onActivate;
    const button = this.fieldButton;
    if (button === null) {
      return;
    }
    button.hidden = false;
    button.dataset.appearance = presentation.appearance;
    button.setAttribute('aria-label', 'Transform with Tynly');
    button.replaceChildren(createTynlyMark(this.document, presentation.appearance));
    this.interactionButton = button;
    this.updateFieldGeometry();
    this.startGeometryTracking();
  }

  hideFieldButton(): void {
    if (this.fieldButton !== null) {
      this.fieldButton.hidden = true;
      this.fieldButton.disabled = false;
      this.fieldButton.removeAttribute('aria-busy');
    }
    this.fieldAction = null;
    this.fieldPresentation = null;
    if (this.interactionButton === this.fieldButton) {
      this.interactionButton = null;
    }
    this.stopGeometryTracking();
  }

  showSelectionButton(presentation: SelectionButtonPresentation): void {
    this.ensure();
    this.selectionAction = presentation.onActivate;
    const button = this.selectionButton;
    if (button === null) {
      return;
    }
    button.hidden = false;
    button.setAttribute('aria-label', 'Transform selected text with Tynly');
    button.replaceChildren(createTynlyMark(this.document, 'tynly-icon'));
    positionFloatingElement(button, presentation.anchor, this.document, 'above');
    this.interactionButton = button;
  }

  hideSelectionButton(): void {
    if (this.selectionButton !== null) {
      this.selectionButton.hidden = true;
      this.selectionButton.disabled = false;
      this.selectionButton.removeAttribute('aria-busy');
    }
    this.selectionAction = null;
    if (this.interactionButton === this.selectionButton) {
      this.interactionButton = null;
    }
  }

  setLoading(loading: boolean): void {
    const button = this.interactionButton;
    if (button === null) {
      return;
    }
    button.disabled = loading;
    if (loading) {
      button.setAttribute('aria-busy', 'true');
      button.dataset.loading = 'true';
      return;
    }
    button.removeAttribute('aria-busy');
    delete button.dataset.loading;
  }

  showPreview(presentation: PreviewPresentation): void {
    this.showPanel(
      'Preview',
      presentation.text,
      [
        { label: 'Replace', onActivate: presentation.onReplace },
        { label: 'Copy', onActivate: presentation.onCopy },
        { label: 'Close', onActivate: presentation.onClose, secondary: true }
      ],
      presentation.target.isConnected
        ? toAnchor(presentation.target.getBoundingClientRect())
        : undefined
    );
  }

  showPageResult(presentation: PageResultPresentation): void {
    this.showPanel(
      'Result',
      presentation.text,
      [
        { label: 'Copy', onActivate: presentation.onCopy },
        { label: 'Close', onActivate: presentation.onClose, secondary: true }
      ],
      presentation.anchor
    );
  }

  hidePanel(): void {
    if (this.panel !== null) {
      this.panel.hidden = true;
      this.panel.replaceChildren();
    }
  }

  showToast(presentation: ToastPresentation): void {
    this.ensure();
    const toast = this.toast;
    if (toast === null) {
      return;
    }
    this.clearToastTimer();
    toast.hidden = false;
    toast.replaceChildren();
    const message = this.document.createElement('span');
    message.className = 'message';
    message.textContent = presentation.message;
    toast.append(message);
    if (presentation.onUndo !== undefined) {
      toast.append(
        createActionButton(this.document, 'Undo', () => {
          presentation.onUndo?.();
          this.hideToast();
        })
      );
    }
    toast.append(
      createActionButton(
        this.document,
        'Dismiss',
        () => {
          presentation.onDismiss?.();
          this.hideToast();
        },
        true
      )
    );
    const view = this.document.defaultView;
    if (view !== null) {
      this.toastTimer = view.setTimeout(() => this.hideToast(), 7_000);
    }
  }

  hideToast(): void {
    this.clearToastTimer();
    if (this.toast !== null) {
      this.toast.hidden = true;
      this.toast.replaceChildren();
    }
  }

  showError(message: string): void {
    this.showToast({ message });
  }

  owns(node: Node): boolean {
    return (
      (this.host !== null && this.host.contains(node)) ||
      (this.shadow !== null && node.getRootNode() === this.shadow)
    );
  }

  destroy(): void {
    this.hideFieldButton();
    this.hideSelectionButton();
    this.hidePanel();
    this.hideToast();
    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.fieldButton = null;
    this.selectionButton = null;
    this.panel = null;
    this.toast = null;
  }

  private ensure(): void {
    if (this.shadow !== null) {
      return;
    }
    const parent = this.document.documentElement ?? this.document.body;
    if (parent === null) {
      return;
    }
    const host = this.document.createElement('div');
    host.setAttribute(TYNLY_UI_HOST_ATTRIBUTE, '');
    host.style.cssText =
      'all: initial; display: block; inset: 0; pointer-events: none; position: fixed; z-index: 2147483647;';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(createStyles(this.document));

    const fieldButton = createControlButton(this.document, 'field');
    const selectionButton = createControlButton(this.document, 'selection');
    fieldButton.hidden = true;
    selectionButton.hidden = true;
    fieldButton.addEventListener('pointerdown', preventFocusLoss);
    selectionButton.addEventListener('pointerdown', preventFocusLoss);
    fieldButton.addEventListener('click', () => this.fieldAction?.());
    selectionButton.addEventListener('click', () => this.selectionAction?.());

    const panel = this.document.createElement('div');
    panel.className = 'panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Tynly result');
    panel.setAttribute('role', 'dialog');

    const toast = this.document.createElement('div');
    toast.className = 'toast';
    toast.hidden = true;
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('role', 'status');

    shadow.append(fieldButton, selectionButton, panel, toast);
    parent.append(host);
    this.host = host;
    this.shadow = shadow;
    this.fieldButton = fieldButton;
    this.selectionButton = selectionButton;
    this.panel = panel;
    this.toast = toast;
  }

  private showPanel(
    title: string,
    text: string,
    actions: readonly PanelAction[],
    anchor?: ViewportAnchor
  ): void {
    this.ensure();
    const panel = this.panel;
    if (panel === null) {
      return;
    }
    panel.hidden = false;
    panel.replaceChildren();
    const heading = this.document.createElement('strong');
    heading.className = 'panel-title';
    heading.textContent = title;
    const output = this.document.createElement('pre');
    output.className = 'panel-output';
    output.textContent = text;
    const actionRow = this.document.createElement('div');
    actionRow.className = 'actions';
    for (const action of actions) {
      actionRow.append(
        createActionButton(this.document, action.label, action.onActivate, action.secondary)
      );
    }
    panel.append(heading, output, actionRow);
    const resolvedAnchor = anchor ?? this.currentAnchor();
    if (resolvedAnchor !== null) {
      positionFloatingElement(panel, resolvedAnchor, this.document, 'below');
    }
  }

  private currentAnchor(): ViewportAnchor | null {
    if (this.fieldPresentation !== null && this.fieldPresentation.target.isConnected) {
      return toAnchor(this.fieldPresentation.target.getBoundingClientRect());
    }
    if (this.selectionButton !== null && !this.selectionButton.hidden) {
      const left = Number.parseFloat(this.selectionButton.style.left);
      const top = Number.parseFloat(this.selectionButton.style.top);
      if (Number.isFinite(left) && Number.isFinite(top)) {
        return { bottom: top + 28, left, right: left + 28, top };
      }
    }
    return null;
  }

  private startGeometryTracking(): void {
    if (this.geometryActive) {
      return;
    }
    const view = this.document.defaultView;
    if (view === null) {
      return;
    }
    this.geometryActive = true;
    view.addEventListener('resize', this.queueGeometryUpdate);
    this.document.addEventListener('scroll', this.queueGeometryUpdate, true);
  }

  private stopGeometryTracking(): void {
    if (!this.geometryActive) {
      return;
    }
    const view = this.document.defaultView;
    this.geometryActive = false;
    this.geometryQueued = false;
    view?.removeEventListener('resize', this.queueGeometryUpdate);
    this.document.removeEventListener('scroll', this.queueGeometryUpdate, true);
  }

  private readonly queueGeometryUpdate = (): void => {
    if (!this.geometryActive || this.geometryQueued) {
      return;
    }
    this.geometryQueued = true;
    const view = this.document.defaultView;
    if (view === null || typeof view.requestAnimationFrame !== 'function') {
      this.geometryQueued = false;
      this.updateFieldGeometry();
      return;
    }
    view.requestAnimationFrame(() => {
      this.geometryQueued = false;
      this.updateFieldGeometry();
    });
  };

  private updateFieldGeometry(): void {
    const presentation = this.fieldPresentation;
    const button = this.fieldButton;
    if (presentation === null || button === null || !presentation.target.isConnected) {
      this.hideFieldButton();
      return;
    }
    positionFieldButton(
      button,
      presentation.target.getBoundingClientRect(),
      presentation.position,
      this.document
    );
  }

  private clearToastTimer(): void {
    if (this.toastTimer !== null) {
      this.document.defaultView?.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }
}

interface PanelAction {
  readonly label: string;
  readonly onActivate: () => void;
  readonly secondary?: boolean;
}

function createStyles(document: Document): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; }
    button, .panel, .toast {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    button {
      border: 0;
      cursor: pointer;
      pointer-events: auto;
    }
    button:focus-visible { outline: 3px solid #16b8a6; outline-offset: 2px; }
    .control {
      align-items: center;
      background: #ffffff;
      border: 1px solid rgba(22, 43, 77, .18);
      border-radius: 999px;
      box-shadow: 0 3px 12px rgba(22, 43, 77, .20);
      display: inline-flex;
      height: 28px;
      justify-content: center;
      padding: 5px;
      position: fixed;
      transition: opacity 120ms ease, transform 120ms ease;
      width: 28px;
    }
    .control:hover { transform: translateY(-1px); }
    .control[data-loading="true"] { cursor: wait; opacity: .65; }
    .control[hidden], .panel[hidden], .toast[hidden] { display: none !important; }
    .mark { display: block; height: 17px; width: 17px; }
    .control[data-appearance="monochrome-icon"] .mark path:last-child { fill: #162b4d; }
    .panel {
      background: #ffffff;
      border: 1px solid rgba(22, 43, 77, .16);
      border-radius: 12px;
      box-shadow: 0 12px 34px rgba(22, 43, 77, .22);
      color: #162b4d;
      max-width: min(360px, calc(100vw - 16px));
      min-width: 240px;
      padding: 12px;
      pointer-events: auto;
      position: fixed;
      z-index: 1;
    }
    .panel-title { display: block; font-size: 12px; letter-spacing: .02em; margin-bottom: 8px; }
    .panel-output {
      background: #f5f8fc;
      border-radius: 8px;
      font: 13px/1.45 inherit;
      margin: 0 0 10px;
      max-height: 180px;
      overflow: auto;
      padding: 9px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .actions { display: flex; flex-wrap: wrap; gap: 7px; }
    .action {
      background: #162b4d;
      border-radius: 7px;
      color: #ffffff;
      font-size: 12px;
      font-weight: 650;
      padding: 7px 9px;
    }
    .action.secondary { background: #e8eef6; color: #162b4d; }
    .toast {
      align-items: center;
      background: #162b4d;
      border-radius: 10px;
      bottom: 16px;
      box-shadow: 0 8px 24px rgba(22, 43, 77, .28);
      color: #ffffff;
      display: flex;
      font-size: 13px;
      gap: 8px;
      max-width: calc(100vw - 24px);
      padding: 9px 10px 9px 12px;
      pointer-events: auto;
      position: fixed;
      right: 12px;
    }
    .toast .message { flex: 1; }
    .toast .action { background: transparent; color: #9af0e4; padding: 4px; }
    .toast .action.secondary { color: #d6e3f4; }
    @media (prefers-color-scheme: dark) {
      .control, .panel { background: #142039; border-color: rgba(232, 238, 247, .22); color: #edf5ff; }
      .panel-output { background: #0e1729; }
      .action.secondary { background: #263853; color: #edf5ff; }
    }
  `;
  return style;
}

function createControlButton(document: Document, kind: 'field' | 'selection'): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'control';
  button.dataset.tynlyControl = kind;
  button.type = 'button';
  return button;
}

function createActionButton(
  document: Document,
  label: string,
  onActivate: () => void,
  secondary = false
): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = secondary ? 'action secondary' : 'action';
  button.textContent = label;
  button.type = 'button';
  button.addEventListener('click', onActivate);
  return button;
}

function createTynlyMark(
  document: Document,
  appearance: FieldButtonPresentation['appearance']
): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.classList.add('mark');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('viewBox', '0 0 64 64');
  const stem = document.createElementNS(namespace, 'path');
  stem.setAttribute('fill', '#162B4D');
  stem.setAttribute(
    'd',
    'M10 10c-1.105 0-2 .895-2 2v8c0 1.105.895 2 2 2h15v30c0 1.105.895 2 2 2h10c1.105 0 2-.895 2-2V22h4.25l6.75-6-6.75-6H10Z'
  );
  const arrow = document.createElementNS(namespace, 'path');
  arrow.setAttribute('fill', appearance === 'monochrome-icon' ? '#162B4D' : '#16B8A6');
  arrow.setAttribute('d', 'M43.25 10 56 21 43.25 32v-7.25H35V17.25h8.25V10Z');
  svg.append(stem, arrow);
  return svg;
}

function positionFieldButton(
  element: HTMLElement,
  rect: Pick<DOMRect, 'bottom' | 'left' | 'right' | 'top'>,
  position: FieldButtonPosition,
  document: Document
): void {
  const size = 28;
  const inset = 4;
  const horizontal = position.endsWith('right') ? rect.right - size - inset : rect.left + inset;
  const vertical = position.startsWith('bottom') ? rect.bottom - size - inset : rect.top + inset;
  positionAt(element, horizontal, vertical, document);
}

function positionFloatingElement(
  element: HTMLElement,
  anchor: ViewportAnchor,
  document: Document,
  direction: 'above' | 'below'
): void {
  const width = element.classList.contains('panel') ? 280 : 28;
  const height = element.classList.contains('panel') ? 120 : 28;
  const left = anchor.left + (anchor.right - anchor.left) / 2 - width / 2;
  const top = direction === 'above' ? anchor.top - height - 8 : anchor.bottom + 8;
  positionAt(element, left, top, document, width, height);
}

function positionAt(
  element: HTMLElement,
  requestedLeft: number,
  requestedTop: number,
  document: Document,
  width = 28,
  height = 28
): void {
  const view = document.defaultView;
  const maxLeft = Math.max(4, (view?.innerWidth ?? width + 8) - width - 4);
  const maxTop = Math.max(4, (view?.innerHeight ?? height + 8) - height - 4);
  element.style.left = `${Math.min(maxLeft, Math.max(4, requestedLeft))}px`;
  element.style.top = `${Math.min(maxTop, Math.max(4, requestedTop))}px`;
}

function toAnchor(rect: Pick<DOMRect, 'bottom' | 'left' | 'right' | 'top'>): ViewportAnchor {
  return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
}

function preventFocusLoss(event: PointerEvent): void {
  event.preventDefault();
}
