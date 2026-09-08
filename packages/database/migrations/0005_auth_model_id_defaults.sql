-- Better Auth 1.7.3 creates these records through its Kysely adapter without
-- supplying an id. Keep IDs database-generated while retaining UUID keys.
ALTER TABLE auth_sessions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE auth_accounts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE auth_verifications ALTER COLUMN id SET DEFAULT gen_random_uuid();
