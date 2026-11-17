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
