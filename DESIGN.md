# Muster - Warhammer 40k Army Builder (11th Edition)

Design document for Claude Code. Build it **one milestone at a time**. At the end of each milestone: run all tests, show me what changed, list anything you could not finish, and **stop and wait** for me before starting the next one.

---

## 0. Ground rules for Claude Code

1. **Never invent game data.** No made-up points, stats, rules text, keyword definitions or phase tags. All game data comes from the importers (section 5) or from the admin editor. If data is missing, show an explicit "missing data" state in the UI, never a guess.
2. **The repo is private, and game data files never get committed.** Imported source files (`.gst`, `.cat`, PDFs, Wahapedia CSV/HTML) live in `./data-sources/`, which is in `.gitignore`. The database is the only place game data lives.
3. **Validation in depth.** Validate every request on the backend (Bean Validation + explicit domain checks). Prefer typed results and robust parameter validation over loose conditionals. No `null` soup: use `Optional`, records and enums.
4. **Tests are part of the milestone.** Backend: JUnit 5 + Testcontainers (Postgres). Frontend: Vitest + React Testing Library, plus Playwright for the key flows from M5 onwards.
5. **No long dashes anywhere** in UI copy, PDF output, docs or code comments. Use a regular hyphen `-`.
6. When something in this doc is ambiguous or conflicts with what you find in the data, **ask me** instead of deciding silently.
7. Keep a `CHANGELOG.md` with one short entry per milestone.

---

## 1. What this app is

A private army list builder for Warhammer 40,000 11th Edition, for me and a few friends. It runs in the browser on desktop and mobile, stores everything in a backend database, and works from any device after login.

**The four things that make it worth building** (every other builder fails at least one):

1. A comprehensive **PDF export** with per-section settings.
2. **Resizable panes** in the desktop builder (Add units / List / Details).
3. **Clickable keywords** everywhere. Each one opens a popup with its rules, and keywords inside that popup are clickable too (nested navigation).
4. A calm, readable **dark pastel UI** (section 7). No eye-searing colors, no walls of text.

**Out of scope for now:** collection tracking ("what I own"), light mode, battle tracker, Google sign-in, public sharing.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Backend | Java 21, Spring Boot 3.x, Spring Web, Spring Security, Spring Data JPA, Bean Validation |
| DB | PostgreSQL 16, Flyway migrations |
| Import tooling | Jackson / StAX for BattleScribe XML, Apache PDFBox for the Munitorum Field Manual, Jsoup for Wahapedia HTML (only if CSV is not available) |
| Frontend | React 18 + TypeScript (strict) + Vite |
| Frontend libs | TanStack Query (server state), React Router, `react-resizable-panels` (panes), `@react-pdf/renderer` (PDF), Zustand (UI state only) |
| Styling | CSS modules + one `tokens.css` file with design tokens (section 7). No Tailwind, no component library. |
| Run / deploy | Docker Compose: `db`, `backend`, `frontend` (static build served by Caddy), Caddy as reverse proxy with HTTPS on my home server |

Monorepo layout:

```
/backend        Spring Boot app
/frontend       React app
/data-sources   gitignored, raw import files
/docker         compose files, Caddyfile
DESIGN.md       this file
CLAUDE.md       short pointer: "Read DESIGN.md. Current milestone: Mx."
```

---

## 3. Users and auth

- **Regular register / login only** (no Google). Username + email + password.
- **Invite-only registration**: registering requires an invite code. Admins create single-use invite codes in the admin page. This keeps it to me and friends.
- Passwords hashed with BCrypt (Spring Security default encoder).
- **Session-based auth** with an HttpOnly, Secure, SameSite=Lax cookie (Spring Session JDBC so sessions survive restarts). CSRF protection on for all state-changing requests.
- Roles: `USER`, `ADMIN`. The first admin is created from env vars on first startup (`ADMIN_USERNAME`, `ADMIN_PASSWORD`).
- Login rate limiting: lock an account for 15 minutes after 10 failed attempts in a row.
- Every roster belongs to one user. Users only see their own rosters. Game data is shared by everyone and read-only for `USER`.

---

## 4. Domain model

All game data tables carry `data_version_id` (which import produced them) and `source` (`BATTLESCRIBE`, `WAHAPEDIA`, `MFM`, `MANUAL`).

### Game data

- **Faction**: id, name, parent faction (for chapters, sub-factions), allegiance (Imperium / Chaos / Xenos).
- **ArmyRule**: faction, name, rules text.
- **FactionOption**: faction-wide choices made in configuration (example: Code Chivalric for Imperial Knights). Name, list of allowed values with rules text.
- **Datasheet**: faction, name, role (Character, Battleline, Infantry, Vehicle, Monster...), keywords, faction keywords, stat lines (M, T, SV, invuln, W, LD, OC; some units have several profiles), legends flag.
- **UnitSizeOption**: datasheet, model count, points.
- **Weapon**: datasheet, name, type (ranged / melee), range, A, BS/WS, S, AP, D, weapon abilities (as keyword references).
- **WargearOption**: datasheet, option group, constraints (min / max / per N models), points delta if any.
- **Ability**: datasheet or detachment or army rule, name, rules text, phases, timing.
- **Detachment**: faction, name, DP cost, unique tag(s), detachment rule text, restrictions.
- **Enhancement**: detachment, name, points, eligibility (keywords required / forbidden), rules text, phases, timing.
- **Stratagem**: detachment or core, name, CP cost, category, phases, timing, structured fields `when`, `target`, `effect`, `restrictions`.
- **BattleSize**: name (Incursion, Strike Force...), points limit, detachment point budget, other limits. Stored as data and editable in the admin page. Do not hardcode these numbers.
- **ForceDisposition**: name, rules text (shown in configuration).
- **GlossaryEntry**: the source for keyword popups. `term`, `aliases[]`, `kind` (`CORE_ABILITY`, `WEAPON_ABILITY`, `UNIT_KEYWORD`, `FACTION_KEYWORD`, `RULE_TERM`), `text` (rules text, may be empty for plain unit keywords), `see_also[]`.
- **DataVersion**: id, created_at, created_by, source files used, import report (JSON), status (`DRAFT`, `ACTIVE`, `ARCHIVED`).
- **ManualOverride**: entity type + entity id + field + value + note. Overrides are applied on top of every import, so a re-import never wipes my hand fixes.

### Phases and timing

```java
enum Phase { COMMAND, MOVEMENT, SHOOTING, CHARGE, FIGHT, ANY }
enum Timing { YOUR_TURN, OPPONENT_TURN, EITHER_TURN, PRE_GAME, ANY }
```

Phases and timing on abilities, enhancements and stratagems are filled like this:

1. From a structured source field if the source has one (Wahapedia stratagem phase column, for example).
2. Otherwise from a **phase inference parser** that scans the rules text for phrases like "your Shooting phase", "the Fight phase", "your opponent's Movement phase", "start of the battle". Its result is marked `inferred = true`.
3. The admin page lists every `inferred` or empty phase tag so I can confirm or fix it (stored as a ManualOverride).

### User data

- **User**: username, email, password hash, role, created_at.
- **InviteCode**: code, created_by, used_by, expires_at.
- **Roster**: owner, name, faction, battle size, faction option value, force disposition, show/hide flags (legends, unaligned forces, unaligned fortifications, and any others the data defines), `data_version_id` it was built on, created_at, updated_at.
- **RosterDetachment**: roster, detachment (1 to N, limited by the DP budget).
- **RosterEntry**: roster, datasheet, unit size option, chosen wargear, enhancement (optional), warlord flag, attached-to entry (for leaders), sort order.
- **ExportPreset**: owner, name, PDF settings JSON (section 9).
- **UserPrefs**: owner, pane sizes, last opened roster.

---

## 5. Data pipeline (admin only)

Game data is pulled **once into our own DB**, then refreshed by the admin when GW publishes updates. The running app never fetches game data from anywhere.

### 5.1 Importers

1. **BattleScribe importer**: admin uploads a `.zip` with one `.gst` plus `.cat` files. Parse `selectionEntries`, `entryLinks`, `profiles` (Unit, Weapon, Abilities), `rules`, `categoryLinks`, `costs`, `constraints`, `modifiers`. Map them to the domain model and keep the original BattleScribe ids in a `external_ids` column for re-imports.
2. **Wahapedia importer**:
   - First check whether Wahapedia offers a **CSV data export** for 11th Edition (it had one for 10th). If yes, use the CSVs (datasheets, abilities, stratagems, detachments, enhancements, keywords, core rules). This is the preferred path.
   - Only if there is no CSV export: an HTML scraper with Jsoup. Requirements: identify the app with a clear User-Agent, at most 1 request per second, cache every fetched page in `./data-sources/wahapedia-cache/` and never re-fetch a cached page unless I press "refresh". The scraper only runs when an admin triggers it.
   - Wahapedia is also the main source for **GlossaryEntry** (core rules, core abilities, weapon abilities, keyword definitions).
3. **Munitorum Field Manual importer**: admin uploads the official MFM PDF. Parse it with PDFBox into `(faction, unit name, model count, points)` rows and enhancement points. Match units to datasheets by normalized name. Anything unmatched goes into the import report, never silently dropped.

### 5.2 Merge rules (field priority)

| Field | Priority (highest first) |
|---|---|
| Points (units, enhancements) | Manual > MFM > Wahapedia > BattleScribe |
| Stats, weapons, abilities text | Manual > Wahapedia > BattleScribe |
| Detachments, DP cost, stratagems, enhancements | Manual > Wahapedia > BattleScribe |
| Wargear option constraints | Manual > BattleScribe > Wahapedia |
| Glossary | Manual > Wahapedia > BattleScribe shared rules |

### 5.3 Import flow

1. Every import creates a `DRAFT` DataVersion.
2. The admin page shows an **import report**: counts per faction, new / changed / removed units, points changes (old -> new), unmatched rows, phase tags that need review.
3. The admin presses "Activate". The previous version becomes `ARCHIVED`.
4. Rosters keep their `data_version_id`. When a roster is opened on an older version, show a banner: "Points changed since this list was built" with a diff, plus a button "Update to current data".

### 5.4 Admin data editor

A simple admin page to browse every faction and edit any field of datasheets, detachments, stratagems, enhancements, glossary entries and phase tags. Every edit is stored as a ManualOverride with a note.

---

## 6. Validation engine (backend)

Each rule is its own class:

```java
public interface RosterRule {
    List<Violation> check(Roster roster, GameData data);
}

public record Violation(Severity severity, String code, String message, List<Long> entryIds) {}
public enum Severity { ERROR, WARNING, INFO }
```

Rules to implement (the limits come from data, never hardcoded):

- `PointsLimitRule`: total points vs. battle size limit.
- `DetachmentBudgetRule`: total DP cost vs. battle size DP budget, and min 1 detachment.
- `DetachmentUniqueTagRule`: two detachments can't share a unique tag.
- `DatasheetLimitRule`: per-datasheet max copies for this battle size (from data).
- `BattlelineRule`: battleline requirements if the data defines them.
- `WarlordRule`: exactly one warlord, must be a CHARACTER.
- `EnhancementRule`: eligibility keywords, one per character, no duplicates, comes from a selected detachment.
- `LeaderAttachmentRule`: leaders only attach to units their datasheet allows.
- `WargearRule`: wargear constraints per unit size.
- `FactionKeywordRule`: units must share the army faction (allies handled by data-defined exceptions).
- `LegendsRule`: legends units only when the show/hide option allows it.

Every roster mutation (`PATCH /api/rosters/{id}/...`) returns the updated roster **plus** points total, DP total and the full violation list, so the UI updates in one round trip. Each rule gets its own unit tests with valid and invalid fixtures.

---

## 7. Visual design (dark pastel, approved mockup "A1 dark")

Mockup: https://claude.ai/artifact/Fr9skBUcoUo6frzd7hwKSd (artboard "A1 dark"). Match it.

### 7.1 Tokens (`frontend/src/styles/tokens.css`)

```css
:root {
  /* surfaces */
  --bg: #333333;            /* page background */
  --panel-side: #2f2f2f;    /* left and right panes */
  --panel: #3a3a3a;         /* header, cards, roster sections */
  --raised: #404040;        /* inputs, stat boxes, tables */
  --row-head: #444444;      /* config label rows, table heads */
  --border: #4a4a4a;
  --divider: #424242;
  --border-strong: #555555;

  /* text */
  --text: #f0eeea;
  --text-muted: #bdbab4;
  --text-body: #e0ddd8;     /* long rules text */

  /* pastel accents */
  --sage: #a8c3a0;          /* primary action, legal, selected */
  --sage-ink: #1f2d1b;      /* text on sage */
  --sage-tint: #3f4a3e;
  --sage-text: #d3e6ca;
  --lilac: #cdc1ea;
  --lilac-tint: #47425a;    /* Characters section, detachment */
  --lilac-chip: #4a4560;    /* keyword chips, DP badge */
  --lilac-text: #e2daf6;
  --peach-tint: #52433b;    /* Infantry section */
  --peach-text: #f7d9c4;
  --butter: #f3e3a6;        /* Warlord tag */
  --butter-ink: #3d3210;
  --warn-bg: #54423a;
  --warn-border: #8a6650;
  --warn-text: #fae3d3;

  /* type */
  --font-ui: "Atkinson Hyperlegible", system-ui, sans-serif;
  --font-num: "IBM Plex Mono", ui-monospace, monospace;
  --radius-s: 6px;
  --radius-m: 10px;
  --radius-l: 12px;
}
```

Rules: body text 15px, line-height 1.5 or more for rules text. All numbers (points, stats, CP, DP) use `--font-num`. Text contrast at least 4.5:1. Section colors map to unit roles (Characters lilac, Battleline sage, Infantry peach; pick muted tints for other roles in the same style). No gradients, no glow, no emoji, no side-stripe cards except the selected-row marker.

### 7.2 Desktop layout (>= 1024px)

```
| Header: list name, faction, Points [total] / [limit], DP [used] / [budget], legal status pill, Export PDF |
|----------------|--------------------------------------|---------------------|
| Add units      | Configuration panel (collapsible)    | Details (inspector) |
| search         | Roster sections by role              | selected unit       |
| filters        |                                      |                     |
| unit list      |                                      |                     |
```

- **No progress bars** in the header. Points and DP are plain numbers.
- **The three panes are resizable** with drag handles (`react-resizable-panels`). Min widths: Add 220px, List 420px, Details 300px. Double-clicking a handle resets to default. Each pane can be collapsed to a thin rail. Sizes are saved in UserPrefs (and localStorage as a fast cache).
- **Configuration panel** at the top of the List pane, styled like the mockup: each option has a label row (gear icon + label on `--row-head`) with the current value on the row below, and a "Change" button that opens an inline editor. Options:
  1. Battle Size
  2. Faction option (only if the faction has one, example: Code Chivalric)
  3. Detachment(s), with a badge "[n] Detachment Points" and the remaining budget
  4. Force Disposition
  5. Show/Hide Options (legends, unaligned forces, unaligned fortifications, plus any others from data)
- **Roster sections** grouped by role, with a header row (role name, count, subtotal) and rows for entries (name, warlord tag, wargear / enhancement / "leading X" sub-line, points right-aligned). An empty required section shows a warning row.
- **Add units pane**: search, role filters, units grouped by role, points shown, a "+" button per unit.
- **Details pane**: name, keyword chips, stat grid, weapons table, abilities (bold name + phase/timing tag + text), enhancement picker, warlord toggle, leader attachment picker, and the violations that concern this unit.

### 7.3 Mobile layout (< 1024px)

- Bottom tab bar: **Add** / **List** / **Details**. Selecting a unit in List switches to Details. Points and DP stay in a compact sticky header.
- Configuration panel collapsed by default, shown as the first card in List.
- Keyword popups become **bottom sheets** (section 8).
- Touch targets at least 44px. No horizontal scrolling except weapon tables, which scroll inside their own box.
- Test at 390px wide (iPhone) and 768px (tablet).

---

## 8. Clickable keywords and nested popups

- Every keyword chip, weapon ability (like "Lethal Hits", "Sustained Hits 1"), core ability (like "Deep Strike", "Feel No Pain 5+") and rule term found in any rules text is a **clickable link**.
- **Linking** happens on the backend at import time: a `RulesTextLinker` scans every rules text for glossary terms and aliases (longest match first, case-insensitive, whole words, handles parameters like "Sustained Hits 2" -> "Sustained Hits") and stores the text as tokens: `[{type:"text", value}, {type:"ref", glossaryId, label}]`. The frontend renders tokens, never raw HTML.
- **Popup behavior (desktop)**: a floating panel anchored near the click. It shows the term, its kind, its rules text (itself tokenized, so terms inside it are clickable) and "see also" links. Clicking a term inside the popup **pushes** it onto a popup stack: a breadcrumb at the top (`Lethal Hits > Critical Hit`), a Back button, Esc closes everything. Stack depth limit 10, no duplicate consecutive entries.
- **Mobile**: the same stack in a bottom sheet that can be dragged up to full height.
- **Plain unit keywords** (like INFANTRY) often have no rules text. Then the popup shows "Unit keyword, no rules of its own" plus the list of rules in the loaded data that reference this keyword (reverse index built at import), so it's still useful.
- Missing glossary entry: show "No definition in the database yet", with an admin-only "Add definition" button. Never generate text.

---

## 9. PDF export

Generated in the browser with `@react-pdf/renderer` from the same roster data, one click, downloads a file. Fonts are embedded (Atkinson Hyperlegible + IBM Plex Mono). The PDF uses a **light, print-friendly version** of the same pastel palette (white paper, the same lilac / sage / peach tints for section headers, dark text).

### 9.1 Export dialog

Opens from "Export PDF". Left side: section toggles and options. Right side: page count estimate. A "Save as preset" button stores the settings (ExportPreset). The last-used settings are remembered.

Global options: paper size (Letter / A4), text size (normal / large), include points (on/off, for casual games).

### 9.2 Sections (each can be toggled on/off, and reordered by drag)

1. **Summary**: list name, faction, battle size, points, DP, detachments, faction option, force disposition, warlord, enhancements, and a compact unit list with points.
2. **Army and detachment rules**: army rule(s) + each selected detachment's rule.
3. **Unit cards**: one card per roster entry, never split across pages. Stat grid, weapons table, abilities with bold names and phase tags, keywords, chosen wargear and enhancement. Options: put leaders right before the unit they lead / hide wargear options not taken.
4. **Enhancements**: the chosen enhancements with full text.
5. **Stratagems**: grouped by phase. Card layout with CP cost badge and separate When / Target / Effect / Restrictions lines. Options: include core stratagems (on/off) / include stratagems of detachments not selected (off by default).
6. **Phase cheat sheet**: for each phase (Command, Movement, Shooting, Charge, Fight), two columns "My turn" and "Opponent's turn", listing every ability, enhancement and stratagem in this army that acts there, with the unit name. Built automatically from the phase and timing tags. Entries with `inferred` tags are marked with a small dot so I know to double-check them.
7. **Keyword glossary**: only terms that appear in this army's units, abilities and selected stratagems, **plus the terms their definitions reference** (one level deep), alphabetical.

Page footer: list name, data version date, page x of y. Every section starts on a new page.

---

## 10. API sketch

```
POST   /api/auth/register            {username, email, password, inviteCode}
POST   /api/auth/login               {username, password}
POST   /api/auth/logout
GET    /api/me

GET    /api/factions
GET    /api/factions/{id}/datasheets?role=&q=
GET    /api/factions/{id}/detachments
GET    /api/datasheets/{id}
GET    /api/glossary/{id}
GET    /api/glossary/search?q=
GET    /api/battle-sizes

GET    /api/rosters
POST   /api/rosters
GET    /api/rosters/{id}             roster + totals + violations
PATCH  /api/rosters/{id}/config      battle size, faction option, force disposition, show/hide
PUT    /api/rosters/{id}/detachments
POST   /api/rosters/{id}/entries
PATCH  /api/rosters/{id}/entries/{entryId}
DELETE /api/rosters/{id}/entries/{entryId}
GET    /api/rosters/{id}/export-data everything the PDF needs in one payload
POST   /api/rosters/{id}/duplicate
DELETE /api/rosters/{id}

GET/PUT /api/me/prefs
GET/POST/DELETE /api/me/export-presets

ADMIN:
POST   /api/admin/invites
POST   /api/admin/imports/battlescribe   (multipart zip)
POST   /api/admin/imports/wahapedia      (CSV zip, or trigger scrape)
POST   /api/admin/imports/mfm            (multipart pdf)
GET    /api/admin/data-versions/{id}/report
POST   /api/admin/data-versions/{id}/activate
GET    /api/admin/review/phase-tags
PUT    /api/admin/overrides
```

All errors use one JSON shape: `{code, message, fieldErrors[]}`.

---

## 11. Milestones

Each milestone ends with: tests green, a short demo note of how to try it, and a stop.

### M0 - Scaffold
- Monorepo, Docker Compose with Postgres, Spring Boot app with Flyway and `/api/health`, Vite + React + TS app with routing and `tokens.css`, fonts loaded.
- `CLAUDE.md` pointing to this doc. `.gitignore` covers `data-sources/`.
- **Done when:** `docker compose up` starts everything, and the frontend shows an empty dark-pastel shell that calls `/api/health`.

### M1 - Auth
- Register (with invite code), login, logout, session cookie, CSRF, rate limiting, admin bootstrap from env, admin page to create invite codes.
- Frontend: login and register pages in the app's style, auth guard on routes.
- **Done when:** I can create an invite as admin, register a second user with it in another browser, and each user sees only their own (empty) roster list.

### M2 - Domain model + BattleScribe importer
- All game data tables + Flyway migrations. DataVersion and ManualOverride.
- BattleScribe importer + import report + activate flow.
- **Done when:** importing a BattleScribe zip loads every faction in it, and the report shows counts. Test with Death Guard first, then all factions in the zip.

### M3 - Wahapedia + MFM importers, merge, admin editor
- Check for the Wahapedia 11th Edition CSV export first; scraper only as fallback (rules in 5.1).
- MFM PDF importer, merge rules from 5.2, phase inference parser, RulesTextLinker + glossary reverse index.
- Admin pages: data browser/editor, phase tag review, version activation with diff.
- **Done when:** Death Guard, Orks and Imperial Knights datasheets have stats, weapons, abilities, detachments, stratagems with phases, current MFM points, and glossary entries. The report lists every unmatched or inferred item.

### M4 - Rosters + validation engine
- Roster CRUD, entries, detachments, config, all rules from section 6 with unit tests, totals + violations in every mutation response.
- **Done when:** the API alone can build a valid 2000-point Death Guard list, and each rule has a failing fixture that produces the right violation.

### M5 - Desktop builder UI
- Header, three resizable panes with saved sizes, configuration panel, Add units pane, roster sections, Details pane, inline violations. Matches the "A1 dark" mockup.
- Roster list page (my lists, create, duplicate, delete).
- **Done when:** I can build a full list with the mouse only, resize and collapse the panes, reload, and everything (list + pane sizes) is still there. Playwright test covers "create list -> add 3 units -> set warlord -> see points update".

### M6 - Keywords and nested popups
- Token rendering everywhere rules text appears, keyword chips clickable, popup stack with breadcrumb / back / Esc, reverse-index fallback for plain keywords.
- **Done when:** clicking a weapon ability in the Details pane opens its rules, clicking a term inside that popup opens the next one, and Back returns. Playwright test covers a 3-level chain.

### M7 - PDF export
- Export dialog with all toggles and options from section 9, presets, PDF document with all 7 sections, page breaks that never split a card.
- **Done when:** exporting my Death Guard list with everything on gives a readable PDF where the phase cheat sheet and glossary are filled from data, and turning sections off removes them.

### M8 - Mobile
- Tabs layout, sticky header, bottom-sheet popups, mobile export dialog.
- **Done when:** the M5 and M6 Playwright flows also pass in a 390px-wide viewport.

### M9 - Deploy and hardening
- Caddy with HTTPS on the home server, production compose file, nightly `pg_dump` backups with 14-day retention, healthchecks, structured logs.
- Import every faction in the data and fix what the reports flag.
- **Done when:** my friends can register with invite codes from their own phones, and a backup restore has been tested once.

---

## 12. Later (not now)

Collection tracking and an "only what I own" filter, light mode toggle, battle tracker, roster sharing links between users, list comparison, text export in tournament format.
