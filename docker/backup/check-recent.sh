#!/bin/sh
# Healthy when the newest dump is less than 26 hours old.
newest=$(find "${BACKUP_DIR:-/backups}" -name 'muster-*.dump' -type f -mmin -1560 | head -1)
[ -n "$newest" ]
