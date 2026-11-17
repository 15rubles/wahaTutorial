# Progress

Each milestone ends with tests green, this file updated, and a short demo note.

## M0 - Skeleton - DONE

- [x] npm workspaces monorepo (`packages/data`, `packages/engine`, `packages/tutorial`, `apps/web`)
- [x] TypeScript strict everywhere (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- [x] ESLint (flat config, typescript-eslint, react-hooks) and Prettier
- [x] Vitest with one project per workspace; packages tested against sources, no build needed first
- [x] Vite + React app that renders "Battle Drill"
- [x] `.gitignore` covers `data-cache/`, and `*.ros` / `*.rosz` outside `fixtures/`
- [x] `docs/progress.md`, `docs/rules-questions.md`, `docs/data-schema.md` created
- [x] `npm run lint` also fails on long dashes in any tracked file (hard rule 5)
- [x] Accept: `npm run build`, `npm test`, `npm run dev` all work from a clean clone

**Demo:** clone, `npm install`, `npm run dev`, open http://localhost:5173 and see the
"Battle Drill" title page. `npm test` runs one smoke test per workspace.

`npm run e2e`, `npm run data:sync` and `npm run data:build` exist as placeholders that print
which milestone implements them.

## M1 - Data recon and sync - DONE

- [x] Recon of Wahapedia 11th edition data (CSV export, page structure, robots.txt) written to `docs/data-schema.md`
- [x] `npm run data:sync` with rate limiting (1.1 s spacing), User-Agent, retries, ETag / Last-Modified conditional GET, manifest with sha256
- [x] robots.txt fetched first and obeyed for every URL
- [x] Accept: second run with no changes makes zero network requests; `data-cache/raw/sync-log.json` lists what changed

**Demo:** `npm run data:sync` downloads 21 CSV files plus the core rules page (24 requests, about 26 s).
Running it again prints "Nothing to do" and makes 0 requests. After 24 hours (or with
`--max-age-hours 0`) it makes 2 requests (robots.txt and Last_update.csv) and skips the rest if the
source has not changed. `--force` rechecks every file with conditional GETs.

Real run on 2026-11-17: 24 requests, all downloaded; second run 0 requests; third run with
`--max-age-hours 0` made 2 requests and skipped 22 files.

## M2 - Normalize datasheets - DONE

- [x] Zod schema for Faction, Datasheet, ModelProfile, WeaponProfile, Ability, Keyword, Stratagem, Detachment, Enhancement, RuleSection (plus Publication, DetachmentAbility, CatalogEntry)
- [x] Tolerant CSV parser (BOM, mixed line endings, trailing pipe, newlines inside fields)
- [x] `npm run data:build` writes `data-cache/normalized/` and `_report.json`; broken rows are reported, never crash
- [x] Invented fixture export (`fixtures/wahapedia/`) and its normalized output (`fixtures/normalized/`)
- [x] Accept: all 25 real factions load; 0 errors; every warning category explained; unit tests use fixtures only

**Demo:** `npm run data:build` turns the raw cache into normalized JSON in about a second:
25 factions, 1485 datasheets, 7488 weapon profiles, 0 errors, 98 explained warnings.
`npm run fixtures:build` does the same for the invented Rust Pilgrims and Glass Choir.

## M3 - Core rules tree - DONE

- [x] Core rules page parsed into a `RuleSection` tree with stable ids (`data-cache/normalized/rules.json`)
- [x] Keyword index: weapon keywords, unit keywords, shared abilities, section codes, page anchors -> rule ids (`rules-index.json`)
- [x] Rules browser in the web app (tree, search, breadcrumbs, in-page rule links), reading the local cache
- [x] Demo data mode using the invented fixture rules page
- [x] Accept: every keyword on any datasheet resolves to a rule section, is an identity keyword (faction or unit name), or is listed in `_report.json` `unresolvedKeywords`

**Demo:** after `npm run data:build`, `npm run dev` and open `#/rules`. Real build: 231 sections;
of 1087 keywords, 34 resolve to a section, 809 are identity keywords, 244 are listed as unresolved
(mostly faction sub-keywords and unit types like Infantry; the most common ones get "mentioned in"
links). Without a cache the app explains the two commands and offers demo data.

## M4 - Roster import

- [ ] Accept: invented fixture roster fully resolves; unmatched units never crash the app

## M5 - Engine core: dice and the attack sequence

- [ ] Accept: property tests for the wound chart; every implemented keyword has tests; no rule text in engine

## M6 - Engine: battlefield and phases

- [ ] Accept: scripted game between two invented armies runs to end of battle round 1 deterministically

## M7 - Web UI: playable sandbox

- [ ] Accept: import a roster and play one full turn against a dummy enemy unit

## M8 - Tutorial framework

- [ ] Accept: a 3-step demo lesson runs end to end in Playwright

## M9 - The tutorial campaign

- [ ] Accept: every lesson completes in Playwright with the fixture army; real-roster manual run noted here

## M10 - Polish

- [ ] Quick-reference mode, "What can I do now?" helper, data freshness banner, accessibility pass
