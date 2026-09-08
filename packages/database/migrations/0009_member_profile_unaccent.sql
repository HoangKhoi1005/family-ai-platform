-- Accent-insensitive name search; original names remain unchanged.
-- Existing members_family_name index supplies family/name/id pagination order.
-- Reference: https://www.postgresql.org/docs/17/unaccent.html
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
GRANT EXECUTE ON FUNCTION public.unaccent(text) TO family_runtime;
