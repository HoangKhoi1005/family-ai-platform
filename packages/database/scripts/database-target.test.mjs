import assert from 'node:assert/strict';
import test from 'node:test';
import * as databaseTarget from './database-target.mjs';

const { assertProvisioningEnvironment, parseDatabaseTarget } = databaseTarget;

const owner = parseDatabaseTarget(
  'DATABASE_URL',
  'postgresql://family_owner:owner-secret@postgres:5432/family_stage',
);
const roles = [
  parseDatabaseTarget(
    'AUTH_DATABASE_URL',
    'postgresql://family_auth:auth-secret@postgres:5432/family_stage',
    'family_auth',
  ),
  parseDatabaseTarget(
    'RUNTIME_DATABASE_URL',
    'postgresql://family_runtime:runtime-secret@postgres:5432/family_stage',
    'family_runtime',
  ),
  parseDatabaseTarget(
    'WORKER_DATABASE_URL',
    'postgresql://family_worker:worker-secret@postgres:5432/family_stage',
    'family_worker',
  ),
];

test('parses a credentialed PostgreSQL target without exposing its URL', () => {
  assert.deepEqual(
    parseDatabaseTarget(
      'AUTH_DATABASE_URL',
      'postgresql://family_auth:secret@127.0.0.1:54339/family_dev',
      'family_auth',
    ),
    {
      name: 'AUTH_DATABASE_URL',
      user: 'family_auth',
      host: '127.0.0.1',
      port: '54339',
      database: 'family_dev',
      password: 'secret',
    },
  );
});

test('allows an explicitly confirmed staging Docker database target', () => {
  assert.doesNotThrow(() =>
    assertProvisioningEnvironment(
      { APP_ENV: 'staging', ALLOW_STAGING_PROVISION: 'true' },
      owner,
      roles,
    ),
  );
});

test('allows loopback targets in local mode', () => {
  const localOwner = parseDatabaseTarget(
    'DATABASE_URL',
    'postgresql://owner:owner-secret@localhost:5432/family_dev',
  );
  const localRole = parseDatabaseTarget(
    'AUTH_DATABASE_URL',
    'postgresql://family_auth:auth-secret@localhost:5432/family_dev',
    'family_auth',
  );
  assert.doesNotThrow(() =>
    assertProvisioningEnvironment({ APP_ENV: 'local' }, localOwner, [localRole]),
  );
});

test('rejects production and staging without explicit confirmation', () => {
  assert.throws(
    () => assertProvisioningEnvironment({ APP_ENV: 'production' }, owner, roles),
    /staging provisioning refuses APP_ENV=production/,
  );
  assert.throws(
    () => assertProvisioningEnvironment({ APP_ENV: 'staging' }, owner, roles),
    /ALLOW_STAGING_PROVISION/,
  );
});

test('rejects incomplete targets and a mismatched role without echoing secrets', () => {
  for (const value of [
    'postgresql://family_auth@localhost:5432/family_dev',
    'postgresql://family_auth:do-not-print@localhost:5432',
  ]) {
    assert.throws(
      () => parseDatabaseTarget('AUTH_DATABASE_URL', value, 'family_auth'),
      (error) => error instanceof Error && !error.message.includes('do-not-print'),
    );
  }
  assert.throws(
    () =>
      parseDatabaseTarget(
        'AUTH_DATABASE_URL',
        'postgresql://wrong-role:do-not-print@localhost:5432/family_dev',
        'family_auth',
      ),
    /AUTH_DATABASE_URL must use the family_auth role/,
  );
});

test('rejects non-loopback local targets and mismatched staging targets', () => {
  assert.throws(
    () => assertProvisioningEnvironment({ APP_ENV: 'local' }, owner, roles),
    /loopback/,
  );
  const mismatched = parseDatabaseTarget(
    'WORKER_DATABASE_URL',
    'postgresql://family_worker:worker-secret@postgres:5432/other_database',
    'family_worker',
  );
  assert.throws(
    () =>
      assertProvisioningEnvironment(
        { APP_ENV: 'staging', ALLOW_STAGING_PROVISION: 'true' },
        owner,
        [...roles.slice(0, 2), mismatched],
      ),
    /WORKER_DATABASE_URL must target the same database as DATABASE_URL/,
  );
});

test('allows family bootstrap only for local loopback or explicitly confirmed staging postgres', () => {
  const local = parseDatabaseTarget(
    'DATABASE_URL',
    'postgresql://family_owner:owner-secret@127.0.0.1:54339/family_dev',
  );

  assert.doesNotThrow(() => databaseTarget.assertBootstrapEnvironment({ APP_ENV: 'local' }, local));
  assert.doesNotThrow(() =>
    databaseTarget.assertBootstrapEnvironment(
      { APP_ENV: 'staging', ALLOW_STAGING_BOOTSTRAP: 'true' },
      owner,
    ),
  );
});

test('family bootstrap refuses production, an unconfirmed staging run, and a non-compose target', () => {
  assert.throws(
    () =>
      databaseTarget.assertBootstrapEnvironment(
        { APP_ENV: 'production', ALLOW_STAGING_BOOTSTRAP: 'true' },
        owner,
      ),
    /bootstrap refuses APP_ENV=production/,
  );
  assert.throws(
    () => databaseTarget.assertBootstrapEnvironment({ APP_ENV: 'staging' }, owner),
    /ALLOW_STAGING_BOOTSTRAP/,
  );

  const remote = parseDatabaseTarget(
    'DATABASE_URL',
    'postgresql://family_owner:owner-secret@db.example.test:5432/family_stage',
  );
  assert.throws(
    () =>
      databaseTarget.assertBootstrapEnvironment(
        { APP_ENV: 'staging', ALLOW_STAGING_BOOTSTRAP: 'true' },
        remote,
      ),
    /postgres service target/,
  );
  assert.throws(
    () => databaseTarget.assertBootstrapEnvironment({ APP_ENV: 'local' }, remote),
    /loopback/,
  );
});
