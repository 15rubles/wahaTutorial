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

## M1 - Data recon and sync

- [ ] Recon of Wahapedia 11th edition data (CSV export, page structure, robots.txt) written to `docs/data-schema.md`
- [ ] `npm run data:sync` with rate limiting, User-Agent, ETag / timestamp cache
- [ ] Accept: second run with no changes makes zero network requests; sync log lists changes

## M2 - Normalize datasheets

- [ ] Accept: all factions load; validation report has zero unexplained errors; tests use invented fixtures only

## M3 - Core rules tree

- [ ] Accept: every datasheet keyword resolves to a rule section or is listed as unresolved

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
