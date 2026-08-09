import type { Page } from '@playwright/test';

import { MOCK_TRANSFORM_RESULT } from './mock-provider.ts';
import { expect, test } from './fixtures.ts';

test('configures a local provider and safely exercises all transform triggers', async ({
  extension,
  mockProvider
}) => {
  const settings = await extension.context.newPage();
  await settings.goto(extension.settingsUrl);

  await settings.getByLabel('Add provider').selectOption('ollama');
  await settings.getByRole('button', { name: 'Add provider' }).click();
  await settings.getByLabel('Base URL').fill(mockProvider.baseUrl);
  await settings.getByLabel('Model ID').fill('tynly-mock');
  await settings.getByRole('button', { name: 'Save provider' }).click();
  await expect(settings.getByText('Provider saved.').first()).toBeVisible();

  await settings.getByRole('button', { name: 'Refresh models' }).click();
  await expect(settings.getByText('Loaded 1 model.').first()).toBeVisible();
  await settings.getByRole('button', { name: 'Test connection' }).click();
  await expect(settings.getByText('Connection successful.').first()).toBeVisible();

  const popup = await extension.context.newPage();
  await popup.goto(extension.popupUrl);
  await expect(popup.getByText('Ollama · tynly-mock')).toBeVisible();

  const page = await extension.context.newPage();
  await page.goto(mockProvider.fixtureUrl);
  const message = page.locator('#message');
  const uiHost = page.locator('[data-tynly-ui-host]');
  await message.focus();
  await expect(uiHost).toBeVisible();
  expect(await uiHost.evaluate((element) => element.shadowRoot)).toBeNull();
  const requestCountBeforeSyntheticShortcut = mockProvider.requests.length;
  const syntheticShortcutDispatched = await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', {
      altKey: true,
      bubbles: true,
      cancelable: true,
      code: 'KeyA'
    });
    return document.dispatchEvent(event);
  });
  expect(syntheticShortcutDispatched).toBe(true);
  await page.waitForTimeout(100);
  expect(mockProvider.requests).toHaveLength(requestCountBeforeSyntheticShortcut);

  await page.locator('#secret').focus();
  await pressDefaultShortcut(page);
  await expect.poll(() => mockProvider.requests.length).toBe(2);
  await expect(page.locator('#secret')).toHaveValue('do-not-send');

  await message.focus();
  await clickTynlyButton(page, 'Transform with Tynly');
  await expect(message).toHaveValue(MOCK_TRANSFORM_RESULT);

  await clickTynlyButton(page, 'Undo');
  await expect(message).toHaveValue('A draft message.');

  await message.focus();
  await pressDefaultShortcut(page);
  await expect(message).toHaveValue(MOCK_TRANSFORM_RESULT);
  await clickTynlyButton(page, 'Undo');
  await expect(message).toHaveValue('A draft message.');

  const originalPageText = 'A normal webpage selection.';
  await page.locator('#page-text').evaluate((element) => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await clickTynlyButton(page, 'Transform selected text with Tynly');
  await expect.poll(() => mockProvider.requests.length).toBe(5);
  await expect(page.locator('#page-text')).toHaveText(originalPageText);

  expect(mockProvider.requests.map((request) => request.path)).toEqual([
    '/api/tags',
    '/api/chat',
    '/api/chat',
    '/api/chat',
    '/api/chat'
  ]);
  expect(JSON.stringify(mockProvider.requests)).not.toContain('do-not-send');
});

async function clickTynlyButton(page: Page, name: string): Promise<void> {
  await expect.poll(() => getTynlyButtonCenter(page, name)).not.toBeNull();
  const center = await getTynlyButtonCenter(page, name);
  if (center === null) {
    throw new Error(`Tynly button ${name} is not available.`);
  }

  await page.mouse.click(center.x, center.y);
}

async function pressDefaultShortcut(page: Page): Promise<void> {
  await page.keyboard.down('Alt');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Alt');
}

async function getTynlyButtonCenter(
  page: Page,
  name: string
): Promise<{ readonly x: number; readonly y: number } | null> {
  const session = await page.context().newCDPSession(page);
  try {
    const tree = (await session.send('Accessibility.getFullAXTree')) as AccessibilityTree;
    const button = tree.nodes.find(
      (node) =>
        node.backendDOMNodeId !== undefined &&
        node.ignored !== true &&
        node.name?.value === name &&
        node.role?.value === 'button'
    );
    if (button?.backendDOMNodeId === undefined) {
      return null;
    }

    const response = (await session.send('DOM.getBoxModel', {
      backendNodeId: button.backendDOMNodeId
    })) as BoxModelResponse;
    const content = response.model.content;
    if (content.length !== 8) {
      return null;
    }
    const [
      topLeftX,
      topLeftY,
      topRightX,
      topRightY,
      bottomRightX,
      bottomRightY,
      bottomLeftX,
      bottomLeftY
    ] = content;
    if (
      topLeftX === undefined ||
      topLeftY === undefined ||
      topRightX === undefined ||
      topRightY === undefined ||
      bottomRightX === undefined ||
      bottomRightY === undefined ||
      bottomLeftX === undefined ||
      bottomLeftY === undefined
    ) {
      return null;
    }

    return {
      x: (topLeftX + topRightX + bottomRightX + bottomLeftX) / 4,
      y: (topLeftY + topRightY + bottomRightY + bottomLeftY) / 4
    };
  } finally {
    await session.detach();
  }
}

interface AccessibilityNode {
  readonly backendDOMNodeId?: number;
  readonly ignored?: boolean;
  readonly name?: { readonly value?: string };
  readonly role?: { readonly value?: string };
}

interface AccessibilityTree {
  readonly nodes: readonly AccessibilityNode[];
}

interface BoxModelResponse {
  readonly model: { readonly content: readonly number[] };
}
