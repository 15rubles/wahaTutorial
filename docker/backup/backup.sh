#!/bin/sh
# One backup: custom-format pg_dump into $BACKUP_DIR, then delete dumps older than $BACKUP_KEEP_DAYS days.
set -eu
dir="${BACKUP_DIR:-/backups}"
keep="${BACKUP_KEEP_DAYS:-14}"
mkdir -p "$dir"
stamp=$(date -u +%Y%m%d-%H%M%S)
tmp="$dir/.muster-$stamp.dump.partial"
pg_dump --format=custom --no-owner --file="$tmp"
mv "$tmp" "$dir/muster-$stamp.dump"
echo "{\"event\":\"backup\",\"file\":\"muster-$stamp.dump\",\"bytes\":$(wc -c < "$dir/muster-$stamp.dump")}"
find "$dir" -name 'muster-*.dump' -type f -mtime +"$keep" -print -delete | sed 's/^/{"event":"backup-pruned","file":"/; s/$/"}/'
