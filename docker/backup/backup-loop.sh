#!/bin/sh
# Runs backup.sh once a day at $BACKUP_AT (UTC, HH:MM), plus once at start if no backup exists yet.
set -eu
at="${BACKUP_AT:-03:15}"
dir="${BACKUP_DIR:-/backups}"
if ! ls "$dir"/muster-*.dump >/dev/null 2>&1; then /bin/sh /scripts/backup.sh; fi
while true; do
  now=$(date -u +%s)
  today=$(date -u +%Y-%m-%d)
  target=$(date -u -d "$today $at" +%s 2>/dev/null || date -u -D '%Y-%m-%d %H:%M' -d "$today $at" +%s)
  [ "$target" -le "$now" ] && target=$((target + 86400))
  sleep $((target - now))
  /bin/sh /scripts/backup.sh || echo '{"event":"backup-failed"}'
done
