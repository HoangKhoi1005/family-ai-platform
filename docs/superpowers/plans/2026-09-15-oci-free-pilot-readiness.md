# Oracle Always Free Pilot Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible, production-safe staging package for Oracle Ampere A1 Always Free with HTTPS, restricted PostgreSQL roles, private R2 media, Resend SMTP, readiness, and a verified backup/restore path.

**Architecture:** A single ARM64 Oracle VM runs the existing web, API, worker, and PostgreSQL services in Docker Compose. Tailscale Funnel exposes only the Next.js web service; Next proxies `/api` to the private Fastify service. Cloudflare R2 stores private media and encrypted database backups, while Resend supplies SMTP.

**Tech Stack:** Node 24, npm workspaces, Turborepo, Next.js 16, Fastify 5, PostgreSQL 17, Docker Compose, Cloudflare R2 S3 API, Resend SMTP, Tailscale Funnel, POSIX shell, age, AWS CLI.

**Spec:** `docs/superpowers/specs/2026-09-15-oci-free-pilot-readiness-design.md`

## Global Constraints

- Pilot remains 15 people and staging uses synthetic data only.
- `User !== Member`; relationship and tenant models do not change.
- Browser traffic is same-origin through Next `/api`; PostgreSQL, API, and worker ports stay private.
- Database owner credentials are available only to migration and backup commands.
- Runtime roles remain `NOSUPERUSER`, `NOBYPASSRLS`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, and own no application object.
- Public `WEB_ORIGIN` must be HTTPS outside local mode; R2 endpoints must be HTTPS outside local mode.
- R2 upload URLs expire in at most 600 seconds and read URLs in at most 60 seconds.
- Secrets, family data, signed URLs, SMTP recipients, and message/media content never enter Git or logs.
- Oracle resources must remain explicitly Always Free; no automatic paid fallback.
- Existing applied migrations are immutable; all schema changes use new migration files.

---

### Task 1: Environment and SMTP configuration

**Files:**

- Modify: `apps/api/src/auth/config.ts`
- Modify: `apps/api/src/auth/mailer.ts`
- Modify: `apps/api/tests/auth-config.test.ts`
- Modify: `apps/api/tests/mailer.test.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `packages/config/src/index.ts`
- Modify: `packages/config/src/index.test.ts`
- Modify: `.env.example`
- Modify: `turbo.json`

**Interfaces:**

- Produces: `AppEnvironment = 'local' | 'staging' | 'production'`.
- Produces: `AuthConfig` with `smtpSecure`, optional `smtpUser`, and optional `smtpPassword`.
- Produces: `readServerConfig(env, portVariable, fallbackPortVariable?)` so API uses `API_PORT` locally and `PORT` in containers.
- Preserves: local Mailpit behavior without SMTP credentials.

- [ ] **Step 1: Add failing environment tests**

Add staging cases to `apps/api/tests/auth-config.test.ts`:

```ts
const stagingEnv: NodeJS.ProcessEnv = {
  ...validEnv,
  APP_ENV: 'staging',
  WEB_ORIGIN: 'https://family-stage.example.test',
  API_INTERNAL_URL: 'http://api:4010',
  AUTH_DATABASE_URL: 'postgresql://family_auth:auth-pass@postgres:5432/family_stage',
  RUNTIME_DATABASE_URL: 'postgresql://family_runtime:runtime-pass@postgres:5432/family_stage',
  SMTP_HOST: 'smtp.resend.com',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: 'resend',
  SMTP_PASSWORD: 'resend-test-secret',
  MAIL_FROM: 'no-reply@stage.example.test',
};

it('accepts HTTPS staging with private service URLs and authenticated SMTP', () => {
  expect(readAuthConfig(stagingEnv)).toMatchObject({
    appEnv: 'staging',
    webOrigin: 'https://family-stage.example.test',
    apiInternalUrl: 'http://api:4010',
    smtpSecure: false,
    smtpUser: 'resend',
    smtpPassword: 'resend-test-secret',
  });
});

it.each([
  ['WEB_ORIGIN', 'http://family-stage.example.test'],
  ['WEB_ORIGIN', 'https://user:pass@family-stage.example.test'],
  ['WEB_ORIGIN', 'https://family-stage.example.test/path'],
  ['AUTH_DATABASE_URL', 'postgresql://family_auth@postgres:5432/family_stage'],
  ['SMTP_PASSWORD', undefined],
])('rejects unsafe staging %s', (name, value) => {
  expect(() => readAuthConfig({ ...stagingEnv, [name]: value })).toThrow(String(name));
});
```

Add port fallback coverage to `packages/config/src/index.test.ts`:

```ts
it('uses platform PORT when API_PORT is absent', () =>
  expect(readServerConfig({ PORT: '8080', HOST: '0.0.0.0' }, 'API_PORT', 'PORT')).toEqual({
    port: 8080,
    host: '0.0.0.0',
    nodeEnv: 'development',
  }));
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npx vitest run apps/api/tests/auth-config.test.ts packages/config/src/index.test.ts`

Expected: staging config and fallback-port assertions fail because only local/loopback is supported.

- [ ] **Step 3: Implement environment-aware validation**

In `apps/api/src/auth/config.ts`, separate reusable URL parsing from environment policy:

```ts
export type AppEnvironment = 'local' | 'staging' | 'production';

export interface AuthConfig {
  appEnv: AppEnvironment;
  secret: string;
  webOrigin: string;
  apiInternalUrl: string;
  authDatabaseUrl: string;
  runtimeDatabaseUrl: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  mailFrom: string;
}
```

Local mode keeps loopback restrictions. Staging and production require HTTPS for `WEB_ORIGIN`, allow credential-free HTTP for private `API_INTERNAL_URL`, require credentialed PostgreSQL URLs, and require both SMTP username and password. Reject URL paths other than `/`, query strings, fragments, embedded URL credentials, weak secrets, and partial SMTP credentials.

Update `createTransport` in `mailer.ts`:

```ts
return nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpSecure,
  ...(config.smtpUser && config.smtpPassword
    ? { auth: { user: config.smtpUser, pass: config.smtpPassword } }
    : {}),
  requireTLS: !config.smtpSecure && config.smtpHost !== '127.0.0.1',
  connectionTimeout: SMTP_TIMEOUT_MS,
  greetingTimeout: SMTP_TIMEOUT_MS,
  socketTimeout: SMTP_TIMEOUT_MS,
});
```

Use `readServerConfig(process.env, 'API_PORT', 'PORT')` in `apps/api/src/server.ts`.

- [ ] **Step 4: Add a transport-options seam and verify SMTP without exposing credentials**

Export a pure `authTransportOptions(config)` helper. Test that staging returns `requireTLS: true`, `secure: false`, and Resend auth, while local returns no `auth`. Keep the existing generic failure log assertion.

- [ ] **Step 5: Update environment contracts and run focused GREEN**

Add `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASSWORD` to `.env.example` and `turbo.json`. Local values remain empty/false. Run:

```sh
npx vitest run apps/api/tests/auth-config.test.ts apps/api/tests/mailer.test.ts packages/config/src/index.test.ts
npm run typecheck
```

Expected: all focused tests and typecheck pass.

- [ ] **Step 6: Commit Task 1**

```sh
git add .env.example turbo.json apps/api/src/auth/config.ts apps/api/src/auth/mailer.ts apps/api/src/server.ts apps/api/tests/auth-config.test.ts apps/api/tests/mailer.test.ts packages/config/src/index.ts packages/config/src/index.test.ts
git commit -m "feat(config): support secure staging runtime"
```

---

### Task 2: Dependency readiness and sanitized health behavior

**Files:**

- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/app.test.ts`
- Modify: `apps/api/src/server.ts`
- Create: `apps/api/src/readiness.ts`
- Create: `apps/api/src/readiness.test.ts`

**Interfaces:**

- Produces: `ReadinessProbe = () => Promise<void>`.
- Produces: `GET /health/ready` returning `{status:'ok', service:'family-api'}` or generic `503 SERVICE_UNAVAILABLE`.
- Consumes: restricted auth/runtime pools already validated by `assertSafeApplicationRoles`.

- [ ] **Step 1: Write failing readiness tests**

```ts
it('returns 200 only when every readiness probe succeeds', async () => {
  const app = buildApp({ readinessProbes: [async () => undefined, async () => undefined] });
  const response = await app.inject('/health/ready');
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: 'ok', service: 'family-api' });
  await app.close();
});

it('returns a generic 503 without the dependency error', async () => {
  const app = buildApp({
    readinessProbes: [async () => Promise.reject(new Error('postgres-secret-host'))],
  });
  const response = await app.inject('/health/ready');
  expect(response.statusCode).toBe(503);
  expect(response.body).not.toContain('postgres-secret-host');
  expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
  await app.close();
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npx vitest run apps/api/src/app.test.ts apps/api/src/readiness.test.ts`

Expected: `readinessProbes` and `/health/ready` do not exist.

- [ ] **Step 3: Implement focused readiness probes**

Create `readiness.ts`:

```ts
import type { Pool } from 'pg';
export type ReadinessProbe = () => Promise<void>;
export function databaseReadinessProbe(pool: Pool): ReadinessProbe {
  return async () => {
    await pool.query('SELECT 1');
  };
}
export async function runReadiness(probes: readonly ReadinessProbe[]): Promise<void> {
  await Promise.all(probes.map((probe) => probe()));
}
```

Extend `AppOptions` with `readinessProbes?: readonly ReadinessProbe[]`, register `/health/ready`, and map probe failures to a fixed 503 response. In `server.ts`, pass probes for both auth and runtime pools. Do not probe SMTP by sending mail and do not reveal dependency names in the response.

- [ ] **Step 4: Verify readiness and regression tests**

Run:

```sh
npx vitest run apps/api/src/app.test.ts apps/api/src/readiness.test.ts apps/api/tests/app-auth.test.ts
npm run build --workspace @family/api
```

Expected: liveness remains process-only, readiness is dependency-aware, and auth routes still pass.

- [ ] **Step 5: Commit Task 2**

```sh
git add packages/contracts/src/index.ts apps/api/src/app.ts apps/api/src/app.test.ts apps/api/src/server.ts apps/api/src/readiness.ts apps/api/src/readiness.test.ts
git commit -m "feat(api): add dependency readiness endpoint"
```

---

### Task 3: Safe staging migration and role provisioning

**Files:**

- Create: `packages/database/scripts/database-target.mjs`
- Create: `packages/database/scripts/database-target.test.mjs`
- Modify: `packages/database/scripts/provision-auth.mjs`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `docs/DEVELOPMENT.md`

**Interfaces:**

- Produces: `parseDatabaseTarget(name, value, expectedUser)` returning decoded host, port, database, user, and password.
- Produces: `assertProvisioningEnvironment(env, owner, roles)` allowing local or staging only and requiring every role URL to target the same host/port/database.
- Produces commands `db:provision-roles` and `db:verify-staging`.

- [ ] **Step 1: Extract target parsing behind tests**

Add `database-target.test.mjs` cases that accept local URLs, accept `postgres` Docker DNS only for `APP_ENV=staging`, reject production, reject missing password/database, reject role mismatch, and reject owner/role targets that differ.

```js
assert.equal(
  parseDatabaseTarget(
    'AUTH_DATABASE_URL',
    'postgresql://family_auth:secret@postgres:5432/family_stage',
    'family_auth',
  ).host,
  'postgres',
);
assert.throws(
  () => assertProvisioningEnvironment('production', owner, roles),
  /staging provisioning refuses APP_ENV=production/,
);
```

- [ ] **Step 2: Run parser tests and confirm RED**

Run: `node --test packages/database/scripts/database-target.test.mjs`

Expected: module is missing.

- [ ] **Step 3: Implement fail-closed target guards**

Move URL parsing to `database-target.mjs`. Export pure functions and keep passwords out of thrown messages. `assertProvisioningEnvironment` accepts only `local` or `staging`; staging requires explicit `ALLOW_STAGING_PROVISION=true`. Production always fails in this command.

Refactor `provision-auth.mjs` to consume the helper and change the success message to `Provisioned restricted application role passwords.` without target details.

- [ ] **Step 4: Add staging verification command**

Create `db:verify-staging` as a sequence documented and invoked explicitly:

```json
{
  "db:provision-roles": "node --env-file=.env packages/database/scripts/provision-auth.mjs",
  "db:verify-staging": "node --env-file=.env packages/database/scripts/migrate.mjs && node --env-file=.env packages/database/scripts/migrate.mjs && node --env-file=.env packages/database/scripts/status.mjs"
}
```

Do not place role integration tests in the application container image. The deployment runbook invokes existing auth/tenant/calendar/notification/media suites from a temporary admin tool container before staging acceptance.

- [ ] **Step 5: Run local migration/role regression**

Run:

```sh
node --test packages/database/scripts/database-target.test.mjs
npm run db:migrate
npm run db:migrate
npm run db:provision-roles
npm run test:auth-schema
npm run test:tenant
```

Expected: second migration is a no-op; restricted-role and tenant checks pass.

- [ ] **Step 6: Commit Task 3**

```sh
git add package.json .env.example docs/DEVELOPMENT.md packages/database/scripts/database-target.mjs packages/database/scripts/database-target.test.mjs packages/database/scripts/provision-auth.mjs
git commit -m "feat(database): guard staging role provisioning"
```

---

### Task 4: ARM64 container and Compose deployment package

**Files:**

- Create: `deploy/Dockerfile`
- Create: `deploy/compose.staging.yaml`
- Create: `deploy/staging.env.example`
- Create: `deploy/r2-cors.json`
- Create: `scripts/check-deployment-config.mjs`
- Create: `scripts/test-deployment-config.mjs`
- Modify: `.dockerignore`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Produces image targets: `web`, `api`, `worker`, and `tools`.
- Produces private Compose services named `postgres`, `api`, `worker`, `web`.
- Produces `npm run deploy:check`, a static fail-closed validation of Compose, Dockerfile, env template, and R2 CORS.

- [ ] **Step 1: Write failing deployment safety checks**

`test-deployment-config.mjs` creates temporary unsafe fixtures and asserts the checker rejects:

- a published PostgreSQL port;
- an API/worker published port;
- `DATABASE_URL` passed to API/worker/web;
- a public R2 bucket/CORS wildcard;
- missing `no-new-privileges`;
- root runtime user;
- mutable `latest` image tag.

It also asserts the committed deployment files pass.

- [ ] **Step 2: Run deployment test and confirm RED**

Run: `node scripts/test-deployment-config.mjs`

Expected: deployment checker or committed deployment files are missing.

- [ ] **Step 3: Add multi-stage ARM64-compatible Dockerfile**

Use one root build context and named targets. Required shape:

```dockerfile
FROM node:24.18.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/media/package.json packages/media/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run build

FROM node:24.18.0-bookworm-slim AS api
ENV NODE_ENV=production
USER node
WORKDIR /app
COPY --chown=node:node --from=build /app /app
CMD ["node", "apps/api/dist/server.js"]
```

Create corresponding `web`, `worker`, and `tools` targets. The `tools` target may run migration/provision commands but is never a long-running service.

- [ ] **Step 4: Add private staging Compose topology**

Compose requirements:

- PostgreSQL has one named volume, internal healthcheck, no `ports`.
- API has no `ports`, receives auth/runtime credentials only, depends on PostgreSQL health, and checks `/health/ready`.
- Worker has no `ports`, receives only worker DB and R2 credentials.
- Web publishes only `127.0.0.1:3200:3200` for Tailscale Funnel and uses `API_INTERNAL_URL=http://api:4010`.
- Every application service uses `security_opt: [no-new-privileges:true]`, restart policy, resource limits, and non-root image users.
- `migrate` is a tools profile and receives owner plus role URLs only when explicitly invoked.

- [ ] **Step 5: Add staging env and R2 CORS templates**

`staging.env.example` contains placeholders only, sets `APP_ENV=staging`, `HOST=0.0.0.0`, public HTTPS `WEB_ORIGIN`, private API URL, Resend SMTP settings, R2 `region=auto`, and `MEDIA_STORAGE_FORCE_PATH_STYLE=false`.

`r2-cors.json` permits `PUT`, `GET`, and `HEAD` only from `https://REPLACE_WITH_TS_NET_HOST`, allows `content-type`, exposes `etag`, and contains no wildcard origin.

- [ ] **Step 6: Wire deployment validation into CI**

Add `deploy:check` to root `check`. In CI, build `api`, `web`, and `worker` targets for `linux/arm64` without pushing:

```sh
docker build --platform linux/arm64 --target api -f deploy/Dockerfile .
docker build --platform linux/arm64 --target web -f deploy/Dockerfile .
docker build --platform linux/arm64 --target worker -f deploy/Dockerfile .
```

- [ ] **Step 7: Run deployment checks and commit**

Run:

```sh
npm run deploy:check
docker compose --env-file deploy/staging.env.example -f deploy/compose.staging.yaml config --quiet
docker build --platform linux/arm64 --target api -f deploy/Dockerfile .
docker build --platform linux/arm64 --target web -f deploy/Dockerfile .
docker build --platform linux/arm64 --target worker -f deploy/Dockerfile .
```

Commit:

```sh
git add deploy .dockerignore package.json scripts/check-deployment-config.mjs scripts/test-deployment-config.mjs .github/workflows/ci.yml
git commit -m "feat(deploy): add ARM64 staging package"
```

---

### Task 5: Encrypted backup and isolated restore drill

**Files:**

- Create: `deploy/backup/Dockerfile`
- Create: `deploy/scripts/backup-postgres.sh`
- Create: `deploy/scripts/restore-postgres.sh`
- Create: `scripts/check-backup-safety.mjs`
- Create: `scripts/test-backup-safety.mjs`
- Modify: `deploy/compose.staging.yaml`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Backup consumes `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `BACKUP_AGE_RECIPIENT`, R2 endpoint/bucket, and AWS credential environment variables.
- Restore additionally requires `APP_ENV=staging`, `RESTORE_DATABASE` ending `_restore_drill`, `BACKUP_OBJECT_KEY`, and an age identity mounted read-only.
- Neither script prints connection values, credentials, object URLs, or database row data.

- [ ] **Step 1: Write failing backup safety fixtures**

The checker rejects scripts that:

- use `set -x`;
- echo environment values;
- pass `DATABASE_URL` on a process command line;
- restore to `PGDATABASE` or a target without `_restore_drill`;
- upload an unencrypted `.dump`;
- omit cleanup trap or 30-day retention documentation.

- [ ] **Step 2: Run backup safety test and confirm RED**

Run: `node scripts/test-backup-safety.mjs`

Expected: backup files/checker are missing.

- [ ] **Step 3: Implement the backup container and script**

Base the image on `postgres:17-alpine`; install `age`, `aws-cli`, and CA certificates. Run as an unprivileged user with a tmpfs work directory.

Backup script shape:

```sh
#!/bin/sh
set -eu
umask 077
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
plain="/work/family-stage-${stamp}.dump"
encrypted="${plain}.age"
cleanup() { rm -f "$plain" "$encrypted"; }
trap cleanup EXIT INT TERM
pg_dump --format=custom --no-owner --file="$plain"
age --recipient "$BACKUP_AGE_RECIPIENT" --output "$encrypted" "$plain"
aws --endpoint-url "$BACKUP_R2_ENDPOINT" s3 cp "$encrypted" "s3://${BACKUP_R2_BUCKET}/postgres/$(basename "$encrypted")" --only-show-errors
printf '%s\n' 'BACKUP_COMPLETED'
```

PostgreSQL tools consume `PG*` environment variables; the connection URL never appears in command arguments.

- [ ] **Step 4: Implement isolated restore guards**

Restore refuses unless `APP_ENV=staging`, `RESTORE_DATABASE` ends `_restore_drill`, and differs from `PGDATABASE`. It downloads only the explicit object key, decrypts to tmpfs, creates the target through the owner connection, runs `pg_restore --no-owner`, executes migration status and restricted-role/RLS smoke checks, then emits only `RESTORE_DRILL_COMPLETED` plus duration/checksum metadata.

- [ ] **Step 5: Add Compose profiles and CI static verification**

Add `backup` and `restore-drill` profiles with no exposed ports, read-only age key mount for restore, and tmpfs `/work`. CI builds the backup image and runs shell syntax/static safety checks without real credentials.

- [ ] **Step 6: Verify and commit Task 5**

Run:

```sh
npm run backup:check
docker build --platform linux/arm64 -f deploy/backup/Dockerfile deploy/backup
docker compose --env-file deploy/staging.env.example -f deploy/compose.staging.yaml config --quiet
```

Commit:

```sh
git add deploy/backup deploy/scripts deploy/compose.staging.yaml package.json scripts/check-backup-safety.mjs scripts/test-backup-safety.mjs .github/workflows/ci.yml
git commit -m "feat(ops): add encrypted backup restore drill"
```

---

### Task 6: Oracle, Tailscale, R2, Resend, and monitoring runbook

**Files:**

- Create: `docs/operations/README.md`
- Create: `docs/operations/ORACLE_STAGING.md`
- Create: `docs/operations/BACKUP_RESTORE.md`
- Create: `docs/operations/INCIDENTS.md`
- Create: `docs/operations/STAGING_ACCEPTANCE.md`
- Modify: `docs/INDEX.md`
- Modify: `README.md`

**Interfaces:**

- Produces an ordered, copy-safe operator workflow with placeholders that cannot be mistaken for real credentials.
- Produces a staging acceptance record template containing evidence metadata only.

- [ ] **Step 1: Document account and quota gates**

`ORACLE_STAGING.md` must require:

1. Select the Oracle home region deliberately and create only an `Always Free-eligible` Ampere A1 shape within 2 OCPU/12 GB total.
2. Set a budget/usage notification where available and record the console screenshot/date; never enable automatic paid scaling.
3. Create Ubuntu 24.04 ARM64 with SSH key, disable password login, update packages, install Docker/Tailscale, and enable Funnel only for `127.0.0.1:3200`.
4. Clone the public code repo without secrets, create `/opt/family-ai/secrets/staging.env` mode `0600`, and deploy through the explicit Compose profiles.
5. Configure a private R2 media bucket, separate backup bucket/token, exact CORS origin, and Resend sender verification.

- [ ] **Step 2: Document deploy and rollback commands**

The runbook uses exact commands with placeholder paths, including:

```sh
docker compose --env-file /opt/family-ai/secrets/staging.env -f deploy/compose.staging.yaml --profile migrate run --rm migrate
docker compose --env-file /opt/family-ai/secrets/staging.env -f deploy/compose.staging.yaml up -d postgres api worker web
curl --fail --silent http://127.0.0.1:3200/health/ready
tailscale funnel --bg --https=443 http://127.0.0.1:3200
```

Rollback uses the previous Git tag/image and never reverses applied SQL. Restore instructions always target `_restore_drill` first.

- [ ] **Step 3: Document incidents and privacy-safe evidence**

Cover VM unavailable, disk pressure, database unavailable, R2 failure, SMTP failure, worker retry exhaustion, suspected secret leak, membership revoke, and backup failure. Each response names the event code and action without instructing operators to copy PII into logs/issues.

- [ ] **Step 4: Add staging acceptance checklist**

The checklist captures commit SHA, image digest, migration count/checksum status, role/RLS result, HTTPS hostname, synthetic onboarding outcome, media outcome, backup object checksum, restore duration, RPO, Android/iPhone status, and seven-day alert status. It contains no email, token, member name, contact, signed URL, or media content.

- [ ] **Step 5: Validate documentation and commit**

Run:

```sh
python scripts/validate_brain.py
npx prettier --check docs/operations README.md docs/INDEX.md
```

Commit:

```sh
git add docs/operations README.md docs/INDEX.md
git commit -m "docs: add free cloud staging runbook"
```

---

### Task 7: Full gate and staging handoff

**Files:**

- Modify: `CURRENT_STATE.md`
- Modify: `docs/13_ROADMAP.md`
- Modify: `docs/context.json` only if implementation materially changes the documented stage
- Modify: `docs/superpowers/plans/2026-09-15-oci-free-pilot-readiness.md`

**Interfaces:**

- Consumes every prior task.
- Produces verified source artifacts ready for Oracle account provisioning.

- [ ] **Step 1: Run the full source quality gate**

Run:

```sh
npm run check
python scripts/validate_brain.py
npm run deploy:check
npm run backup:check
```

Expected: all commands pass with exact counts recorded from output.

- [ ] **Step 2: Run database and storage integration**

Start local PostgreSQL, Mailpit, and MinIO using existing generated `.env`, then run:

```sh
npm run db:migrate
npm run db:migrate
npm run db:provision-roles
npm run test:auth-schema
npm run test:tenant
npm run test:relationships
npm run test:calendar-schema
npm run test:calendar-api
npm run test:notification-schema
npm run test:notification-worker
npm run test:notification-api
npm run test:moments-schema
npm run test:moments-api
npm run test:media-worker
npm run test:media-storage
```

Expected: all integration suites pass without changing the local data contract.

- [ ] **Step 3: Run browser regression**

Run: `npm run test:e2e`

Expected: existing onboarding, Home, tree, calendar, inbox, Moments, Memories, and PWA suites pass on configured desktop/mobile projects.

- [ ] **Step 4: Build deployment images**

Run:

```sh
docker build --platform linux/arm64 --target api -f deploy/Dockerfile .
docker build --platform linux/arm64 --target web -f deploy/Dockerfile .
docker build --platform linux/arm64 --target worker -f deploy/Dockerfile .
docker build --platform linux/arm64 -f deploy/backup/Dockerfile deploy/backup
```

Expected: every ARM64 image builds successfully.

- [ ] **Step 5: Update Project Brain with evidence only**

Record completed source/config/runbook work and exact test results. Keep Oracle resource creation, live R2/Resend credentials, HTTPS smoke, restore drill, device testing, and pilot invite explicitly incomplete until performed.

- [ ] **Step 6: Commit the verified source package**

```sh
git add CURRENT_STATE.md docs/13_ROADMAP.md docs/context.json docs/superpowers/plans/2026-09-15-oci-free-pilot-readiness.md
git commit -m "docs: record pilot readiness verification"
```

- [ ] **Step 7: External provisioning handoff**

Only after source gates pass, open Oracle/Tailscale/Cloudflare/Resend login flows for the owner. Create no paid resource and store no credential in chat, Git, screenshots, or command output. Stop if Oracle cannot allocate an Always Free-eligible shape and report the capacity blocker without selecting a paid shape.
