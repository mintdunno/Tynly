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
    const ui = new TynlyUiHost(document);

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

  it('renders transformed text as text, not page-visible or executable HTML', () => {
    const ui = new TynlyUiHost(document);
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
    const ui = new TynlyUiHost(document);
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
