import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const sourcePath = resolve(projectRoot, 'assets/brand/tynly-mark.svg');
const outputDirectory = resolve(projectRoot, 'public/icons');
const sizes = [16, 32, 48, 128];

const svg = await readFile(sourcePath);

await mkdir(outputDirectory, { recursive: true });

for (const size of sizes) {
  const renderer = new Resvg(svg, {
    background: 'rgba(0, 0, 0, 0)',
    fitTo: {
      mode: 'width',
      value: size
    }
  });

  await writeFile(resolve(outputDirectory, 'icon-' + size + '.png'), renderer.render().asPng());
}
