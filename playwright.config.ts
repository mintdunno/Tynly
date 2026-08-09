import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  reporter: 'list',
  retries: process.env.CI === 'true' ? 1 : 0,
  workers: 1,
  outputDir: 'test-results'
});
