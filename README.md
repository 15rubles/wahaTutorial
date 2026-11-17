# Battle Drill

A video-game-style interactive tutorial for the Warhammer 40,000 11th Edition core rules.
Import your own army roster and learn the rules step by step using your own units on a simple
virtual battlefield.

Personal, non-commercial project. Not affiliated with Games Workshop.

## No Games Workshop content in this repo

Rules, datasheets, stratagems and ability text are Games Workshop IP. This repo never contains them.
They are fetched on demand by `npm run data:sync` into `./data-cache/`, which is gitignored.
Tests use the invented "Rust Pilgrims" faction in `fixtures/`.

## Layout

| Path                | What                                                       |
| ------------------- | ---------------------------------------------------------- |
| `packages/data`     | Node CLI: fetch, parse, normalize and cache Wahapedia data |
| `packages/engine`   | Pure TypeScript rules engine (no UI, no DOM, no network)   |
| `packages/tutorial` | Lesson definitions and the step runner (pure TypeScript)   |
| `apps/web`          | Vite + React UI                                            |
| `docs/`             | Progress, rules questions, data schema notes               |

## Commands

```bash
npm install
npm run dev          # web app on http://localhost:5173
npm run build        # type-check packages and build the web app
npm test             # all unit tests (Vitest)
npm run lint         # ESLint + long dash check
npm run format       # Prettier
npm run e2e          # Playwright end-to-end tests (fixture data only)
npm run data:sync    # fetch Wahapedia data into ./data-cache (manual, rate limited)
npm run data:build   # normalize raw cache -> data-cache/normalized
npm run fixtures:build # regenerate the invented fixture data
```

Requires Node 20 or newer (`.nvmrc` pins 22). For `npm run e2e` on a new machine, run
`npx playwright install chromium` once.

See `CLAUDE.md` for the full plan and `docs/progress.md` for status.
