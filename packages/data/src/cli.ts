#!/usr/bin/env node
import { resolve } from 'node:path';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { nodeFetcher, systemClock } from './sync/http.js';
import { runSync, summarize } from './sync/sync.js';

// Honour HTTPS_PROXY / HTTP_PROXY / NO_PROXY when set (Node's fetch ignores them by default).
if (process.env['HTTPS_PROXY'] ?? process.env['https_proxy'] ?? process.env['HTTP_PROXY']) {
  setGlobalDispatcher(new EnvHttpProxyAgent());
}

const REPO_ROOT = resolve(import.meta.dirname, '../../..');

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv;
  const cacheDir = resolve(REPO_ROOT, flag(args, '--cache-dir') ?? 'data-cache');

  if (command === 'sync') {
    const maxAge = flag(args, '--max-age-hours');
    const result = await runSync({
      rawDir: resolve(cacheDir, 'raw'),
      fetcher: nodeFetcher,
      clock: systemClock,
      force: args.includes('--force'),
      ...(maxAge ? { maxAgeHours: Number(maxAge) } : {}),
      log: (line) => console.log(line),
    });
    console.log(summarize(result));
    console.log(`Log written to ${resolve(cacheDir, 'raw', 'sync-log.json')}`);
    return result.files.some((f) => f.outcome === 'failed') ? 1 : 0;
  }

  console.error('Usage: battle-drill-data <sync> [--force] [--max-age-hours N] [--cache-dir DIR]');
  return 2;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
