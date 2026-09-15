#!/bin/sh
set -eu
umask 077

fail() {
  printf '%s\n' "RESTORE_DRILL_FAILED code=$1" >&2
  exit 1
}

[ "${APP_ENV:-}" = staging ] || fail environment
: "${PGHOST:?PGHOST is required}"
: "${PGPORT:?PGPORT is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${RESTORE_DATABASE:?RESTORE_DATABASE is required}"
: "${BACKUP_OBJECT_KEY:?BACKUP_OBJECT_KEY is required}"
: "${BACKUP_R2_ENDPOINT:?BACKUP_R2_ENDPOINT is required}"
: "${BACKUP_R2_BUCKET:?BACKUP_R2_BUCKET is required}"

case "$RESTORE_DATABASE" in
  *[!a-zA-Z0-9_]*) fail restore_name ;;
  *_restore_drill) ;;
  *) fail restore_suffix ;;
esac
[ "$RESTORE_DATABASE" != "$PGDATABASE" ] || fail live_database
case "$BACKUP_OBJECT_KEY" in
  postgres/*.dump.age) ;;
  *) fail object_key ;;
esac
[ -r /run/secrets/age-key.txt ] || fail age_identity

started_at="$(date +%s)"
encrypted="/work/restore.dump.age"
plain="/work/restore.dump"
cleanup() {
  rm -f "$plain" "$encrypted"
}
trap cleanup EXIT INT TERM

existing="$(psql --dbname=postgres --tuples-only --no-align --command="SELECT 1 FROM pg_database WHERE datname = '$RESTORE_DATABASE'")"
[ -z "$existing" ] || fail target_exists

aws --endpoint-url "$BACKUP_R2_ENDPOINT" s3 cp \
  "s3://${BACKUP_R2_BUCKET}/${BACKUP_OBJECT_KEY}" \
  "$encrypted" \
  --only-show-errors
checksum="$(sha256sum "$encrypted" | cut -d ' ' -f 1)"
age --decrypt --identity /run/secrets/age-key.txt --output "$plain" "$encrypted"
createdb "$RESTORE_DATABASE"
pg_restore --exit-on-error --no-owner --dbname="$RESTORE_DATABASE" "$plain"

migration_count="$(psql --dbname="$RESTORE_DATABASE" --tuples-only --no-align --command='SELECT count(*) FROM schema_migrations')"
[ "$migration_count" -gt 0 ] || fail migrations
unsafe_roles="$(psql --dbname="$RESTORE_DATABASE" --tuples-only --no-align --command="SELECT count(*) FROM pg_roles WHERE rolname IN ('family_auth','family_runtime','family_worker') AND (NOT rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication)")"
[ "$unsafe_roles" -eq 0 ] || fail roles
unsafe_rls="$(psql --dbname="$RESTORE_DATABASE" --tuples-only --no-align --command="SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('family_spaces','family_memberships','members','member_account_links','member_contacts') AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)")"
[ "$unsafe_rls" -eq 0 ] || fail rls

duration="$(( $(date +%s) - started_at ))"
printf 'RESTORE_DRILL_COMPLETED duration_seconds=%s encrypted_sha256=%s\n' "$duration" "$checksum"
