# Authentication foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide testable email/password authentication with local email verification/reset and database credentials separated from tenant access.

**Architecture:** Better Auth runs once in Fastify and stores global identity/session data in PostgreSQL using a restricted auth role. Next proxies `/api/*` to the loopback API so browser cookies stay same-origin. Tenant APIs and membership remain a separate subsequent plan; this task creates no active family membership.

**Tech Stack:** Better Auth 1.7.3, Nodemailer 10.0.1, @types/nodemailer 8.0.1, existing Fastify/Next/pg/TypeScript, local Mailpit.

**Spec:** [Onboarding scope](../specs/2026-09-08-onboarding.md), [ADR-002](../../decisions/ADR-002-authentication.md), [Privacy](../../10_PRIVACY_SECURITY.md).

## Global Constraints

- Pilot 15 people; fixtures are synthetic; no real messages or provider credentials.
- User differs from Member. No membership, family admin or account link is granted by signup.
- Auth and runtime connections are NOSUPERUSER NOBYPASSRLS and cannot own tables or run DDL.
- Do not edit migration 0001, delete historical users, expose password/session/reset tokens in logs, disable origin/CSRF protection or cache role/family permissions in sessions.
- UI visual approval is pending. This plan changes infrastructure/API only, not business screens.
- Root dependencies, lockfile, migrations and contracts have one owner: supervisor reviews and explicitly delegates those files for this task, with no concurrent edits to them.
- Subagents are GPT-5.6 Luna xhigh, one implementer at a time, no child agents.

## Task 1: Auth schema and isolated local services

**Files:**

- Create `packages/database/migrations/0002_authentication.sql` — auth tables and role grants/policies.
- Create `packages/database/scripts/provision-auth.mjs` — local role password provisioning using owner connection, no secret output.
- Create `packages/database/scripts/test-auth-schema.mjs` — PostgreSQL assertions in transaction with rollback.
- Modify `scripts/init-env.mjs`, `.env.example`, `compose.yaml`, `package.json`, `docs/DEVELOPMENT.md` — isolated ports/env/commands.

**Interfaces:**

- Existing migration runner consumes versioned SQL unchanged.
- Produce `AUTH_DATABASE_URL`, `RUNTIME_DATABASE_URL`, `BETTER_AUTH_SECRET`, `WEB_ORIGIN`, `API_INTERNAL_URL`, `API_PORT`, `PORT` (web), `SMTP_HOST`, `SMTP_PORT`, `MAILPIT_PORT`, `MAIL_FROM`, `APP_ENV=local` in ignored env.
- Local worktree uses compose project `family-ai-onboarding`, PostgreSQL54339, SMTP1035, mail UI8035, API4010, web3200. Main checkout's compose project/volume/ports remain untouched. Defaults for normal clone may remain existing ports; explicit overrides in worktree env isolate tests.
- Roles `family_auth` and `family_runtime`: LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS. Migration creates passwordless roles if absent; provisioning refuses roles with elevated privileges and sets password from URL through correctly quoted SQL literals, never logs statement/URL.
- Auth table names `users`, `auth_sessions`, `auth_accounts`, `auth_verifications`, `auth_rate_limits`; snake_case fields. Auth role has CRUD on auth core tables; no privilege on tenant tables. Runtime has no privilege on core auth tables; tenant grants/policies await later plan.

- [ ] **Step 1: Write schema security tests and run RED against migration0001.** Use existing pg script style. Real assertions include auth role attributes, tenant read denied to auth, auth_accounts read denied to runtime and historical user preservation. Each test must seed visible data before checking denial, and rollback fixtures. Missing tables/roles is expected initial failure.

```js
import assert from 'node:assert/strict';
// Use the existing connection setup/finally close pattern.
const role = await client.query(
  "SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname='family_auth'",
);
assert.equal(role.rowCount, 1);
assert.deepEqual(role.rows[0], {
  rolsuper: false,
  rolbypassrls: false,
  rolcreatedb: false,
  rolcreaterole: false,
});
assert.equal(
  (await client.query("SELECT has_table_privilege('family_auth','members','SELECT') AS allowed"))
    .rows[0].allowed,
  false,
);
assert.equal(
  (
    await client.query(
      "SELECT has_table_privilege('family_runtime','auth_accounts','SELECT') AS allowed",
    )
  ).rows[0].allowed,
  false,
);
```

- [ ] **Step 2: Add reviewed schema.** Preserve `users.id` and `auth_subject`; drop only the NOT NULL constraint of auth_subject and add name/email nullable for legacy rows, email_verified boolean NOT NULL DEFAULT false, image nullable, updated_at NOT NULL DEFAULT now. New auth writes must supply name/email. Unique email index supports Better Auth; avoid fake legacy email backfill.

```sql
ALTER TABLE users ALTER COLUMN auth_subject DROP NOT NULL;
ALTER TABLE users ADD COLUMN name text,
  ADD COLUMN email text UNIQUE,
  ADD COLUMN email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN image text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
  ip_address text, user_agent text,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE auth_accounts (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id text NOT NULL, provider_id text NOT NULL,
  access_token text, refresh_token text, id_token text,
  access_token_expires_at timestamptz, refresh_token_expires_at timestamptz,
  scope text, password text,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  UNIQUE(provider_id, account_id)
);
CREATE TABLE auth_verifications (
  id uuid PRIMARY KEY, identifier text NOT NULL, value text NOT NULL,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE INDEX auth_verifications_identifier ON auth_verifications(identifier);
CREATE INDEX auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX auth_accounts_user ON auth_accounts(user_id);
CREATE TABLE auth_rate_limits (
  id uuid PRIMARY KEY, key text NOT NULL UNIQUE, count integer NOT NULL, last_request bigint NOT NULL
);
```

Verify exact rateLimit types and Better Auth model mappings against pinned installed declarations before finalizing; if a documented schema field differs, record evidence and align schema/config together. ENABLE+FORCE RLS on new auth tables and add explicit policies TO family_auth USING(true) WITH CHECK(true), likewise users; revoke PUBLIC privileges. No tenant policy is opened.

- [ ] **Step 3: Local setup.** Preserve existing `.env` keys and never print secrets. Extend initializer with missing keys only using cryptographic random secrets and preserve existing credentials. Mailpit image pinned to an official released tag verified before pull, exposed only127.0.0.1; no SMTP relay enabled. Add `db:provision-auth` and `test:auth-schema` scripts. Provision requires explicit local-only environment and loopback DB URL to prevent accidental production mutation. No broad DROP/cleanup or Docker down -v.

- [ ] **Step 4: GREEN and migration replay.** Apply0002 to isolated local DB, run migration again (no reapply), execute schema tests and original `test:db`; legacy fixture remains compatible. Run env initializer twice and verify bytes do not change on second run. Report commands/results and static grant review. Update DEVELOPMENT with exact setup and boundaries, then supervisor commit `feat(database): isolate authentication schema and local mail services` after review.

## Task 2: Better Auth API integration and real session tests

**Files:**

- Modify `apps/api/package.json`, `package-lock.json`, root `package.json` — exact dependencies and integration command.
- Create `apps/api/src/auth/config.ts`, `auth.ts`, `mailer.ts`, `routes.ts`, `session.ts` — validated config, factory, local delivery lifecycle, Fastify adapter, guard.
- Modify `apps/api/src/app.ts`, `server.ts`, `apps/web/next.config.ts`, `turbo.json`, `vitest.config.ts` — opt-in configured auth wiring, same-origin proxy and exclude `**/*.integration.test.ts` from the unit suite.
- Create `apps/api/tests/auth.integration.test.ts`, `apps/api/tests/auth-config.test.ts`, `vitest.integration.config.ts` — real DB+SMTP tests separated from unit suite.
- Modify `.github/workflows/ci.yml`, `docs/DEVELOPMENT.md` — local service integration gate and run instructions.

**Interfaces:**

- `readAuthConfig(env: NodeJS.ProcessEnv): AuthConfig` rejects missing/weak secret, invalid URLs, non-loopback SMTP in local mode; production mail delivery is not enabled in this phase.
- `createAuth(config: AuthConfig, pool: Pool, mailer: AuthMailer)` returns Better Auth instance; use ReturnType for downstream auth type.
- `AuthMailer` owns `sendVerification(to: string, url: string): void`, `sendReset(to: string, url: string): void`, `drain(): Promise<void>`. Delivery asynchronously tracked, sanitized failure count/log, bounded SMTP timeout; drain on shutdown. No floating unhandled rejection.
- `registerAuthRoutes(app: FastifyInstance, auth: ReturnType<typeof createAuth>, publicOrigin: string): void` mounts GET/POST `/api/auth/*`; adapter uses configured origin, preserves repeated Set-Cookie and response body/status, strips untrusted forwarded host/IP headers. Unsupported methods rejected.
- `getVerifiedActor(auth, headers): Promise<{userId: string} | null>` validates real database session and verified email, no test header bypass.
- `buildApp(options?)` preserves health-only behavior for existing tests; configured server passes auth dependencies. If auth env partially present, startup fails clearly rather than silently running a broken auth instance. Full auth requires runtime URL validation even before tenant routes exist.
- Server maps `API_PORT` explicitly into `readServerConfig` for API listening; global `PORT` is reserved for Next. Isolated worktree values are API_PORT4010 and PORT3200, matching API_INTERNAL_URL/WEB_ORIGIN. Never let both processes bind the same global PORT under Turbo.
- Configured server queries actual connection role attributes and table ownership on startup; reject owner/superuser/BYPASSRLS credentials passed as AUTH_DATABASE_URL or RUNTIME_DATABASE_URL. URL username checks alone are insufficient. Test accidental owner URL is rejected before listening.
- Add GET `/api/v1/me` returning only `{ user: { id, name, email }, memberships: [] }` for verified user at this phase; no family data or role claims. 401 generic envelope otherwise. Membership list is extended by next plan.

- [ ] **Step 1: RED tests at integration boundary.** Real signup must persist a user, send a local verification email, reject unverified login, accept verified login, set HttpOnly cookie and support authenticated me. Assert no tenant membership appears from signup. Reset must invalidate old session and old password; reused/expired reset token fails. Cross-origin sign-in/sign-out mutation fails. Rate limit repeated invalid sign-ins returns429. Use synthetic unique `.test` emails, isolated database and Mailpit polling scoped to recipient; never delete all inbox messages globally. Config unit tests cover missing secret and non-loopback mail server.

```ts
// Test shape: fixtures create actual Fastify/Auth/pg instances, no mocked auth success.
const signup = await app.inject({
  method: 'POST',
  url: '/api/auth/sign-up/email',
  headers: { origin: webOrigin, 'content-type': 'application/json' },
  payload: { name: 'Người dùng thử', email, password },
});
expect(signup.statusCode).toBe(200);
const beforeVerification = await app.inject({
  method: 'POST',
  url: '/api/auth/sign-in/email',
  headers: { origin: webOrigin },
  payload: { email, password },
});
expect(beforeVerification.statusCode).toBe(403);
const deniedMe = await app.inject({ method: 'GET', url: '/api/v1/me' });
expect(deniedMe.statusCode).toBe(401);
```

- [ ] **Step 2: Implement auth factory using pinned types.** User modelName users maps emailVerified/createdAt/updatedAt; session/account/verification/rateLimit map every camelCase column to schema snake_case. UUID generation. Required configuration:

```ts
emailAndPassword: {
  enabled: true, requireEmailVerification: true,
  minPasswordLength: 12, maxPasswordLength: 128,
  revokeSessionsOnPasswordReset: true,
  sendResetPassword: async ({ user, url }) => { mailer.sendReset(user.email, url); },
},
emailVerification: {
  sendOnSignUp: true, sendOnSignIn: false, autoSignInAfterVerification: false,
  sendVerificationEmail: async ({ user, url }) => { mailer.sendVerification(user.email, url); },
},
session: { modelName: 'auth_sessions', cookieCache: { enabled: false }, expiresIn: 604800 },
advanced: { database: { generateId: 'uuid' } },
trustedOrigins: [config.webOrigin],
rateLimit: { enabled: true, storage: 'database', modelName: 'auth_rate_limits' },
```

Use same-origin Next rewrites with validated server-only API_INTERNAL_URL; no NEXT_PUBLIC database/secrets. Existing health error sanitization and no-store remain. Do not mutate root landing page or preview. Only enable local mail mode and explicitly document it; production setup requires a future configured provider, not silently sending through a developer inbox.

Verification uses `storeIdentifier: 'hashed'` for reset lookup identifiers. Email verification in v1.7.3 uses expiry-bound signed JWT and may replay idempotently after verification; document that behavior and test it does not create a session (`autoSignInAfterVerification: false`) or membership. Password reset remains atomic single-use. Session tokens are stored by the library as opaque values, not automatically hashed; restrict auth table privileges and never claim otherwise. Signup sends to the local catcher; ordinary sign-in does not resend automatically. Explicit resend endpoint is rate limited. Do not add an autosend flag that silently discards required verification messages.

- [ ] **Step 3: GREEN and review.** Run focused auth integration, unit tests, typecheck/lint/build. Verify actual auth DB login is restricted (not SET ROLE on owner only), multiple cookies survive HTTP, logout removes session, no membership is fabricated. Inspect emails through Mailpit API in tests without printing URL/token. Record observed verification replay semantics accurately rather than asserting unsupported single-use guarantees. CI service runs migration/provision with synthetic secrets and auth integration; no real mail/deploy. Supervisor commit `feat(api): add verified email sessions and local account recovery` after independent review.

CI also runs on pushes to `feat/**` so this branch receives checks without merging main. Integration tests have their own explicit Vitest configuration and command with `--env-file=.env` locally; unit `npm test` stays independent of Docker. Turbo declares server environment pass-through for dev/start and build-time proxy URL dependencies to avoid silently dropping auth variables or reusing stale proxy builds.

Root `npm run dev` must load ignored root `.env` before Turbo (Node24 `--env-file-if-exists=.env`), then pass needed server env through. Direct workspace run instructions explain equivalent loading. `APP_ENV=local` is explicit permission for loopback provisioning/mail mode; other values are rejected for those commands. Do not use an implicitly guessed production fallback.

## Following scope

The next independent plan implements tenant RLS, invitation/approval/claim/profile contracts and endpoints using `getVerifiedActor`. Business UI follows user approval of design preview. This authentication plan alone is not the completed onboarding round.
