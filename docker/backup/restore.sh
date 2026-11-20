#!/bin/sh
# Restores a dump into the database (replacing its contents). Run with the stack's backup service:
#   docker compose -f compose.yaml -f docker/compose.prod.yml stop backend
#   docker compose -f compose.yaml -f docker/compose.prod.yml run --rm --entrypoint /bin/sh backup /scripts/restore.sh /backups/muster-YYYYMMDD-HHMMSS.dump
#   docker compose -f compose.yaml -f docker/compose.prod.yml start backend
set -eu
file="${1:?usage: restore.sh /backups/muster-....dump}"
[ -f "$file" ] || { echo "No such dump: $file" >&2; exit 1; }
pg_restore --clean --if-exists --no-owner --single-transaction --dbname="$PGDATABASE" "$file"
echo "{\"event\":\"restored\",\"file\":\"$(basename "$file")\"}"
