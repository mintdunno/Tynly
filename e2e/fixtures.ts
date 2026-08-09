import { expect, chromium, test as base, type BrowserContext } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { startMockProvider, type MockProvider } from './mock-provider.ts';

export interface LoadedExtension {
  readonly context: BrowserContext;
  readonly extensionId: string;
  readonly popupUrl: string;
  readonly settingsUrl: string;
}

export const test = base.extend<{
  readonly extension: LoadedExtension;
  readonly mockProvider: MockProvider;
}>({
  mockProvider: async ({}, provide) => {
    const provider = await startMockProvider();
    try {
      await provide(provider);
    } finally {
      await provider.close();
    }
  },
  extension: async ({}, provide) => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'tynly-e2e-'));
    const extensionPath = resolve(process.cwd(), 'dist');
    const context = await chromium.launchPersistentContext(userDataDir, {
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
      channel: 'chromium',
      headless: false
    });

    try {
      const worker =
        context.serviceWorkers()[0] ??
        (await context.waitForEvent('serviceworker', { timeout: 10_000 }));
      const extensionId = new URL(worker.url()).hostname;
      await provide({
        context,
        extensionId,
        popupUrl: `chrome-extension://${extensionId}/src/ui/popup/index.html`,
        settingsUrl: `chrome-extension://${extensionId}/src/ui/settings/index.html`
      });
    } finally {
      await context.close();
      await rm(userDataDir, { force: true, maxRetries: 3, recursive: true });
    }
  }
});

export { expect };
