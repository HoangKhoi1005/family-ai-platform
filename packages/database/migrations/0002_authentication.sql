-- Global Better Auth identity and session tables. Tenant tables remain inaccessible
-- to the auth role; membership authorization is implemented in a later migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'family_auth') THEN
    CREATE ROLE family_auth LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  ELSE
    ALTER ROLE family_auth LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'family_runtime') THEN
    CREATE ROLE family_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  ELSE
    ALTER ROLE family_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

ALTER TABLE users
  ALTER COLUMN auth_subject DROP NOT NULL,
  ADD COLUMN name text,
  ADD COLUMN email text UNIQUE,
  ADD COLUMN email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN image text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE auth_accounts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE(provider_id, account_id)
);

CREATE TABLE auth_verifications (
  id uuid PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX auth_verifications_identifier ON auth_verifications(identifier);
CREATE INDEX auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX auth_accounts_user ON auth_accounts(user_id);

CREATE TABLE auth_rate_limits (
  id uuid PRIMARY KEY,
  key text NOT NULL UNIQUE,
  count integer NOT NULL,
  last_request bigint NOT NULL
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE auth_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE auth_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_verifications FORCE ROW LEVEL SECURITY;
ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_rate_limits FORCE ROW LEVEL SECURITY;

REVOKE ALL ON users, auth_sessions, auth_accounts, auth_verifications, auth_rate_limits FROM PUBLIC;
REVOKE ALL ON users, auth_sessions, auth_accounts, auth_verifications, auth_rate_limits FROM family_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON users, auth_sessions, auth_accounts, auth_verifications, auth_rate_limits
  TO family_auth;

CREATE POLICY family_auth_users_all ON users
  FOR ALL TO family_auth USING (true) WITH CHECK (true);
CREATE POLICY family_auth_sessions_all ON auth_sessions
  FOR ALL TO family_auth USING (true) WITH CHECK (true);
CREATE POLICY family_auth_accounts_all ON auth_accounts
  FOR ALL TO family_auth USING (true) WITH CHECK (true);
CREATE POLICY family_auth_verifications_all ON auth_verifications
  FOR ALL TO family_auth USING (true) WITH CHECK (true);
CREATE POLICY family_auth_rate_limits_all ON auth_rate_limits
  FOR ALL TO family_auth USING (true) WITH CHECK (true);
