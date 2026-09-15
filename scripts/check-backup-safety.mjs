import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function assertBackupSafety({ backup, restore, dockerfile, retention }) {
  const errors = [];
  const scripts = `${backup}\n${restore}`;

  if (/\bset\s+-[^\n]*x/.test(scripts)) errors.push('Shell tracing with set -x is forbidden');
  if (/\becho\b[^\n]*\$[A-Z_]/.test(scripts)) {
    errors.push('Environment values must not be echoed');
  }
  if (/DATABASE_URL/.test(scripts)) {
    errors.push('DATABASE_URL must not appear in backup command arguments');
  }
  if (!/trap cleanup EXIT INT TERM/.test(backup) || !/trap cleanup EXIT INT TERM/.test(restore)) {
    errors.push('Backup and restore require a cleanup trap');
  }
  if (!/s3 cp[\s\\]*"\$encrypted"/.test(backup) || !/\.age/.test(backup)) {
    errors.push('Only the encrypted .age backup may be uploaded');
  }

  if (!/\[ "\$(?:\{APP_ENV:-\}|APP_ENV)" = staging \]/.test(restore)) {
    errors.push('Restore drill must require APP_ENV=staging');
  }
  if (!/_restore_drill/.test(restore)) {
    errors.push('RESTORE_DATABASE must end with _restore_drill');
  }
  if (!/\[ "\$RESTORE_DATABASE" != "\$PGDATABASE" \]/.test(restore)) {
    errors.push('RESTORE_DATABASE must differ from PGDATABASE');
  }
  if (
    /pg_restore[^\n]*PGDATABASE/.test(restore) ||
    !/pg_restore[^\n]*RESTORE_DATABASE/.test(restore)
  ) {
    errors.push('pg_restore must target RESTORE_DATABASE only');
  }

  if (!/^USER postgres\s*$/m.test(dockerfile) || /^USER root\s*$/m.test(dockerfile)) {
    errors.push('Backup runtime must use the non-root postgres user');
  }
  if (!/\b30(?:-day| days)\b/i.test(retention)) {
    errors.push('Backup package must document 30-day retention');
  }

  if (errors.length > 0) throw new Error(errors.join('; '));
}

export async function readBackupFiles(rootDirectory) {
  const repositoryRoot = rootDirectory ?? resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const [backup, restore, dockerfile, retention] = await Promise.all([
    readFile(resolve(repositoryRoot, 'deploy/scripts/backup-postgres.sh'), 'utf8'),
    readFile(resolve(repositoryRoot, 'deploy/scripts/restore-postgres.sh'), 'utf8'),
    readFile(resolve(repositoryRoot, 'deploy/backup/Dockerfile'), 'utf8'),
    readFile(resolve(repositoryRoot, 'deploy/backup/README.md'), 'utf8'),
  ]);
  return { backup, restore, dockerfile, retention };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    assertBackupSafety(await readBackupFiles());
    console.log('Backup safety checks passed.');
  } catch (error) {
    console.error(
      `Backup safety check failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    process.exitCode = 1;
  }
}
