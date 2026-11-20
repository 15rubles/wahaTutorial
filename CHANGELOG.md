# Changelog

## M3 - Wahapedia + MFM importers, merge, admin editor

- Wahapedia importer for the 11th edition CSV export (records spanning lines, columns by header name): factions and chapter sub-factions, datasheets with profiles, keywords, leaders, abilities, weapons, wargear options, per-copy points tiers and wargear costs, detachments with DP and force dispositions, detachment rules, enhancements (upgrades, eligible units), stratagems with When / Target / Effect / Restrictions and structured phases.
- Core rules page parser: weapon and core abilities, rule terms, battle size table and army construction limits.
- Polite Wahapedia fetcher (robots.txt, 1 request per second, User-Agent, cache in `data-sources/wahapedia-cache`, conditional refresh) behind an admin button; zip upload as an alternative.
- Munitorum Field Manual PDF importer (PDFBox).
- Merge: MFM rows re-matched across parent and chapter factions, key alignment between sources, per-source sets for unit sizes and wargear options. The rules text linker is word-indexed (a full build of the real data takes under 2 seconds).
- Admin: data editor with per-field provenance, overrides with notes (validated, applied on top of every build), new battle sizes / force dispositions / glossary entries, phase tag review with bulk confirm.

## M2 - Domain model + BattleScribe importer

- Game data model as typed records (factions, army rules, faction options, datasheets, unit sizes, weapons, wargear options, abilities, detachments, enhancements, stratagems, battle sizes, force dispositions, glossary) stored per data version with stable keys (see `docs/decisions.md`).
- DataVersion lifecycle (DRAFT, ACTIVE, ARCHIVED) and ManualOverride table; overrides are applied on top of every build.
- Version builder: field-level merge by source priority, unmatched points rows reported, phase inference, rules text linker, plain keyword glossary entries, glossary reverse index, diff against the active version.
- BattleScribe importer for zipped `.gst` + `.cat` data (sizes and points from constraints and modifiers, wargear groups, leaders, detachments, enhancements, battle sizes, shared rules), with zip bomb and XXE protection.
- Read API: factions, datasheets (with role and search filters), datasheet details, detachments, glossary, battle sizes. Admin API and pages: import, versions list, import report, activate.

## M1 - Auth

- Invite-only registration (username, email, password, single-use invite code with expiry), login, logout, `GET /api/me`.
- Session cookie `MUSTER_SESSION` (HttpOnly, Secure, SameSite=Lax) stored with Spring Session JDBC, so sessions survive restarts. Session id changes on login.
- CSRF on for every state-changing request (`XSRF-TOKEN` cookie echoed as `X-XSRF-TOKEN`).
- Account lockout: 15 minutes after 10 failed logins in a row. Unknown users get the same error as wrong passwords.
- First admin created from `ADMIN_USERNAME` / `ADMIN_PASSWORD` on startup. Admin page to create invites (1 to 90 days) and copy the register link.
- Frontend: sign in and register pages, auth guards, "My lists" page (empty until M4), header with account menu.

## M0 - Scaffold

- Monorepo: `backend/` (Spring Boot 3.5, Java 21, Flyway, Postgres), `frontend/` (React 18, TypeScript strict, Vite), `docker/`, gitignored `data-sources/`.
- `GET /api/health` reports app and database status (503 when the database is unreachable). Shared error shape `{code, message, fieldErrors[]}` for every API error.
- Frontend shell in the "A1 dark" palette: `tokens.css`, self-hosted Atkinson Hyperlegible and IBM Plex Mono, routing, header with a live server status pill, empty Add units / List / Details panes.
- Docker Compose: `db`, `backend`, `frontend` (Caddy serves the static build and proxies `/api`). `docker compose up` from the repo root.
- Tests: JUnit 5 + Testcontainers (Postgres) for the backend, Vitest + React Testing Library for the frontend.
