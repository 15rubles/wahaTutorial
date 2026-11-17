#!/bin/sh
# Syncs the rules data (rate limited, and a no-op if the cache is less than a day old), builds the
# local cache, then serves the app. Without network the app still starts with invented demo data.
set -u
cd /app

echo "== Battle Drill: syncing rules data from Wahapedia (polite, cached) =="
if npm run --silent data:sync; then
  echo "== Building the local rules cache =="
  npm run --silent data:build || echo "!! data:build reported errors, see data-cache/normalized/_report.json"
else
  echo "!! data:sync failed (no network?). The app will offer invented demo data instead."
  if [ -d data-cache/raw ] && [ ! -d data-cache/normalized ]; then npm run --silent data:build || true; fi
fi

echo "== Serving Battle Drill on http://localhost:${PORT:-5173} =="
exec npm run preview -w @battle-drill/web -- --host 0.0.0.0 --port "${PORT:-5173}" --strictPort
