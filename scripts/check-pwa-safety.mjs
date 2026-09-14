import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const forbidden = [
  ['fetch handler', /addEventListener\s*\(\s*['"]fetch['"]/i],
  ['Cache Storage', /\bcaches\s*\./i],
  ['IndexedDB', /\bindexedDB\s*\./i],
  ['application API path', /\/api\//i],
  ['push handler', /addEventListener\s*\(\s*['"]push['"]/i],
  ['notification click handler', /addEventListener\s*\(\s*['"]notificationclick['"]/i],
  ['background sync handler', /addEventListener\s*\(\s*['"](?:periodic)?sync['"]/i],
];

export function findPwaSafetyViolations(source) {
  return forbidden.filter(([, pattern]) => pattern.test(source)).map(([label]) => label);
}

async function main() {
  const workerIndex = process.argv.indexOf('--worker');
  const workerPath = resolve(
    workerIndex >= 0 && process.argv[workerIndex + 1]
      ? process.argv[workerIndex + 1]
      : 'apps/web/public/sw.js',
  );
  const source = await readFile(workerPath, 'utf8');
  const violations = findPwaSafetyViolations(source);

  if (violations.length) {
    console.error(`PWA worker safety check failed: ${violations.join(', ')}.`);
    process.exitCode = 1;
  } else {
    console.log('PASS: PWA worker has lifecycle behavior only and no private-data capabilities.');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
