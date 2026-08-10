import { crx } from '@crxjs/vite-plugin';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

import manifest from './src/manifest.ts';

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  build: {
    outDir: 'dist',
    // Chromium assigns Vite's module-preload requests to a different extension world,
    // producing false-positive console warnings for popup and Settings pages. Native
    // ESM imports still load each chunk on demand without these speculative preloads.
    modulePreload: false,
    target: 'es2022',
    sourcemap: false
  }
});
