#!/bin/sh
set -eu
umask 077

: "${PGHOST:?PGHOST is required}"
: "${PGPORT:?PGPORT is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is required}"
: "${BACKUP_R2_ENDPOINT:?BACKUP_R2_ENDPOINT is required}"
: "${BACKUP_R2_BUCKET:?BACKUP_R2_BUCKET is required}"

started_at="$(date +%s)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
plain="/work/family-stage-${stamp}.dump"
encrypted="${plain}.age"
cleanup() {
  rm -f "$plain" "$encrypted"
}
trap cleanup EXIT INT TERM

pg_dump --format=custom --no-owner --file="$plain"
age --recipient "$BACKUP_AGE_RECIPIENT" --output "$encrypted" "$plain"
checksum="$(sha256sum "$encrypted" | cut -d ' ' -f 1)"
aws --endpoint-url "$BACKUP_R2_ENDPOINT" s3 cp \
  "$encrypted" \
  "s3://${BACKUP_R2_BUCKET}/postgres/$(basename "$encrypted")" \
  --only-show-errors
duration="$(( $(date +%s) - started_at ))"
printf 'BACKUP_COMPLETED duration_seconds=%s encrypted_sha256=%s\n' "$duration" "$checksum"
