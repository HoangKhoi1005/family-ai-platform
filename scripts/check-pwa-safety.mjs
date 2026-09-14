import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const workerIndex = process.argv.indexOf('--worker');
const workerPath = resolve(
  workerIndex >= 0 && process.argv[workerIndex + 1]
    ? process.argv[workerIndex + 1]
    : 'apps/web/public/sw.js',
);
const source = await readFile(workerPath, 'utf8');

const forbidden = [
  ['fetch handler', /addEventListener\s*\(\s*['"]fetch['"]/i],
  ['Cache Storage', /\bcaches\s*\./i],
  ['IndexedDB', /\bindexedDB\s*\./i],
  ['application API path', /\/api\//i],
  ['push handler', /addEventListener\s*\(\s*['"]push['"]/i],
  ['notification click handler', /addEventListener\s*\(\s*['"]notificationclick['"]/i],
  ['background sync handler', /addEventListener\s*\(\s*['"](?:periodic)?sync['"]/i],
];

const violations = forbidden.filter(([, pattern]) => pattern.test(source)).map(([label]) => label);
if (violations.length) {
  console.error(`PWA worker safety check failed: ${violations.join(', ')}.`);
  process.exitCode = 1;
} else {
  console.log('PASS: PWA worker has lifecycle behavior only and no private-data capabilities.');
}
