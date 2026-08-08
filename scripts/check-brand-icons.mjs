import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sizes = [16, 32, 48, 128];
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

for (const size of sizes) {
  const iconPath = resolve(projectRoot, 'public/icons', 'icon-' + size + '.png');
  const image = await readFile(iconPath);

  if (!image.subarray(0, 8).equals(pngSignature)) {
    throw new Error(iconPath + ' is not a PNG file.');
  }

  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);

  if (width !== size || height !== size) {
    throw new Error(iconPath + ' must be ' + size + ' by ' + size + ' pixels.');
  }
}

console.log('Tynly manifest icons are valid.');
