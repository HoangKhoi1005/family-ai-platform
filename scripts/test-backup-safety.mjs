import assert from 'node:assert/strict';
import test from 'node:test';
import { assertBackupSafety, readBackupFiles } from './check-backup-safety.mjs';

const safeBackup = `#!/bin/sh
set -eu
plain="/work/backup.dump"
encrypted="\${plain}.age"
cleanup() { rm -f "$plain" "$encrypted"; }
trap cleanup EXIT INT TERM
pg_dump --format=custom --no-owner --file="$plain"
age --recipient "$BACKUP_AGE_RECIPIENT" --output "$encrypted" "$plain"
aws s3 cp "$encrypted" "s3://bucket/backup.dump.age" --only-show-errors
printf '%s\\n' 'BACKUP_COMPLETED'
`;

const safeRestore = `#!/bin/sh
set -eu
[ "$APP_ENV" = staging ]
case "$RESTORE_DATABASE" in *_restore_drill) ;; *) exit 1;; esac
[ "$RESTORE_DATABASE" != "$PGDATABASE" ]
cleanup() { rm -f /work/backup.dump /work/backup.dump.age; }
trap cleanup EXIT INT TERM
aws s3 cp "s3://bucket/$BACKUP_OBJECT_KEY" /work/backup.dump.age --only-show-errors
age --decrypt --output /work/backup.dump /work/backup.dump.age
pg_restore --no-owner --dbname="$RESTORE_DATABASE" /work/backup.dump
printf '%s\\n' 'RESTORE_DRILL_COMPLETED'
`;

const safeDockerfile = `FROM postgres:17-alpine
RUN apk add --no-cache age aws-cli ca-certificates
USER postgres
`;

const retention = 'Encrypted backup objects are retained for 30 days, then deleted.';

function safeFiles() {
  return {
    backup: safeBackup,
    restore: safeRestore,
    dockerfile: safeDockerfile,
    retention,
  };
}

test('accepts the committed encrypted backup package', async () => {
  const files = await readBackupFiles();
  assert.doesNotThrow(() => assertBackupSafety(files));
});

test('rejects shell tracing, environment output, and URL command arguments', () => {
  for (const mutation of [
    (files) => (files.backup += '\nset -x\n'),
    (files) => (files.backup += '\necho "$PGPASSWORD"\n'),
    (files) => (files.backup += '\npg_dump "$DATABASE_URL"\n'),
  ]) {
    const files = safeFiles();
    mutation(files);
    assert.throws(() => assertBackupSafety(files));
  }
});

test('rejects unsafe restore targets and unencrypted uploads', () => {
  const liveTarget = safeFiles();
  liveTarget.restore = liveTarget.restore.replace(
    '--dbname="$RESTORE_DATABASE"',
    '--dbname="$PGDATABASE"',
  );
  assert.throws(() => assertBackupSafety(liveTarget), /RESTORE_DATABASE/);

  const missingSuffix = safeFiles();
  missingSuffix.restore = missingSuffix.restore.replace('_restore_drill', '_restored');
  assert.throws(() => assertBackupSafety(missingSuffix), /_restore_drill/);

  const plainUpload = safeFiles();
  plainUpload.backup = plainUpload.backup.replace('s3 cp "$encrypted"', 's3 cp "$plain"');
  assert.throws(() => assertBackupSafety(plainUpload), /encrypted/i);
});

test('requires cleanup traps and documented 30-day retention', () => {
  const noTrap = safeFiles();
  noTrap.backup = noTrap.backup.replace('trap cleanup EXIT INT TERM', '');
  assert.throws(() => assertBackupSafety(noTrap), /cleanup trap/i);

  const noRetention = safeFiles();
  noRetention.retention = '';
  assert.throws(() => assertBackupSafety(noRetention), /30-day retention/i);
});
