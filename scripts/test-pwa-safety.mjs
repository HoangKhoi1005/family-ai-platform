import assert from 'node:assert/strict';
import { findPwaSafetyViolations } from './check-pwa-safety.mjs';

const safe =
  "self.addEventListener('install', () => self.skipWaiting());\n" +
  "self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));\n";
assert.deepEqual(findPwaSafetyViolations(safe), []);

for (const [name, source] of [
  ['fetch', "self.addEventListener('fetch', () => {});"],
  ['cache', "caches.open('family-data');"],
  ['indexed-db', "indexedDB.open('family');"],
  ['api', "const endpoint = '/api/v1/me';"],
  ['push', "self.addEventListener('push', () => {});"],
  ['sync', "self.addEventListener('sync', () => {});"],
]) {
  assert.notEqual(findPwaSafetyViolations(source).length, 0, `${name} worker should be rejected`);
}

console.log('PASS: PWA worker safety checker rejects private-data capabilities.');
