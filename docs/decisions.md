# Decisions

Every judgment call made while building Battle Drill, newest last. Each entry: context, decision, why.
The owner asked for all milestones to be built without check-ins, so these are the places to review.

## D-001 (M0) Tooling versions

Installed the current majors (TypeScript 6, Vite 8, Vitest 5, ESLint 10, React 18).
React 18 rather than 19 to keep library compatibility wide. Dev-only `npm audit` advisory in
picomatch via typescript-eslint is accepted; runtime deps are clean.

## D-002 (M0) Long dash rule enforced by a script

`scripts/check-dashes.mjs` runs as part of `npm run lint` and scans every tracked text file, not just code.

## D-003 (M1) Network access

wahapedia.ru was blocked by the default cloud environment. Created a personal environment
`wahaTutorial` that allows only `wahapedia.ru` (plus package registries).

## D-004 (M1) Git push blocked

GitHub returned 403 for the session (Claude GitHub App access). Work continues as local commits on
`claude/new-session-9qkpep`; push is retried after each milestone.

## D-005 (M1) Run TypeScript CLIs with tsx

`npm run data:sync` / `data:build` run `packages/data/src/cli.ts` through `tsx`, so no build step is
needed before syncing. The package still type-checks and builds with `tsc -b`.

## D-006 (M1) Sync freshness strategy

Hard rule 3 says a normal run makes zero network requests. `data:sync` therefore:

1. does nothing at all if the last successful sync is younger than 24 hours (`--max-age-hours`), unless `--force`;
2. otherwise fetches only `Last_update.csv`; if its timestamp is unchanged, everything else is skipped;
3. otherwise does a conditional GET (`If-None-Match` / `If-Modified-Since`) for every file.
   Requests are spaced at least 1100 ms apart (a margin over 1 req/s) and retried up to 3 times with
   backoff, because the server sometimes resets connections.

## D-007 (M1) robots.txt

Fetched before any other request in a sync, cached in the manifest like any other file, and every URL
is checked against the `User-agent: *` group (longest-match, `*` and `$` supported). The CSV export is
treated the same as HTML pages for robots purposes, which is stricter than required.

## D-008 (M1) Proxy support in the sync CLI

Node's built-in `fetch` ignores `HTTPS_PROXY`. When a proxy variable is set the CLI installs undici's
`EnvHttpProxyAgent`; with no proxy variable nothing changes.

## D-009 (M2) Parse CSV by field count, map columns by header name

Some description fields contain raw newlines, so the parser counts fields (each record ends with a
trailing `|`) instead of splitting lines. The real column order differs from the spec sheet (for
example `Stratagems.id` is the third column), so every column is read by header name.

## D-010 (M2) Shared abilities merged

`Abilities.csv` repeats an id once per faction that has the ability. These rows are merged into one
`Ability` with `factionIds: string[]` instead of being reported as duplicates.

## D-011 (M2) Lenient characteristics

A `-` characteristic means "no value" (for example OC on fortifications) and maps to a default
(OC 0, movement null, invuln null) without a warning. Anything else unparseable maps to a default
with an `unparsed-value` warning. Only structural problems are errors.

## D-012 (M2) Fixtures in the raw export shape

`scripts/make-fixtures.mjs` generates two invented factions (Rust Pilgrims, Glass Choir) as CSVs with
the real headers, BOM, trailing pipes and mixed line endings. `npm run fixtures:build` runs the real
normalizer on them into `fixtures/normalized/` (committed, fixed timestamp). Engine, web and E2E tests
use that output, so the whole pipeline is tested without any GW text.

## D-013 (M2) Two package entries

`@battle-drill/data` is browser safe (schema and pure parsers, Zod only); `@battle-drill/data/node`
has sync and the file system build.

## D-014 (M3) Rule ids

`core.` + the slug path of section titles following the dotted section codes (numbering like "1." and
the code are stripped, brackets dropped). Example: `core.attack-sequence.hit-roll`,
`core.core-abilities.lethal-hits`, `core.fight-phase.pile-in-move`. Super headers are groups:
`core.group.basic-rules`. Uncoded sub-headings hang under the previous coded section. A collision
gets the code appended. Ids depend only on titles and codes, so they survive text errata.

## D-015 (M3) Section boundaries by markers

Four marker types carry a section code: h2, h3, `div.abName` (core abilities) and `div.str11Name`
(rule boxes such as move types). Bodies are cut by string offset between markers and repaired with
node-html-parser. Tooltip templates are removed before searching for markers because they repeat
ability boxes. When a box appears before its parent section (LEADER / SUPPORT shows up in Attached
Units first), it is placed under its code parent anyway.

## D-016 (M3) Sanitizing rule HTML

Removed: scripts, styles, images, iframes, forms, tooltip wrappers, all attributes except class / href /
target / rel / colspan / rowspan. Dice face sprites become `<span class="die">N</span>`. FAQ and errata
spoilers become `<details>`. In-page links become `#rule:<id>`; other site links become absolute
https links; any non http(s) link is turned into plain text.

## D-017 (M3) Keyword resolution

Weapon keywords match core ability sections by slug. Unit keywords match a section title, its plural,
or a small alias table (our own mapping of keyword slug to section slug, for example `monster` ->
`monsters-and-vehicles`). Faction keywords and keywords equal to a datasheet name are "identity"
keywords and are not expected to have a rule. Everything else is listed in `_report.json`
`unresolvedKeywords`; for those, `rules-index.json` `mentions` lists up to 5 sections that use the
keyword, for "see also" links.

## D-018 (M3) Data served by the dev server only

A Vite plugin serves `/data/*` from `BATTLE_DRILL_DATA_DIR` (default `data-cache/normalized`) and
`/fixture-data/*` from `fixtures/normalized`. The production bundle contains no data. If the cache is
missing the app explains how to run the sync and offers the invented demo data.

## D-019 (M3) exactOptionalPropertyTypes off in the web app

It stays on for the pure packages. In React code it mostly forces `prop={x ?? undefined}` noise.
