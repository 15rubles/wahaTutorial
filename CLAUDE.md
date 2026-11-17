# CLAUDE.md - Battle Drill (40k 11th Edition Interactive Tutorial)

## What we are building

A video-game-style interactive tutorial for Warhammer 40,000 11th Edition.
The user imports their own army roster, the app resolves every unit to its full datasheet,
and then walks the user through the entire core rules using THEIR units as the examples,
on a simple virtual battlefield, step by step, like the tutorial level of a strategy game.

Think "XCOM / Total War tutorial", not "PDF with a Next button":
- highlight the thing to click, block everything else
- explain one concept, make the user do it, confirm they did it right, move on
- unlock complexity gradually (one unit in melee -> shooting -> movement -> full turn -> full battle round)

Owner: Aleksei (GitHub: 15rubles). Background: Java/Spring backend, comfortable with React and Docker.
This is a personal project and portfolio piece. It is NOT published commercially.

## Hard rules for Claude Code (read before every milestone)

1. **No GW rules text in the repo. Ever.**
   - Rules, datasheets, stratagems and ability text are Games Workshop IP.
   - All of that content is fetched at runtime by the user's own machine into a local cache (`./data-cache/`), which is in `.gitignore`.
   - Tutorial scripts reference rules by ID (for example `core.shooting.hit-roll`) and the app pulls the text from the local cache to display it.
   - Test fixtures use INVENTED units and invented rule text (see "Fixtures" below). Never paste real datasheet text into tests, seeds, docs, comments or commit messages.
2. **Never hardcode rules from memory.** If you are unsure how an 11th edition rule works, read it from the cached data. Do not rely on 10th edition knowledge: 11th changed things (for example pile-in, detachment points, force dispositions). When the data is ambiguous, add a `// RULES-QUESTION:` comment and list it in `docs/rules-questions.md` instead of guessing.
3. **Be polite to Wahapedia.**
   - Prefer the official data export (CSV) over scraping HTML.
   - Check `robots.txt` before fetching any HTML page and obey it.
   - Max 1 request per second, a descriptive User-Agent, and cache everything with a timestamp so a normal run makes zero network requests.
   - The fetch is a manual command the user runs (`npm run data:sync`), never something the app does on every launch.
4. Work milestone by milestone. Do not start the next milestone until the current one's acceptance criteria pass and are checked off in `docs/progress.md`.
5. Style: never use long dashes in code, comments, docs or UI text. Use a regular hyphen.

## Tech stack

- **Monorepo** with npm workspaces, TypeScript everywhere, strict mode on.
- `packages/data` - Node CLI: fetch, parse, normalize and cache Wahapedia data.
- `packages/engine` - pure TypeScript rules engine. No UI, no DOM, no network. 100% unit testable.
- `packages/tutorial` - lesson definitions plus the step runner (also pure TS).
- `apps/web` - Vite + React + TypeScript UI. Battlefield is rendered with SVG (switch to PixiJS only if SVG performance becomes a real problem).
- Testing: Vitest for packages, Playwright for a few end-to-end tutorial runs.
- State: Zustand in the UI. The engine state is immutable plain objects (serializable, so we get undo / replay / save for free).
- Lint/format: ESLint + Prettier.

No backend server for v1. Everything runs locally in the browser, plus the Node data CLI.

## Architecture

```
Wahapedia (CSV export + core rules pages)
        |  npm run data:sync  (manual, rate limited)
        v
./data-cache/raw/            <- untouched downloads, gitignored
        |  packages/data normalize
        v
./data-cache/normalized/*.json  <- our own schema, gitignored
        |
roster file (.ros/.rosz/.txt) --> RosterImporter --> ResolvedArmy (units + full datasheets)
        |
packages/engine  (GameState, phases, actions, dice, attack sequence)
        |
packages/tutorial (Lessons -> Steps -> triggers/validators)
        |
apps/web (Battlefield, unit cards, rule popups, dice tray, tutorial overlay)
```

### Data source notes

- In 10th edition, Wahapedia offered a data export page with pipe-delimited (`|`) CSV files such as
  `Factions.csv`, `Datasheets.csv`, `Datasheets_models.csv`, `Datasheets_wargear.csv`,
  `Datasheets_abilities.csv`, `Datasheets_keywords.csv`, `Abilities.csv`, `Stratagems.csv`,
  `Detachment_abilities.csv`, `Enhancements.csv`, `Last_update.csv`.
  **First task of M1: check whether an 11th edition equivalent exists and what its real schema is.** Do not assume the file names or columns above are still correct.
- Core rules (phases, terrain, keywords like HAZARDOUS) are probably only available as HTML pages. Parse them into a tree of rule sections with stable IDs we generate (slugified headings), and keep the raw HTML in the cache.
- `Last_update.csv` (or its equivalent) drives incremental re-sync.

### Normalized schema (our own, lives in `packages/data/src/schema.ts`)

Define these with Zod and export the inferred types:
`Faction`, `Datasheet`, `ModelProfile` (M, T, Sv, W, Ld, OC, invuln), `WeaponProfile`
(range, A, BS/WS, S, AP, D, keywords), `Ability`, `Keyword`, `Stratagem`, `Detachment`,
`Enhancement`, `RuleSection` (id, title, html/text, children, references to keywords).
Every entity keeps `sourceId` (Wahapedia ID) and `sourceUrl` so the UI can link to the original page.

## Milestones

Each milestone ends with: tests green, `docs/progress.md` updated, a short demo note of what the user can now do.

### M0 - Skeleton
- Monorepo, workspaces, TS strict, ESLint, Prettier, Vitest, Vite app that renders "Battle Drill".
- `.gitignore` includes `data-cache/`, `*.rosz` and `*.ros` outside `fixtures/`.
- `docs/progress.md`, `docs/rules-questions.md`, `docs/data-schema.md` created.
- **Accept:** `npm run build`, `npm test`, `npm run dev` all work from a clean clone.

### M1 - Data recon and sync
- Investigate what Wahapedia offers for 11th edition (CSV export, page structure, robots.txt). Write findings in `docs/data-schema.md` BEFORE writing the parser.
- `npm run data:sync` downloads raw files to `data-cache/raw/` with rate limiting, a User-Agent, and an ETag / timestamp cache.
- **Accept:** a second run with no changes makes zero network requests; a sync log lists what changed.

### M2 - Normalize datasheets
- Parse CSVs into the Zod schema, validate everything, write `data-cache/normalized/`.
- Report broken rows instead of crashing (`data-cache/normalized/_report.json`).
- **Accept:** all factions load; validation report has zero errors or every error is explained; unit tests run against invented fixtures only.

### M3 - Core rules tree
- Parse core rules pages into `RuleSection` tree with stable IDs.
- Build a keyword index: keyword -> rule section (so a unit's HAZARDOUS weapon can open the right popup).
- Simple rules browser page in the web app (search + tree), reading from the local cache.
- **Accept:** every keyword used on any datasheet either resolves to a rule section or is listed as unresolved in the report.

### M4 - Roster import
- Importers, in this order:
  1. BattleScribe / New Recruit `.ros` (XML) and `.rosz` (zipped XML)
  2. Plain text export from the official app and New Recruit (best-effort parser, tolerant of formatting)
- Resolve each roster unit to a `Datasheet` + chosen wargear + model count + enhancements. Name matching is fuzzy (normalize case, punctuation, apostrophes), and unmatched units go to a "fix me" screen where the user picks the right datasheet manually.
- **Accept:** importing an invented fixture roster gives a fully resolved `ResolvedArmy`; unmatched units never crash the app.

### M5 - Engine core: dice and the attack sequence
- Seedable dice roller (deterministic in tests, animated in UI).
- Full attack sequence as pure functions: hit roll, wound roll (strength vs toughness), allocate, saving throw (AP, invulnerable save), damage, models removed. Each step emits events (`HitRolled`, `WoundRolled`, ...) the tutorial can listen to.
- Weapon keyword hooks as a plugin registry (each keyword = one module with its own tests). Implement the keywords that appear in the user's imported army first.
- **Accept:** property tests for the wound chart; every implemented keyword has tests; no rule text strings in engine code.

### M6 - Engine: battlefield and phases
- Battlefield model: board size, units as groups of model bases (circles), terrain as polygons, distance in inches, basic line of sight (2D, terrain blocks or not).
- Battle round / turn / phase state machine, structure derived from the cached core rules (see Hard rule 2).
- Phase actions: movement (normal, advance, fall back), shooting, charge, fight (including 11th edition pile-in as written in the data), command phase basics, battle-shock.
- Undo and replay from the event log.
- **Accept:** a scripted game between two invented armies runs from deployment to end of battle round 1 in a test, deterministically.

### M7 - Web UI: playable sandbox
- SVG battlefield: drag units, movement ruler with legal range shown, range rings for weapons, target selection.
- Unit card panel showing the full datasheet from cache; tapping any keyword opens the rule popup (from M3).
- Dice tray with roll animation and a results breakdown.
- **Accept:** the user can import their roster and play one full turn against a dummy enemy unit with no tutorial.

### M8 - Tutorial framework
- Lesson format (TypeScript objects, not text files with rules in them):
  ```ts
  type Step = {
    id: string;
    ruleRefs: string[];          // RuleSection ids, text pulled from cache
    say: string;                 // OUR OWN short explanation, written in plain words, not copied rules
    focus?: UiTarget;            // element to highlight, everything else dimmed and blocked
    expect?: ExpectedAction;     // what the user must do, validated against engine events
    onWrong?: string;            // hint shown when they do something else
    setup?: (s: GameState) => GameState;
  };
  ```
- Step runner: listens to engine events, advances on success, gives hints on failure, allows "explain again" and "skip".
- Units in lessons are picked from the user's army by role (a melee unit, a shooting unit, a fast unit, a character). If the army lacks a role, fall back to an invented generic unit and say so.
- Progress saved in localStorage (wrapped in try/catch).
- **Accept:** a 3-step demo lesson runs end to end in Playwright.

### M9 - The tutorial campaign
Lessons, each one adding one layer, all using the user's own units:
1. Reading a datasheet (stats, weapons, abilities, keywords)
2. Melee duel: two characters, the fight phase and the attack sequence
3. Shooting: range, line of sight, cover, weapon keywords from their army
4. Movement: normal move, advance, fall back, terrain
5. Charging and the full fight phase (pile-in, consolidate)
6. Command phase, command points, stratagems from their detachment
7. Objectives, OC, scoring, battle-shock
8. Their detachment rule, enhancements and army rule
9. Deployment and a full battle round against a scripted AI opponent
10. "Graduation": a free-play mini game with hints available on request
- **Accept:** every lesson completes in Playwright using an invented fixture army; a real-roster manual run is noted in `docs/progress.md`.

### M10 - Polish
- Quick-reference mode (rules popups available outside the tutorial).
- "What can I do now?" helper during free play that lists legal actions for the selected unit.
- Data freshness banner ("rules cache is 40 days old, run data:sync").
- Accessibility pass (keyboard navigation, colorblind-safe board colors).

## Fixtures

`fixtures/` contains an invented faction ("The Rust Pilgrims") with invented units,
weapons, abilities and keywords that mimic the real data shapes. All unit, integration and
E2E tests use these. A real roster is only ever used for manual testing on the owner's machine.

## Commands

```
npm run dev          # web app
npm test             # all unit tests
npm run e2e          # Playwright
npm run data:sync    # fetch Wahapedia data into ./data-cache (manual, rate limited)
npm run data:build   # normalize raw cache -> normalized json + report
```

## Conventions

- Pure functions in `engine` and `tutorial`; side effects only in `data` CLI and `apps/web`.
- One rule mechanic per file, named after the rule (`fight/pileIn.ts`), with a `ruleRefs` export pointing at its RuleSection ids.
- Small commits, one milestone step per commit, conventional commit messages.
- When a rule interaction is unclear, add it to `docs/rules-questions.md` and keep going with the simplest interpretation behind a clearly named flag.
