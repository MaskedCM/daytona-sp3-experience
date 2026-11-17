import assert from 'node:assert/strict';
import {readFile, stat, readdir} from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const base = process.env.VITE_BASE_PATH || '/';
assert.ok(base.startsWith('/') && base.endsWith('/'), 'Base must start and end with /');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const resources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(match => match[1])
  .filter(url => !url.startsWith('https://') && !url.startsWith('#'));
assert.ok(resources.some(url => url.endsWith('.js')), 'Built entry script is required');
for (const url of resources) {
  assert.ok(url.startsWith(base), `Resource is outside deployment base: ${url}`);
  const local = path.resolve(root, decodeURIComponent(url.slice(base.length)));
  assert.ok(local.startsWith(root + path.sep), 'Resource must remain inside dist');
  assert.ok((await stat(local)).size > 0, `Missing/empty production resource: ${url}`);
}
const model = await readFile(path.join(root, 'models/daytona-sp3-web.glb'));
assert.equal(model.readUInt32LE(0), 0x46546c67, 'GLB signature');
assert.equal(model.readUInt32LE(4), 2, 'glTF 2.0 model');
const hdr = await readFile(path.join(root, 'environments/studio-small-09-2k.hdr'));
assert.match(hdr.subarray(0, 16).toString(), /^#\?(?:RADIANCE|RGBE)/, 'HDR environment header');
await stat(path.join(root, 'assets/aistudio/daytona-sp3-preview_bcec83a0.jpg'));
await stat(path.join(root, 'social-preview.jpg'));
await stat(path.join(root, 'ASSET-LICENSES.md'));
await stat(path.join(root, '.nojekyll'));

let totalBytes = 0;
for (const file of await readdir(root, {recursive: true, withFileTypes: true})) {
  if (!file.isFile()) continue;
  const absolute = path.join(file.parentPath, file.name);
  const info = await stat(absolute);
  totalBytes += info.size;
  assert.ok(info.size < 100_000_000, `Oversized deployment file: ${file.name}`);
  assert.ok(!file.name.startsWith('.env'), 'Environment files must not be published');
  if (/\.(?:html|css|js)$/.test(file.name)) {
    const text = await readFile(absolute, 'utf8');
    assert.ok(!text.includes('https://fonts.googleapis.com'), 'Fonts must be self-hosted');
    assert.ok(!text.includes('https://www.gstatic.com/draco/'), 'Decoder must not depend on a CDN');
  }
}
assert.ok(totalBytes < 1_000_000_000, 'Pages site must stay below 1 GB');
console.log(`Production artifact verified at ${base}: ${resources.length} entry resources, valid GLB/HDR, credits, self-hosted fonts; ${(totalBytes / 1_000_000).toFixed(1)} MB total.`);
