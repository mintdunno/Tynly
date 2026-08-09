import { resolve } from 'node:path';
import { build } from 'vite';

/** Builds the exact unpacked extension directory that browser tests load. */
export default async function buildExtensionForBrowserTests(): Promise<void> {
  await build({
    configFile: resolve(process.cwd(), 'vite.config.ts')
  });
}
