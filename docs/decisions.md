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

## D-032 (M7) Sandbox design

- The enemy is an invented "Practice Dummies" unit (5 models, T4 Sv5+ W2, a weak melee weapon), so the
  sandbox only needs the player's own army. Both sides are auto-deployed by the scripted deployment.
- Units move as a whole: dragging translates every model by the same offset, clamped to the move's
  maximum. Per model placement is supported by the engine but not by the UI yet.
- Charges, pile ins and consolidations use engine helpers that compute positions (`closeTo`,
  `stepModelsToward`); the player picks the target, the helper places the models, the engine
  validates.
- Whenever the game waits on the opponent (their turn, their pile in, their fights), the scripted AI
  acts immediately. Undo rewinds to the player's previous decision.
- Clicking a unit selects it; clicking empty board deselects (a toggle on click fought with dragging).
- Colours use the Okabe-Ito palette (blue / vermillion for the players, yellow for objectives).

## D-033 (M7) Playwright

`@playwright/test` is pinned to the version of the browsers available here (1.63.0). E2E runs the dev
server with `BATTLE_DRILL_DATA_DIR=fixtures/normalized` and the demo data source, so no GW data is
needed. On a new machine run `npx playwright install chromium` once.

## D-034 (M8) Tutorial framework shape

- Lessons are TypeScript objects (`packages/tutorial/src/lessons/`). Steps hold our own short `say`
  text with `{role}` tokens (replaced by the player's unit names) and `ruleRefs`; the overlay shows the
  cached rule text under each step ("Explain again" opens them all).
- `expect` is one of: press Next, a UI signal (unit selected, rule opened), or an engine event with an
  optional predicate. The runner is a pure reducer; progress is `{ completed, current }` in
  localStorage behind try/catch.
- Blocking: a capture-phase listener cancels pointer and click events outside the focused elements,
  the tutorial box and the rule popup, and turns the attempt into a hint. Steps can also restrict
  engine actions (`allow`) and force dice (`dice`); forced dice are stored in the history so undo and
  replay stay exact.
- Roles (`character`, `fast`, `shooter`, `melee`) are picked from the army by simple scores, scarce
  roles first, distinct units where possible. Missing roles use invented stand-ins and the lesson says
  so. Enemies in lessons are invented (`Practice Dummies`, `Sparring Partners`).
- Lesson boards reuse the training ground without deployment zones; units start already placed.

## D-035 (M9) Stratagems

The engine's `useStratagem` action spends CP and enforces the 15.01 limits (same stratagem once per
phase per player, one stratagem per unit per phase, no battle-shocked own targets). Effects are not
simulated: the card text from the cache is shown and the player applies it. Timing (`turn`, `phase`)
is shown on the card but not enforced, because it is free text in the data. Core stratagems are the
ones with no faction and a type starting with "Core".

## D-036 (M9) Lesson extensions

- `near`: place a unit a set edge to edge gap from another (engaged, or a guaranteed charge), whatever
  the base sizes of the player's units.
- `free` steps: no dimming or blocking (playing a battle round, graduation).
- `army: 'full'` lessons use the whole army against invented enemies, from deployment or
  auto-deployed; `battleRounds`, `startCp` and side `panels` (stratagems, army rules) per lesson.
- `npm run rules:check` verifies every engine and lesson rule id against the local cache (180 refs,
  all resolve on the real data).
- E2E can run against your own cache: `E2E_DATA=cache E2E_ROSTER=/path/roster npm run e2e`.

## D-037 (M10) Polish choices

- Quick reference: a "Quick rules" drawer in the header on every page (search + rule view).
- "What can I do now?": engine `legalActions(state, unitId)` returns option codes; the web app words
  them. Lesson 10 points to it.
- Freshness banner when the cache is older than 30 days (`meta.json` `rawFetchedAt`); never for demo data.
- Keyboard: Tab to a unit, Enter selects; in the movement phase arrow keys nudge the pending move by 1"
  (clamped to the move's limit), Enter confirms, Escape cancels or deselects.
- Accessibility: axe checks (no serious or critical findings) on home, rules, army, sandbox and a
  lesson. The battlefield SVG is a `group` of unit buttons; warning text uses a darker vermillion.
- `npm run check:no-gw-text` compares 8-word sequences of every tracked file with the raw cache
  (headings, CSV headers, rule ids and number runs excluded). It found three engine comments and two
  doc lines worded too close to the rules; they were rewritten, plus template wording in a fixture
  column. Now clean.

## D-038 Docker

One image (node:22-slim) installs, builds and serves with `vite preview` (which keeps the `/data`
plugin). The rules data is downloaded at container start into a named volume, never baked into the
image, so the image itself holds no GW content. Restarts make no requests thanks to the sync freshness
window. If the sync fails the app still starts with demo data. The container runs as the `node` user.
An optional `ca` build secret supports TLS-intercepting proxies.

## D-039 Docker on Windows checkouts

Git on Windows can check files out with CRLF, which turns the entrypoint's shebang into `/bin/sh\r`
("exec docker/entrypoint.sh: no such file or directory"). Fixed three ways: `.gitattributes` forces
LF (raw fixtures excluded, they keep their exact bytes), the image strips CR from the script, and the
entrypoint runs through `sh` so the shebang is not used. Compose no longer restarts a failing
container in a loop.

## D-040 UI redesign: datasheet style and unit-type pieces

The app now follows the look of printed datasheets: dark top bar, red title bands, white stat boxes,
olive section bars, grid paper, condensed headings (Barlow / Barlow Condensed, bundled via
@fontsource so it works offline). No Games Workshop logos, icons or artwork are used: section icons
and all piece art are our own simple shapes. Game pieces are chosen per unit TYPE from keywords
(character, infantry, mounted, walker, vehicle, monster, beast, swarm, aircraft, fortification,
practice target), so every faction is covered without per-model art; the rim colour shows the side.
Single light theme on purpose (it reads like a printed sheet). No data, engine or lesson changes.

## D-041 Attached units

`attachUnits` (engine) merges leader and bodyguard units into one `UnitState`: bodyguard models first,
then leaders, each model tagged with `attachedRole`; keywords are the union, core abilities the
intersection (so Deep Strike only applies when every part has it); a leader weapon whose name clashes
with a different bodyguard profile is renamed `Name (Leader)`. `components` remembers each part so the
UI can draw each model with its own piece and show one datasheet card per part. Wound rolls use the
bodyguard Toughness while a bodyguard model is alive, and keyword checks (anti-X, conditions) use only
parts with living models, as the cached FAQ on attached unit keywords says. Attachments are stored on
the army (`ResolvedArmy.attachments`, leader key to bodyguard key), suggested on import from the
datasheet leader lists, and editable on the Army page. The sandbox and full-army lessons use attached
units; role lessons use units on their own, except the new leaders lesson.

## D-042 Strategic reserves and Deep Strike

Units can be placed in reserves during deployment (`placeInReserves`) and arrive with an `ingress`
move from battle round 2, as read from the cached rules: wholly within 6" of an edge, more than 8"
from every enemy, not in the enemy deployment zone before round 3, or anywhere more than 8" away with
Deep Strike. Units still in reserves at the end of battle round 3, or at the end of the battle, are
destroyed. Core abilities (Deep Strike, Leader and a few others) are derived from datasheet ability
names into `UnitState.abilities`. In the UI, units in reserves are listed in the action panel; selecting
one in the movement phase shows the legal arrival area and a click on the board sets it up. The
invented fixture Gutter Marksman gained an invented Deep Strike ability for tests.

## D-043 Lesson text with the player's unit details

Lesson text can use `{role.fact}` tokens (facts.ts), for example `{shooter.rangedWeapon}`,
`{leader.bodyguard}` or `{deepStriker.arrival}`, so explanations name the player's own weapons and
units. Every fact always has a value, so text never shows a raw token. Two new lessons were added
before the full battle round: 9. Leaders and bodyguards, 10. Reserves and Deep Strike (new roles
`leader` and `deepStriker`, with invented stand-ins when the army has none). The old lessons 9 and 10
are now 11 and 12. Lessons can start in a later battle round (`startRound`) and with units in reserves.

## D-044 Charge proximity check (RQ-4)

The charge move now checks the two "if it can, it must" requirements from the cached rule, in order:
within 1" of a charge target, then engaged. "Can" is approximated per model by trying spots around
each target model at 14 angles; a spot counts only if it is on the board, outside terrain areas, free
of other bases, keeps the unit coherent and is within the charge roll in a straight line. This never
demands a placement that does not exist, but it can miss one (a curved path around terrain), so it is
on the lenient side. A greedy helper (`chargePositions`) packs models into such spots; the AI and the
UI charge buttons use it. Measured on the real cache: the AI completed the same number of charges with
the check on as off.

## D-045 Indirect shooting and one-shot weapons

Both keywords were registered but their flags were not read anywhere, so they counted as simulated
while doing nothing. Now: indirect shooting is a fourth shooting type (unengaged, did not advance,
has an indirect fire weapon). Its indirect fire weapons may target units no model can see, those
attacks always give the target cover, and unmodified hit rolls of 1-5 fail (1-3 when the unit remained
stationary and a friendly unit sees the target), through a new `hitFailsUpTo` in the attack context.
Other weapons still need visible targets. One-shot weapons are recorded on the unit
(`spentWeapons`) when fired and cannot be selected again that battle. Every weapon ability still
unsimulated in the real cache is one the core rules do not define (the most common is on 9 weapons);
those stay marked "not simulated" on the datasheet.

## D-046 Transports

Embarked units keep `embarkedIn` in their status across turns and have no model positions, like units
in reserves. Units can start embarked during deployment, embark after a normal, advance or fall back
move with every model within 3", and disembark in the movement phase as a `disembark` move: rapid when
the transport made a normal or ingress move (no charge after), tactical when it has not moved or stayed
still (the unit may then make a normal or advance move), not at all after an advance or fall back.
When a transport is destroyed, `apply` makes an emergency disembark for its passengers before
reporting it destroyed: hazard rolls, models set up as close as possible within 6" (unengaged if they
can), battle-shocked, no charge. In the UI, passengers appear in the "Off the battlefield" list; a click
next to the transport sets them up, packed around the hull (`disembarkPositions`). The invented
fixture faction gained a Rust Crawler transport (not in the fixture roster). New lesson 11.
Transports (roles `transport` and `passenger`; an invented hauler stands in when the army has no
transport with room), lessons 11 and 12 became 12 and 13.

## D-047 Several detachments and battle size

11th edition armies pick detachments with detachment points (DP) from the battle size (Incursion and
Strike Force, read from the cached battle size table). `ResolvedArmy.detachmentId` became
`detachmentIds` plus `battleSize`; saved armies are migrated on load. Import keeps every detachment the
roster names and guesses the battle size from the roster text or its points. The Army page shows the
battle size, a checklist of the faction's detachments with their DP cost, the DP used and the
enhancement count against the limit; a detachment that would go over budget cannot be ticked. The
stratagem and army rules panels show rules from every chosen detachment.
