# Changelog

## M8 - Mobile

- Below 1024px the builder shows one pane at a time with a bottom tab bar (Add / List / Details); selecting a unit opens Details; panes stay mounted so search and scroll survive tab switches.
- Compact sticky header: name, points, DP, legal status and a PDF button on one row; configuration panel collapsed by default.
- Keyword popups open as a bottom sheet that can be dragged (or tapped) up to full height; the export dialog is full screen on phones.
- Touch targets of at least 44px; no horizontal page scrolling (weapon tables scroll inside their own box).
- Playwright runs every flow in a desktop and a 390px phone project (the pane resize test is desktop only).

## M7 - PDF export

- `GET /api/rosters/{id}/export-data`: everything the PDF needs in one payload; export presets (`/api/me/export-presets`).
- PDF built in the browser with `@react-pdf/renderer`, Atkinson Hyperlegible and IBM Plex Mono embedded, light print palette, every section on a new page, footer with list name, data version date and page x of y.
- Sections (toggle and reorder by drag or arrow buttons): summary, army and detachment rules, unit cards (never split unless taller than a page; leaders before their unit; hide untaken wargear), enhancements, stratagems grouped by phase with CP badge and When / Target / Effect / Restrictions (core and other-detachment options), phase cheat sheet ("My turn" / "Opponent's turn", inferred tags marked with a dot), keyword glossary (used terms plus one level of referenced terms).
- Export dialog: paper size, text size, include points, page estimate, presets, last-used settings remembered.
- Core rules import: FAQ and "see also" boxes left out, text right after headings kept; ability headings, section numbers and flavour text stripped from rules text.
- Checked on the real data: a 6-unit Death Guard list exports to 25 readable pages; turning sections off removes them (Playwright).

## M6 - Keywords and nested popups

- Rules text renders from linked tokens everywhere (abilities, enhancements, faction options, popups); keyword chips, weapon abilities and core abilities are clickable.
- Popup stack: floating panel anchored near the click, kept inside the viewport; terms inside the popup push onto the stack, breadcrumb (clickable), Back, Esc closes everything, depth limit 10, no duplicate consecutive entries. On narrow screens the same stack opens as a bottom sheet that can be dragged to full height.
- Plain unit and faction keywords show "no rules of its own" plus the rules in the data that mention them; missing entries say "No definition in the database yet" with an admin-only "Add definition" form (stored as an override, never generated).
- Selecting a unit expands a collapsed Details pane.
- Playwright: weapon ability, then two nested terms (3 levels), Back, breadcrumb jump and Escape.

## M5 - Desktop builder UI

- "My lists" page: create (faction grouped by allegiance, battle size), open, duplicate, delete with confirmation, legal and older-data badges.
- Builder matching the "A1 dark" mockup: header with list name (rename inline), faction and battle size, Points and DP as plain numbers, legal status pill, Export PDF button.
- Three resizable panes (min 220 / 420 / 300 px), double-click a handle to reset, collapse side panes to a rail; sizes saved in user prefs and localStorage.
- Configuration panel: battle size, faction options, detachments with DP badge and remaining budget, force disposition (only those the chosen detachments offer), show/hide options.
- Add units pane with search, role filters and role groups; roster sections by role with counts, subtotals, warlord tag, sub-lines and problem markers; details pane with size, warlord, enhancement, leader attachment, wargear counts, datasheet (stats, weapons, abilities with phase tags) and the unit's violations.
- Banner with the points diff and "Update to current data" when a list uses older data.
- Playwright: create list, add 3 units, set warlord, points update; panes resize, collapse and survive a reload. Run with `npm run e2e` against a running stack.

## M4 - Rosters + validation engine

- Rosters with detachments, entries (size, wargear, enhancement, warlord, leader attachment, order), configuration (battle size, faction options, force disposition, show/hide flags) and the data version they were built on. Users only ever see their own rosters.
- Pricing with 11th edition per-copy tiers, wargear costs and enhancement points; missing points are reported, never guessed.
- Validation rules, each its own class with valid and failing fixtures: points limit, detachment budget (with the single-detachment allowance), unique tags, datasheet limits (epic hero, battleline, dedicated transport), battleline minimum, warlord, enhancements (eligibility, upgrades, limits, one per attached unit), leader / support attachment, wargear, faction and unaligned units, legends, force disposition, faction options.
- Every mutation returns the roster with points, DP, enhancement count and all violations. Duplicate, delete, "update to current data" with a points diff, user preferences.
- Checked against the real data: a legal 1985 point Death Guard Strike Force list built through the API only.

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
