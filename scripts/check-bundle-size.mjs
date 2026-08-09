import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distDirectory = resolve(projectRoot, 'dist');

const BYTE_LIMITS = {
  content: 75 * 1024,
  popup: 80 * 1024,
  serviceWorker: 80 * 1024,
  settings: 110 * 1024,
  total: 250 * 1024
};

const manifest = await readJson(resolve(distDirectory, 'manifest.json'));
const contentRoots = getContentScriptRoots(manifest);
const serviceWorkerRoot = getRequiredString(
  getRecord(manifest.background, 'manifest.background').service_worker,
  'manifest.background.service_worker'
);
const popupRoot = getRequiredString(
  getRecord(manifest.action, 'manifest.action').default_popup,
  'manifest.action.default_popup'
);
const settingsRoot = getRequiredString(
  getRecord(manifest.options_ui, 'manifest.options_ui').page,
  'manifest.options_ui.page'
);

const content = await inspectJavaScriptGroup('Content scripts', contentRoots);
const serviceWorker = await inspectJavaScriptGroup('Service worker', [serviceWorkerRoot]);
const popup = await inspectHtmlGroup('Popup page', popupRoot);
const settings = await inspectHtmlGroup('Settings page', settingsRoot);
const total = await getDirectorySize(distDirectory);

assertSize(content, BYTE_LIMITS.content);
assertSize(serviceWorker, BYTE_LIMITS.serviceWorker);
assertSize(popup, BYTE_LIMITS.popup);
assertSize(settings, BYTE_LIMITS.settings);
assertTotalSize(total, BYTE_LIMITS.total);
assertContentIsolated(content, popup, settings);

console.log('Tynly production bundle audit passed.');
printGroup(content, BYTE_LIMITS.content);
printGroup(serviceWorker, BYTE_LIMITS.serviceWorker);
printGroup(popup, BYTE_LIMITS.popup);
printGroup(settings, BYTE_LIMITS.settings);
console.log(
  `  Total unpacked extension: ${formatBytes(total)} (limit ${formatBytes(BYTE_LIMITS.total)})`
);
console.log('  Content graph excludes popup/settings entry chunks and the Preact JSX runtime.');

/**
 * @param {string} label
 * @param {string[]} roots
 */
async function inspectJavaScriptGroup(label, roots) {
  const assets = await collectAssetGraph(
    roots.map((root) => resolveDistAsset(distDirectory, root))
  );
  return createGroup(label, assets);
}

/**
 * @param {string} label
 * @param {string} root
 */
async function inspectHtmlGroup(label, root) {
  const htmlPath = resolveDistAsset(distDirectory, root);
  const html = await readUtf8(htmlPath);
  const dependencies = extractHtmlDependencies(html).map((dependency) =>
    resolveDistAsset(distDirectory, dependency)
  );
  const entryAssets = extractHtmlEntryAssets(html).map((dependency) =>
    resolveDistAsset(distDirectory, dependency)
  );
  const assets = await collectAssetGraph(dependencies);
  assets.add(htmlPath);
  return createGroup(label, assets, entryAssets);
}

/**
 * @param {string[]} roots
 */
async function collectAssetGraph(roots) {
  const assets = new Set();
  const pending = [...roots];

  while (pending.length > 0) {
    const asset = pending.pop();
    if (asset === undefined || assets.has(asset)) {
      continue;
    }

    await assertFile(asset);
    assets.add(asset);

    if (!asset.endsWith('.js') && !asset.endsWith('.mjs')) {
      continue;
    }

    const source = await readUtf8(asset);
    for (const dependency of extractJavaScriptDependencies(source)) {
      pending.push(resolveJavaScriptDependency(asset, dependency));
    }
  }

  return assets;
}

/**
 * @param {string} source
 */
function extractHtmlDependencies(source) {
  const dependencies = new Set();
  const assetTagPattern = /<(?:link|script)\b([^>]*)>/giu;

  for (const match of source.matchAll(assetTagPattern)) {
    const attributes = match[1];
    const dependency = attributes?.match(/\b(?:href|src)=["']([^"']+)["']/iu)?.[1];
    if (dependency !== undefined && isLocalAssetReference(dependency)) {
      dependencies.add(dependency);
    }
  }

  return [...dependencies];
}

/**
 * @param {string} source
 */
function extractHtmlEntryAssets(source) {
  const entries = new Set();
  const scriptPattern = /<script\b([^>]*)>/giu;

  for (const match of source.matchAll(scriptPattern)) {
    const attributes = match[1];
    const sourceMatch = attributes?.match(/\bsrc=["']([^"']+)["']/iu);
    if (sourceMatch?.[1] !== undefined && isLocalAssetReference(sourceMatch[1])) {
      entries.add(sourceMatch[1]);
    }
  }

  return [...entries];
}

/**
 * @param {string} source
 */
function extractJavaScriptDependencies(source) {
  const dependencies = new Set();
  const patterns = [
    /\bimport\s*(?:[\w*${},\s]*?from\s*)?["']([^"']+)["']/giu,
    /\bexport\s*(?:[\w*${},\s]*?from\s*)["']([^"']+)["']/giu,
    /\bimport\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)?["']([^"']+)["']\s*\)/giu,
    /chrome\.runtime\.getURL\(\s*["']([^"']+)["']\s*\)/giu
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const dependency = match[1];
      if (dependency !== undefined && isLocalAssetReference(dependency)) {
        dependencies.add(dependency);
      }
    }
  }

  return [...dependencies];
}

/**
 * @param {string} fromAsset
 * @param {string} dependency
 */
function resolveJavaScriptDependency(fromAsset, dependency) {
  if (dependency.startsWith('./') || dependency.startsWith('../')) {
    return resolveInsideDist(resolve(dirname(fromAsset), removeUrlSuffix(dependency)));
  }

  return resolveDistAsset(distDirectory, dependency);
}

/**
 * @param {string} directory
 * @param {string} asset
 */
function resolveDistAsset(directory, asset) {
  const normalized = removeUrlSuffix(asset).replace(/^\/+/, '');
  return resolveInsideDist(resolve(directory, normalized));
}

/**
 * @param {string} candidate
 */
function resolveInsideDist(candidate) {
  const pathFromDist = relative(distDirectory, candidate);
  if (pathFromDist === '' || pathFromDist.startsWith(`..${sep}`) || pathFromDist === '..') {
    throw new Error(`Bundle dependency resolves outside dist: ${candidate}`);
  }

  return candidate;
}

/**
 * @param {string} reference
 */
function isLocalAssetReference(reference) {
  return !/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/iu.test(reference);
}

/**
 * @param {string} value
 */
function removeUrlSuffix(value) {
  return value.split(/[?#]/u, 1)[0] ?? value;
}

/**
 * @param {string} label
 * @param {Set<string>} assets
 * @param {string[]} [entryAssets]
 */
async function createGroup(label, assets, entryAssets = []) {
  let bytes = 0;
  for (const asset of assets) {
    bytes += (await stat(asset)).size;
  }

  return { assets, bytes, entryAssets, label };
}

/**
 * @param {{ label: string; bytes: number }} group
 * @param {number} limit
 */
function assertSize(group, limit) {
  if (group.bytes > limit) {
    throw new Error(
      `${group.label} is ${formatBytes(group.bytes)}; limit is ${formatBytes(limit)}.`
    );
  }
}

/**
 * @param {number} bytes
 * @param {number} limit
 */
function assertTotalSize(bytes, limit) {
  if (bytes > limit) {
    throw new Error(`Unpacked extension is ${formatBytes(bytes)}; limit is ${formatBytes(limit)}.`);
  }
}

/**
 * @param {{ assets: Set<string> }} content
 * @param {{ assets: Set<string>; entryAssets: string[] }} popup
 * @param {{ assets: Set<string>; entryAssets: string[] }} settings
 */
function assertContentIsolated(content, popup, settings) {
  for (const pageEntry of [...popup.entryAssets, ...settings.entryAssets]) {
    if (content.assets.has(pageEntry)) {
      throw new Error(
        `Content graph includes a popup or settings entry asset: ${relative(distDirectory, pageEntry)}`
      );
    }
  }

  const preactRuntime = [...new Set([...popup.assets, ...settings.assets])].filter((asset) =>
    /jsxruntime(?:\.module)?-[\w-]+\.js$/iu.test(asset)
  );
  if (preactRuntime.length === 0) {
    throw new Error(
      'The expected Preact JSX runtime chunk was not found; review the bundle audit.'
    );
  }

  for (const runtime of preactRuntime) {
    if (content.assets.has(runtime)) {
      throw new Error(
        `Content graph includes the Preact JSX runtime: ${relative(distDirectory, runtime)}`
      );
    }
  }
}

/**
 * @param {{ label: string; bytes: number; assets: Set<string> }} group
 * @param {number} limit
 */
function printGroup(group, limit) {
  console.log(
    `  ${group.label}: ${formatBytes(group.bytes)} across ${group.assets.size} emitted assets (limit ${formatBytes(limit)})`
  );
}

/**
 * @param {string} directory
 */
async function getDirectorySize(directory) {
  let size = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      size += await getDirectorySize(path);
    } else if (entry.isFile()) {
      size += (await stat(path)).size;
    }
  }

  return size;
}

/**
 * @param {string} path
 */
async function readJson(path) {
  try {
    return JSON.parse(await readUtf8(path));
  } catch (error) {
    throw new Error(`Could not parse ${path}: ${errorMessage(error)}`);
  }
}

/**
 * @param {string} path
 */
async function readUtf8(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`Could not read ${path}: ${errorMessage(error)}`);
  }
}

/**
 * @param {string} path
 */
async function assertFile(path) {
  try {
    if (!(await stat(path)).isFile()) {
      throw new Error('not a file');
    }
  } catch (error) {
    throw new Error(`Expected emitted asset is missing: ${path} (${errorMessage(error)})`);
  }
}

/**
 * @param {unknown} value
 * @param {string} label
 */
function getRequiredString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} label
 */
function getRecord(value, label) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value;
}

/**
 * @param {unknown} manifestValue
 */
function getContentScriptRoots(manifestValue) {
  const manifestRecord = getRecord(manifestValue, 'manifest');
  if (
    !Array.isArray(manifestRecord.content_scripts) ||
    manifestRecord.content_scripts.length === 0
  ) {
    throw new Error('manifest.content_scripts must contain at least one entry.');
  }

  const roots = [];
  for (const [index, contentScript] of manifestRecord.content_scripts.entries()) {
    const script = getRecord(contentScript, `manifest.content_scripts[${index}]`);
    if (!Array.isArray(script.js) || script.js.length === 0) {
      throw new Error(`manifest.content_scripts[${index}].js must contain at least one asset.`);
    }

    for (const asset of script.js) {
      roots.push(getRequiredString(asset, `manifest.content_scripts[${index}].js`));
    }
  }

  return roots;
}

/**
 * @param {unknown} error
 */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {number} bytes
 */
function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
