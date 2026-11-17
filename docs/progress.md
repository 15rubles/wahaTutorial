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

## M4 - Roster import - DONE

- [x] `.ros` (BattleScribe / New Recruit XML) and `.rosz` (zipped) importer
- [x] Plain text importer for the official app and New Recruit exports (tolerant)
- [x] Resolution to datasheet, wargear, model count, enhancements, warlord, detachment; fuzzy name matching
- [x] "Fix me" screen: suggestions, datasheet search (own faction or all), remove
- [x] Accept: invented fixture rosters (`fixtures/rosters/`) resolve fully in every format; broken and garbage input never throws (unit tests), and an invented roster against the real data shows 5 fix-me entries in the browser without errors

**Demo:** `npm run dev`, open `#/import`, drop a `.ros`, `.rosz` or text export (or, in demo data
mode, click a demo roster). The army page lists every unit with models, weapons, points, warlord and
enhancement tags, and a detachment picker. Unknown units show up in "Fix me".

## M5 - Engine core: dice and the attack sequence - DONE

- [x] Seedable dice (mulberry32, state is a plain object), scripted roller for tutorials
- [x] Attack sequence as pure functions, one file per step: gather dice, hit roll, wound roll, allocation, save roll, inflict damage, mortal wounds, hazard rolls
- [x] Events for every step (`AttackDiceGathered`, `HitRolled`, `WoundRolled`, `SaveRolled`, `DamageInflicted`, `ModelDestroyed`, `HazardRolled`, `AttacksResolved`)
- [x] Weapon keyword registry with 22 modules: every keyword in the fixture army plus the common ones in the real data
- [x] Accept: fast-check property tests for the wound chart; one test per implemented keyword (enforced by a coverage test); a test fails on any prose string literal in engine code

**Demo:** engine only so far (`npm test -w @battle-drill/engine`). Mechanics follow the cached
11th edition text, for example cover worsening BS, saves resolved from the lowest roll against
allocation groups, and devastating wounds hitting one model at most. The rules appendix is now
synced and merged into the rules browser (390 sections).

## M6 - Engine: battlefield and phases - DONE

- [x] Battlefield: inches, circular bases, terrain polygons with categories, objectives, deployment zones
- [x] Measuring (edge to edge), 2" engagement, coherency, 2D line of sight with obscuring terrain, benefit of cover
- [x] Battle round, turn and phase state machine following the cached structure (07 to 12), including the 11th edition fight phase steps (pile in, fight, consolidate)
- [x] Actions: deploy, remain stationary, normal / advance / fall-back moves (desperate escape), four shooting checks, charge declare / move, pile in, normal and overrun fights, consolidation; Core CP, battle-shock, objective control, training scoring
- [x] Undo and replay from the action log
- [x] Every engine `ruleRefs` id (106) exists in the real cache
- [x] Accept: two invented armies, both played by the scripted AI, go from deployment to the end of battle round 1 in a test; same seed gives an identical game (state and action log), replay and undo reproduce it

**Demo:** engine only (`npx vitest run --project engine`). The acceptance test plays a full first
battle round between the Rust Pilgrims and the Glass Choir on the invented training ground.

## M7 - Web UI: playable sandbox - DONE

- [x] SVG battlefield: terrain (hatched when it blocks sight), objectives with range rings, deployment zones, models by player
- [x] Drag to move with a live ruler and the move's maximum enforced; weapon range rings in the shooting phase; target selection per weapon
- [x] Unit card with the full datasheet from the cache; weapon and unit keywords open the rule popup
- [x] Dice tray with roll animation (off with reduced motion) and a hit / wound / save / damage breakdown
- [x] Phase bar (round, turn, phase, CP, VP, undo, end phase) and a battle log; the opponent plays itself
- [x] Accept: Playwright imports the fixture roster and plays a full turn (move by drag, shoot, open a rule, charge, fight steps), then the opponent's turn, ending in round 2

**Demo:** import a roster, open `#/sandbox`. Your army deploys against practice dummies. Select a
unit, pick a move and drag it, shoot, charge, fight; `npm run e2e` plays a turn automatically.

## M8 - Tutorial framework - DONE

- [x] Lesson format (`Lesson`, `Step` with `ruleRefs`, `say`, `focus`, `expect`, `onWrong`, `setup`, plus `allow` and `dice`)
- [x] Pure step runner: advances on the expected action, hints on wrong or blocked input, explain again, skip, restart
- [x] Role picking from the player's army with invented stand-ins and a notice when a role is missing
- [x] Spotlight overlay: dims everything, highlights the focused elements, blocks input elsewhere
- [x] Progress saved in localStorage (try/catch), lesson list shows completed lessons
- [x] Accept: Playwright runs the 3-step demo lesson end to end (including a blocked click that produces a hint)

**Demo:** `#/learn` lists lessons; "Drill zero" walks through selecting your unit, ending the command
phase and making your first move.

## M9 - The tutorial campaign

- [ ] Accept: every lesson completes in Playwright with the fixture army; real-roster manual run noted here

## M10 - Polish

- [ ] Quick-reference mode, "What can I do now?" helper, data freshness banner, accessibility pass
