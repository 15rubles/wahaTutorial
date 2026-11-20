# Deploying Muster on a home server

Everything runs in Docker Compose: `db` (PostgreSQL 16), `backend` (Spring Boot), `frontend` (Caddy, which
serves the app, proxies `/api` and handles HTTPS) and `backup` (nightly `pg_dump`).

## 1. Before you start

- A machine with Docker and Docker Compose v2.24 or newer.
- A domain or subdomain (for example `muster.example.com`) whose DNS A/AAAA record points at your home
  connection, and ports **80** and **443** forwarded from your router to the server. Caddy needs both to get
  and renew the Let's Encrypt certificate.

## 2. Configure

```bash
git clone <your repo> muster && cd muster
cp .env.example .env
```

Edit `.env`:

| Variable | Value |
|---|---|
| `SITE_ADDRESS` | your domain, for example `muster.example.com` |
| `POSTGRES_PASSWORD` | a long random password |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | your admin login (password at least 10 characters) |
| `BACKUP_PATH`, `BACKUP_KEEP_DAYS`, `BACKUP_AT` | backup folder, retention (14 days), time (UTC) |

Postgres only reads `POSTGRES_PASSWORD` when it creates the database volume. If you change it later,
change it inside the database too (`ALTER USER muster PASSWORD '...'`), or the backend cannot connect.

## 3. Start

```bash
docker compose -f compose.yaml -f docker/compose.prod.yml up -d --build
docker compose -f compose.yaml -f docker/compose.prod.yml ps
```

All four services should become `healthy` within a minute. Open `https://<your domain>` and sign in as
the admin.

## 4. Load game data (admin)

Admin, Data:

1. **Wahapedia (fetch)**: downloads the export into `data-sources/wahapedia-cache/` (about 25 requests, one
   per second) and builds a draft version. Later runs reuse the cache unless you tick "Check Wahapedia for
   newer files".
2. Optionally import a BattleScribe zip and the Munitorum Field Manual PDF.
3. Open the draft's report, check unmatched rows and warnings, then **Activate**.
4. Admin, Phase review: confirm or fix guessed phase tags. Admin, Editor: fix anything else (stored as
   overrides that survive re-imports). Force dispositions have no rules text in the Wahapedia export; add it
   in the editor.

## 5. Invite friends

Admin, Invites: create a code, press "Copy link" and send it. The link opens the register page with the
code filled in; each code works once and expires.

## 6. Backups and restore

The `backup` service writes `muster-YYYYMMDD-HHMMSS.dump` to `BACKUP_PATH` every day at `BACKUP_AT`
(and once at first start), and deletes dumps older than `BACKUP_KEEP_DAYS`. Its healthcheck turns
unhealthy when the newest dump is older than 26 hours. Copy that folder off the machine regularly.

Backup right now:

```bash
docker compose -f compose.yaml -f docker/compose.prod.yml exec backup /bin/sh /scripts/backup.sh
```

Restore (replaces the database contents with the dump):

```bash
docker compose -f compose.yaml -f docker/compose.prod.yml stop backend
docker compose -f compose.yaml -f docker/compose.prod.yml run --rm --entrypoint /bin/sh backup /scripts/restore.sh /backups/muster-YYYYMMDD-HHMMSS.dump
docker compose -f compose.yaml -f docker/compose.prod.yml start backend
```

This procedure was tested: a dump taken with a list and the full game data (24 035 entities) was restored
after deleting them, and both came back intact.

## 7. Update

```bash
git pull
docker compose -f compose.yaml -f docker/compose.prod.yml up -d --build
```

Database migrations run automatically at backend start (Flyway).

## 8. Logs and health

- Backend logs are JSON (one object per line, Elastic Common Schema); Caddy access logs are JSON too.
  `docker compose -f compose.yaml -f docker/compose.prod.yml logs -f backend`
- `https://<domain>/healthz` answers `ok` from Caddy; `https://<domain>/api/health` reports the backend and
  database.
- Logs rotate at 20 MB, five files per service.

## Security notes

- Sessions are stored in the database, in an HttpOnly, Secure, SameSite=Lax cookie; CSRF protection is on
  for every change; accounts lock for 15 minutes after 10 failed logins.
- Caddy sends a strict Content-Security-Policy (`'wasm-unsafe-eval'` is needed by the PDF layout engine,
  which is WebAssembly; it allows no JavaScript eval), HSTS, `nosniff`, `DENY` framing and a same-origin
  referrer policy.
- The database port is not published; only Caddy is reachable from outside.
