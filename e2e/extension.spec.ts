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
  const fieldControl = page.locator(
    '[data-tynly-ui-host] button[aria-label="Transform with Tynly"]'
  );
  await message.focus();
  await expect(fieldControl).toBeVisible();
  await page.locator('#secret').focus();
  await expect(fieldControl).toBeHidden();
  await message.focus();
  await expect(fieldControl).toBeVisible();
  await fieldControl.click();
  await expect(message).toHaveValue(MOCK_TRANSFORM_RESULT);

  const undo = page.locator('[data-tynly-ui-host] button', { hasText: 'Undo' });
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(message).toHaveValue('A draft message.');

  await message.focus();
  await page.keyboard.down('Alt');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Alt');
  await expect(message).toHaveValue(MOCK_TRANSFORM_RESULT);
  await expect(undo).toBeVisible();
  await undo.click();
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
  const selectionControl = page.locator(
    '[data-tynly-ui-host] button[aria-label="Transform selected text with Tynly"]'
  );
  await expect(selectionControl).toBeVisible();
  await selectionControl.click();
  await expect(page.locator('[data-tynly-ui-host] [role="dialog"]')).toContainText(
    MOCK_TRANSFORM_RESULT
  );
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
