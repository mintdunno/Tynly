import type { Page } from '@playwright/test';

import { MOCK_TRANSFORM_RESULT } from './mock-provider.ts';
import { expect, test } from './fixtures.ts';

test('keeps normal hosted-provider setup focused and unactivated until it is tested', async ({
  extension
}) => {
  const settings = await extension.context.newPage();
  await settings.goto(extension.settingsUrl);

  await settings.getByRole('button', { name: 'Choose a provider' }).click();
  await expect(settings.getByRole('radiogroup', { name: 'Provider categories' })).toBeVisible();
  await expect(settings.getByRole('radio', { name: 'Recommended' })).toBeChecked();
  await settings.getByPlaceholder('Search providers').fill('direct API');
  await settings.locator('.provider-catalog-card').filter({ hasText: 'OpenAI' }).click();
  await settings.getByRole('button', { name: 'Continue with OpenAI' }).click();

  await expect(settings.getByLabel('API key')).toBeFocused();
  await expect(settings.getByLabel('Base URL')).not.toBeVisible();
  await settings.getByLabel('API key').fill('test-key');
  await settings.getByLabel('Model ID').fill('test-model');
  await settings.getByRole('button', { name: 'Save without testing' }).click();

  await expect(settings.getByRole('button', { name: 'Use this provider' })).toBeVisible();
  await expect(settings.locator('.provider-editor-state')).toHaveCount(0);
  await expect(settings.getByText('Ready to test').first()).toBeVisible();
});

test('configures a local provider and safely exercises all transform triggers', async ({
  extension,
  mockProvider
}) => {
  const settings = await extension.context.newPage();
  await settings.goto(extension.settingsUrl);

  await settings.getByRole('button', { name: 'Choose a provider' }).click();
  await settings.getByRole('button', { name: 'Close provider picker' }).click();
  await expect(settings.getByRole('button', { name: 'Choose a provider' })).toBeFocused();

  await settings.getByRole('button', { name: 'Choose a provider' }).click();
  await settings.locator('.provider-catalog-card').filter({ hasText: 'Ollama' }).click();
  await settings.getByRole('button', { name: 'Continue with Ollama' }).click();
  await expect(settings.getByLabel('Model ID')).toBeFocused();
  await settings.getByLabel('Model ID').fill('tynly-mock');
  await settings.locator('summary').filter({ hasText: 'Advanced connection' }).click();
  await settings.getByLabel('Base URL').fill(mockProvider.baseUrl);
  await settings.getByRole('button', { name: 'Save & test' }).click();
  await expect(
    settings.getByText('Connected — this provider is now active.').first()
  ).toBeVisible();

  await addKeyboardShortcut(settings, 'KeyK');
  await expect(settings.getByText('Alt + K').first()).toBeVisible();

  await settings.getByRole('button', { name: 'Refresh models' }).click();
  await expect(settings.getByText('Loaded 1 model.').first()).toBeVisible();

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
  await pressShortcut(page, 'KeyK');
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
    '/api/chat',
    '/api/tags',
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
  await pressShortcut(page, 'KeyA');
}

async function addKeyboardShortcut(page: Page, code: string): Promise<void> {
  await page.getByRole('button', { name: 'Add keyboard shortcut' }).click();
  await pressShortcut(page, code);
}

async function pressShortcut(page: Page, code: string): Promise<void> {
  await page.keyboard.down('Alt');
  await page.keyboard.press(code);
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
