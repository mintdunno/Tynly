import { afterEach, describe, expect, it } from 'vitest';

import { TYNLY_UI_HOST_ATTRIBUTE, TynlyUiHost } from './ui-host.ts';

afterEach(() => {
  document.querySelectorAll(`[${TYNLY_UI_HOST_ATTRIBUTE}]`).forEach((host) => host.remove());
  document.body.replaceChildren();
});

describe('TynlyUiHost', () => {
  it('creates an isolated Shadow DOM lazily and positions a field control without layout markup', () => {
    const input = document.createElement('input');
    document.body.append(input);
    mockRect(input, { bottom: 80, left: 20, right: 180, top: 40 });
    const ui = createTestUiHost();

    expect(document.querySelector(`[${TYNLY_UI_HOST_ATTRIBUTE}]`)).toBeNull();

    ui.showFieldButton({
      appearance: 'tynly-icon',
      onActivate: () => undefined,
      position: 'bottom-right',
      target: input
    });

    const host = document.querySelector(`[${TYNLY_UI_HOST_ATTRIBUTE}]`) as HTMLDivElement | null;
    const button = host?.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-tynly-control="field"]'
    );
    expect(host?.shadowRoot).not.toBeNull();
    expect(button?.hidden).toBe(false);
    expect(button?.style.left).toBe('148px');
    expect(button?.style.top).toBe('48px');
    expect(document.querySelector('[data-tynly-control="field"]')).toBeNull();

    ui.hideFieldButton();
    expect(button?.hidden).toBe(true);
  });

  it('keeps the production root closed and rejects synthetic content actions', () => {
    const input = document.createElement('input');
    document.body.append(input);
    let fieldActivations = 0;
    let selectionActivations = 0;
    let replacements = 0;
    let copies = 0;
    let closes = 0;
    let undos = 0;
    let dismissals = 0;
    const openUi = new TynlyUiHost(document, { shadowMode: 'open' });
    openUi.showFieldButton({
      appearance: 'tynly-icon',
      onActivate: () => {
        fieldActivations += 1;
      },
      position: 'bottom-right',
      target: input
    });

    const openHost = document.querySelector(`[${TYNLY_UI_HOST_ATTRIBUTE}]`) as HTMLDivElement;
    openHost.shadowRoot?.querySelector<HTMLButtonElement>('[data-tynly-control="field"]')?.click();
    openUi.showSelectionButton({
      anchor: { bottom: 50, left: 40, right: 100, top: 20 },
      onActivate: () => {
        selectionActivations += 1;
      }
    });
    openHost.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-tynly-control="selection"]')
      ?.click();
    openUi.showPreview({
      onClose: () => {
        closes += 1;
      },
      onCopy: () => {
        copies += 1;
      },
      onReplace: () => {
        replacements += 1;
      },
      target: input,
      text: 'Preview text'
    });
    const panel = openHost.shadowRoot?.querySelector('.panel');
    clickNamedButton(panel, 'Replace');
    clickNamedButton(panel, 'Copy');
    clickNamedButton(panel, 'Close');
    openUi.showToast({
      message: 'Transformed',
      onDismiss: () => {
        dismissals += 1;
      },
      onUndo: () => {
        undos += 1;
      }
    });
    clickNamedButton(openHost.shadowRoot?.querySelector('.toast'), 'Undo');
    openUi.showToast({
      message: 'Transformed',
      onDismiss: () => {
        dismissals += 1;
      }
    });
    clickNamedButton(openHost.shadowRoot?.querySelector('.toast'), 'Dismiss');

    expect(fieldActivations).toBe(0);
    expect(selectionActivations).toBe(0);
    expect(replacements).toBe(0);
    expect(copies).toBe(0);
    expect(closes).toBe(0);
    expect(undos).toBe(0);
    expect(dismissals).toBe(0);
    openUi.destroy();

    const closedUi = new TynlyUiHost(document);
    closedUi.showFieldButton({
      appearance: 'tynly-icon',
      onActivate: () => undefined,
      position: 'bottom-right',
      target: input
    });

    const closedHost = document.querySelector(`[${TYNLY_UI_HOST_ATTRIBUTE}]`) as HTMLDivElement;
    expect(closedHost.shadowRoot).toBeNull();
  });

  it('renders transformed text as text, not page-visible or executable HTML', () => {
    const ui = createTestUiHost();
    let copied = 0;
    ui.showPageResult({
      anchor: { bottom: 70, left: 300, right: 360, top: 50 },
      onClose: () => ui.hidePanel(),
      onCopy: () => {
        copied += 1;
      },
      text: '<img src=x onerror=alert(1)> transformed'
    });

    const host = document.querySelector(`[${TYNLY_UI_HOST_ATTRIBUTE}]`) as HTMLDivElement;
    const panel = host.shadowRoot?.querySelector('.panel');
    const output = host.shadowRoot?.querySelector('.panel-output');
    expect(output?.textContent).toBe('<img src=x onerror=alert(1)> transformed');
    expect(host.shadowRoot?.querySelector('img')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    expect(panel?.getAttribute('style')).toContain('left: 190px');
    expect(panel?.getAttribute('style')).toContain('top: 78px');

    clickNamedButton(panel, 'Copy');
    expect(copied).toBe(1);
  });

  it('wires preview, selection, toast, and close actions to their explicit callbacks', () => {
    const input = document.createElement('input');
    document.body.append(input);
    const ui = createTestUiHost();
    let selected = 0;
    let replaced = 0;
    let undone = 0;
    ui.showSelectionButton({
      anchor: { bottom: 50, left: 40, right: 100, top: 20 },
      onActivate: () => {
        selected += 1;
      }
    });
    const host = document.querySelector(`[${TYNLY_UI_HOST_ATTRIBUTE}]`) as HTMLDivElement;
    const selectionButton = host.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-tynly-control="selection"]'
    );
    selectionButton?.click();
    expect(selected).toBe(1);

    ui.showPreview({
      onClose: () => ui.hidePanel(),
      onCopy: () => undefined,
      onReplace: () => {
        replaced += 1;
      },
      target: input,
      text: 'Preview text'
    });
    clickNamedButton(host.shadowRoot?.querySelector('.panel'), 'Replace');
    expect(replaced).toBe(1);

    ui.showToast({ message: 'Transformed', onUndo: () => (undone += 1) });
    clickNamedButton(host.shadowRoot?.querySelector('.toast'), 'Undo');
    expect(undone).toBe(1);
  });
});

function clickNamedButton(root: ParentNode | null | undefined, name: string): void {
  const button = Array.from(root?.querySelectorAll('button') ?? []).find(
    (candidate) => candidate.textContent === name
  );
  if (button === undefined) {
    throw new Error(`Missing ${name} button`);
  }
  button.click();
}

function createTestUiHost(): TynlyUiHost {
  return new TynlyUiHost(document, {
    isTrustedEvent: () => true,
    shadowMode: 'open'
  });
}

function mockRect(
  element: Element,
  values: Pick<DOMRect, 'bottom' | 'left' | 'right' | 'top'>
): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      ...values,
      height: values.bottom - values.top,
      width: values.right - values.left
    })
  });
}
