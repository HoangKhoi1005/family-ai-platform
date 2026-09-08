import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const initializer = fileURLToPath(new URL('./init-env.mjs', import.meta.url));
async function runCase(original, expectedStatus) {
  const directory = await mkdtemp(join(tmpdir(), 'family-ai-env-init-'));
  const envFile = join(directory, '.env');
  try {
    await writeFile(envFile, original, 'utf8');
    const first = spawnSync(process.execPath, [initializer], {
      cwd: directory,
      encoding: 'utf8',
    });
    assert.equal(first.status, expectedStatus, `${first.stdout}\n${first.stderr}`);
    assert.doesNotMatch(
      `${first.stdout}\n${first.stderr}`,
      /owner-secret-for-test/,
      'Initializer output must not expose existing credentials',
    );
    return { directory, envFile, first };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

const passwordlessWithSeparatePassword =
  'DATABASE_URL=postgresql://family_owner@127.0.0.1:54339/family_dev\n' +
  'POSTGRES_PASSWORD=owner-secret-for-test\n' +
  '# preserve this comment without a trailing newline';
const passwordlessWithoutSeparatePassword =
  'DATABASE_URL=postgresql://family_owner@127.0.0.1:54339/family_dev\n' +
  '# preserve this comment without a trailing newline';
for (const original of [passwordlessWithSeparatePassword, passwordlessWithoutSeparatePassword]) {
  const { directory, envFile } = await runCase(original, 1);
  try {
    assert.equal(
      await readFile(envFile, 'utf8'),
      original,
      'Rejected passwordless DATABASE_URL must not modify .env',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const fullUrl =
  'DATABASE_URL=postgresql://family_owner:owner-secret-for-test@127.0.0.1:54339/family_dev\n' +
  '# preserve this comment without a trailing newline';
const { directory, envFile } = await runCase(fullUrl, 0);
try {
  const firstBytes = await readFile(envFile, 'utf8');
  assert.ok(firstBytes.startsWith(fullUrl), 'Existing .env bytes must remain unchanged');
  assert.match(
    firstBytes,
    /^DATABASE_URL=postgresql:\/\/family_owner:owner-secret-for-test@127\.0\.0\.1:54339\/family_dev$/m,
    'Full DATABASE_URL must remain unchanged',
  );

  const second = spawnSync(process.execPath, [initializer], {
    cwd: directory,
    encoding: 'utf8',
  });
  assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);
  assert.equal(await readFile(envFile, 'utf8'), firstBytes, 'Initializer must be byte-idempotent');
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log(
  'PASS: passwordless DATABASE_URL is rejected without writes; full local env is byte-idempotent.',
);
