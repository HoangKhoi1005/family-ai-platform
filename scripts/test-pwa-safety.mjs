import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const checker = join(root, 'scripts', 'check-pwa-safety.mjs');
const directory = await mkdtemp(join(tmpdir(), 'family-pwa-safety-'));

try {
  const safe = join(directory, 'safe.js');
  await writeFile(
    safe,
    "self.addEventListener('install', () => self.skipWaiting());\n" +
      "self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));\n",
  );
  const safeResult = spawnSync(process.execPath, [checker, '--worker', safe], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(safeResult.status, 0, safeResult.stderr || safeResult.stdout);

  for (const [name, source] of [
    ['fetch', "self.addEventListener('fetch', () => {});"],
    ['cache', "caches.open('family-data');"],
    ['indexed-db', "indexedDB.open('family');"],
    ['api', "const endpoint = '/api/v1/me';"],
    ['push', "self.addEventListener('push', () => {});"],
    ['sync', "self.addEventListener('sync', () => {});"],
  ]) {
    const unsafe = join(directory, `${name}.js`);
    await writeFile(unsafe, source);
    const result = spawnSync(process.execPath, [checker, '--worker', unsafe], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, `${name} worker should be rejected`);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log('PASS: PWA worker safety checker rejects private-data capabilities.');
