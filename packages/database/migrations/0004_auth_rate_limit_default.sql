-- Better Auth's database rate limiter creates key/count/last_request rows and
-- relies on the database to supply the opaque row id.
ALTER TABLE auth_rate_limits
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
