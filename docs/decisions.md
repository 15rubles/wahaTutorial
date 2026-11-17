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

## D-020 (M4) Separate roster package

`packages/roster` is pure and runs in the browser (fast-xml-parser, fflate). Parsing produces a format
independent `RosterDraft`; `resolveRoster` matches it against normalized data into a serializable
`ResolvedArmy` that stores ids only, never datasheet text.

## D-021 (M4) Matching rules

Names are normalized (case, accents, apostrophes, punctuation, `&`). Exact normalized match wins;
otherwise a similarity score (edit distance, token overlap, singular / plural) of at least 0.85
counts as a fuzzy match and adds a "check it" warning. Ties prefer the roster's faction and real
(non virtual) datasheets. Below the threshold the unit goes to the "fix me" list with up to five
suggestions. The faction comes from the roster's catalogue / header hints, else from a majority vote
of exact unit matches.

## D-022 (M4) Wargear and model counts

Roster wargear names are matched to datasheet weapon profile names (multi-profile weapons named
"Group - Profile" match "Group"). If nothing matches, every datasheet weapon is assumed and the unit
is flagged `wargearDefaulted`. Model count is the sum of model lines; compact text exports without
model lines use the datasheet cost line with the same points, else the largest wargear count.
In XML, points are the sum of `pts` costs over a selection and its children.

## D-023 (M4) Text exports

One tolerant line parser handles the official app style (title line, faction / detachment lines,
section headers, bullet model and wargear lines) and New Recruit styles (`+ KEY: value` headers,
`Char1: 1x Name (N pts): items`, `Enhancement:` lines). Battle size lines such as "Incursion (1000
points)" are configuration, not units. Unknown lines are skipped, never fatal.

## D-024 (M4) Army persistence

The resolved army is saved in localStorage (wrapped in try/catch). Datasheets are loaded per faction
file on demand.

## D-025 (M5) Rules appendix and glossary

The core rules page refers to many numbered sub-rules (for example 02.02.01 Modifiers) that live on
`/wh40k11ed/the-rules/rules-appendix/` (allowed by robots.txt). `data:sync` now fetches that page too.
Its coded sections are merged into the tree by code, with their sub-headings. Codes still missing
are filled from the glossary tooltips at the bottom of the core page. Real build: 390 sections.

## D-026 (M5) Engine choices where a player would choose

The engine needs a default whenever the rules let a player decide. All are deterministic and can be
overridden later through the attack context:

- Lethal hits: auto wound, except when the weapon also has devastating wounds or an applicable anti
  (then the attacker rolls to wound, looking for critical wounds).
- Twin-linked: re-roll failed wound rolls only.
- Psychic: ignore harmful hit / BS modifiers, keep helpful ones.
- Allocation order ties (defender's choice): keep the unit's model order. Precision: pick the first
  visible CHARACTER.
- Random A is rolled per weapon copy; random D is rolled when a model is selected, as 02.02.03 says.

## D-027 (M5) Engine depends on data types only

`packages/engine` imports types (no runtime code) from `@battle-drill/data` to map datasheets to
units. Keyword behaviour is a registry of modules, one per keyword, each exporting `ruleRefs`.
Keywords the engine does not simulate are reported by `unimplementedKeywords()` so the UI can say so.

## D-028 (M6) Engine API

One entry point: `apply(state, action) -> { ok, state, events } | { ok: false, error }`. Errors are
codes (`TOO_FAR`, `NOT_VISIBLE`...) that the tutorial turns into hints. Dice come from `state.rng`, or
from a scripted roller passed in (tutorials). History is `{ initial, actions }`; undo replays all but
the last action. The game log lives in the state.

## D-029 (M6) Battlefield simplifications

- Flat 2D board in inches; models are circles; vertical distances are ignored.
- Moves are straight lines from start to end per model (rotation is free); the path is checked for
  enemy bases and for dense terrain.
- Dense terrain: INFANTRY / BEASTS / SWARM / MOBILE models may cross it; other models may not (there
  are no heights, so every dense feature is treated as taller than 2").
- Line of sight: 25 lines between the centre and four edge points of each base. Obscuring areas
  (light or dense) block unless one of the two models is inside. Models never block line of sight
  (`MODELS_BLOCK_LOS = false`). Solid, Hidden, Plunging Fire and FRAME are not simulated.
- Not simulated yet: strategic reserves, transports, attached units, aircraft, indirect shooting,
  stratagems (M9 adds the stratagem layer for lessons), actions, secured objectives.

## D-030 (M6) Training mission

Missions are GW content, so games use an invented "Training Drill": 5 battle rounds, the first player
fixed, VP equal to 5 per objective you control at the end of your turn. The training ground board
(44" x 30", three objectives, a ruin, low walls, craters) is invented too.

## D-031 (M6) Scripted opponent lives in the engine

`nextAiAction(state, player)` is pure and deterministic. It proposes candidate actions in a fixed order
and returns the first one `apply` accepts, so it can never break the rules. It drives the M6 acceptance
test (both sides) and will be the M9 opponent.
