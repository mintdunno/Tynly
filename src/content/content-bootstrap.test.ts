import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDefaultAppSettings } from '../core/settings/defaults.ts';
import {
  toContentSettingsSnapshot,
  type ContentSettingsSnapshot
} from '../core/settings/schema.ts';
import { TYNLY_UI_HOST_ATTRIBUTE, TynlyUiHost } from './ui/ui-host.ts';

import {
  ContentBootstrap,
  type ContentBootstrapClient,
  writeTextToClipboard
} from './content-bootstrap.ts';

afterEach(() => {
  vi.restoreAllMocks();
  document.getSelection()?.removeAllRanges();
  document.querySelectorAll(`[${TYNLY_UI_HOST_ATTRIBUTE}]`).forEach((host) => host.remove());
  document.body.replaceChildren();
});

describe('ContentBootstrap', () => {
  it('wires the field control into the shared transform controller and Undo toast', async () => {
    const input = document.createElement('input');
    input.value = 'before';
    mockRect(input);
    document.body.append(input);
    const client = new BootstrapClient(defaultSettings(), { kind: 'result', text: 'after' });
    const bootstrap = new ContentBootstrap(document, client, createTestUiHost());

    await expect(bootstrap.start()).resolves.toBe(true);
    input.focus();
    await settle();
    const host = getHost();
    click(host.shadowRoot?.querySelector('[data-tynly-control="field"]'));
    await settle();

    expect(client.requests).toMatchObject([{ text: 'before', trigger: 'field-button' }]);
    expect(input.value).toBe('after');
    expect(host.shadowRoot?.querySelector('.toast')?.textContent).toContain('Transformed');

    clickNamed(host.shadowRoot?.querySelector('.toast'), 'Undo');
    expect(input.value).toBe('before');
    bootstrap.stop();
  });

  it('uses the shared Behavior preview for field transforms and keeps page selection read-only', async () => {
    const settings = defaultSettings();
    settings.behavior.afterTransform = 'preview';
    const input = document.createElement('input');
    input.value = 'before';
    mockRect(input);
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Normal selection';
    document.body.append(input, paragraph);
    const client = new BootstrapClient(settings, { kind: 'result', text: 'after' });
    const bootstrap = new ContentBootstrap(document, client, createTestUiHost());

    await bootstrap.start();
    input.focus();
    await settle();
    const host = getHost();
    click(host.shadowRoot?.querySelector('[data-tynly-control="field"]'));
    await settle();
    expect(input.value).toBe('before');
    clickNamed(host.shadowRoot?.querySelector('.panel'), 'Replace');
    expect(input.value).toBe('after');

    const text = paragraph.firstChild ?? fail('expected text node');
    setSelection(text, 0, text, 6);
    document.dispatchEvent(new Event('selectionchange'));
    await settle();
    click(host.shadowRoot?.querySelector('[data-tynly-control="selection"]'));
    await settle();

    expect(paragraph.textContent).toBe('Normal selection');
    expect(host.shadowRoot?.querySelector('.panel-output')?.textContent).toBe('after');
    bootstrap.stop();
  });

  it('uses the shared Behavior preview for editable selection transforms', async () => {
    const settings = defaultSettings();
    settings.behavior.afterTransform = 'preview';
    settings.controls.fieldButton.enabled = false;
    const input = document.createElement('input');
    input.value = 'before';
    mockRect(input);
    document.body.append(input);
    const client = new BootstrapClient(settings, { kind: 'result', text: 'after' });
    const bootstrap = new ContentBootstrap(document, client, createTestUiHost());

    await bootstrap.start();
    input.focus();
    input.setSelectionRange(0, input.value.length);
    document.dispatchEvent(new Event('selectionchange'));
    await settle();
    const host = getHost();
    click(host.shadowRoot?.querySelector('[data-tynly-control="selection"]'));
    await settle();

    expect(client.requests).toMatchObject([{ text: 'before', trigger: 'selection-button' }]);
    expect(input.value).toBe('before');
    clickNamed(host.shadowRoot?.querySelector('.panel'), 'Replace');
    expect(input.value).toBe('after');
    bootstrap.stop();
  });

  it('does not create content controls when public settings cannot be loaded', async () => {
    const client = new BootstrapClient(null, { kind: 'result', text: 'unused' });
    const bootstrap = new ContentBootstrap(document, client);

    await expect(bootstrap.start()).resolves.toBe(false);
    expect(document.querySelector(`[${TYNLY_UI_HOST_ATTRIBUTE}]`)).toBeNull();
  });

  it('does not send a transform for a synthetic shortcut event', async () => {
    const settings = defaultSettings();
    settings.behavior.afterTransform = 'preview';
    settings.controls.fieldButton.enabled = false;
    settings.controls.selection.enabled = false;
    const input = document.createElement('input');
    input.value = 'before';
    mockRect(input);
    document.body.append(input);
    const client = new BootstrapClient(settings, { kind: 'result', text: 'after' });
    const bootstrap = new ContentBootstrap(document, client);

    await bootstrap.start();
    input.focus();
    await settle();
    expect(document.querySelector(`[${TYNLY_UI_HOST_ATTRIBUTE}]`)).toBeNull();

    const shortcut = new KeyboardEvent('keydown', {
      altKey: true,
      bubbles: true,
      cancelable: true,
      code: 'KeyA'
    });
    document.dispatchEvent(shortcut);
    await settle();

    expect(shortcut.defaultPrevented).toBe(false);
    expect(client.requests).toEqual([]);
    expect(document.querySelector(`[${TYNLY_UI_HOST_ATTRIBUTE}]`)).toBeNull();
    bootstrap.stop();
  });

  it('uses a legacy user-gesture copy command when the async clipboard is unavailable', async () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const command = vi.fn((name: string) => {
      const focused = document.activeElement;
      return (
        name === 'copy' && focused instanceof HTMLTextAreaElement && focused.value === 'Copied text'
      );
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: command });
    try {
      await expect(
        writeTextToClipboard(document, 'Copied text', {
          writeText: async () => Promise.reject(new Error('Permission denied'))
        })
      ).resolves.toBe(true);

      expect(command).toHaveBeenCalledWith('copy');
      expect(document.querySelector('textarea')).toBeNull();
      expect(document.activeElement).toBe(input);
    } finally {
      Reflect.deleteProperty(document, 'execCommand');
    }
  });
});

class BootstrapClient implements ContentBootstrapClient {
  readonly requests: Array<{ operationId: string; text: string; trigger: string }> = [];

  constructor(
    private readonly settings: ContentSettingsSnapshot | null,
    private readonly response: Awaited<ReturnType<ContentBootstrapClient['transform']>>
  ) {}

  async cancel(): Promise<void> {}

  async getSettings(): Promise<ContentSettingsSnapshot | null> {
    return this.settings;
  }

  async transform(operationId: string, text: string, trigger: string) {
    this.requests.push({ operationId, text, trigger });
    return this.response;
  }
}

function defaultSettings(): ContentSettingsSnapshot {
  return toContentSettingsSnapshot(createDefaultAppSettings());
}

function getHost(): HTMLDivElement {
  const host = document.querySelector(`[${TYNLY_UI_HOST_ATTRIBUTE}]`);
  if (!(host instanceof HTMLDivElement)) {
    throw new Error('Expected Tynly UI host.');
  }
  return host;
}

function createTestUiHost(): TynlyUiHost {
  return new TynlyUiHost(document, {
    isTrustedEvent: () => true,
    shadowMode: 'open'
  });
}

function click(element: Element | null | undefined): void {
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error('Expected a button.');
  }
  element.click();
}

function clickNamed(root: ParentNode | null | undefined, text: string): void {
  const button = Array.from(root?.querySelectorAll('button') ?? []).find(
    (candidate) => candidate.textContent === text
  );
  click(button);
}

function mockRect(element: Element): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ bottom: 80, height: 40, left: 20, right: 180, top: 40, width: 160 })
  });
}

function setSelection(startNode: Node, start: number, endNode: Node, end: number): void {
  const range = document.createRange();
  range.setStart(startNode, start);
  range.setEnd(endNode, end);
  const selection = document.getSelection() ?? fail('expected selection');
  selection.removeAllRanges();
  selection.addRange(range);
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function fail(message: string): never {
  throw new Error(message);
}
