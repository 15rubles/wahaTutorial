#!/usr/bin/env node
import { resolve } from 'node:path';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { buildNormalized } from './build.js';
import { addCoreRules } from './rules/buildRules.js';
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

  if (command === 'build') {
    const fixture = args.includes('--fixture');
    const rawDir = resolve(REPO_ROOT, flag(args, '--raw-dir') ?? resolve(cacheDir, 'raw'));
    const outDir = resolve(REPO_ROOT, flag(args, '--out-dir') ?? resolve(cacheDir, 'normalized'));
    const data = await buildNormalized({ rawDir, outDir, fixture, extend: addCoreRules });
    const { counts, errors, warnings } = data.report;
    console.log(
      Object.entries(counts)
        .map(([k, n]) => `${k}: ${n}`)
        .join(', '),
    );
    const byCategory = (list: { category: string }[]) => {
      const m = new Map<string, number>();
      for (const i of list) m.set(i.category, (m.get(i.category) ?? 0) + 1);
      return [...m].map(([k, n]) => `${k} ${n}`).join(', ') || 'none';
    };
    console.log(`Errors: ${errors.length} (${byCategory(errors)})`);
    console.log(`Warnings: ${warnings.length} (${byCategory(warnings)})`);
    console.log(
      `Rules: ${counts['ruleSections'] ?? 0} sections, keywords resolved ${counts['resolvedKeywords'] ?? 0}, identity ${counts['identityKeywords'] ?? 0}, unresolved ${counts['unresolvedKeywords'] ?? 0}`,
    );
    console.log(`Written to ${outDir} (report: _report.json)`);
    return errors.length > 0 ? 1 : 0;
  }

  console.error(
    'Usage: battle-drill-data <sync|build> [--force] [--fixture] [--raw-dir DIR] [--out-dir DIR] [--max-age-hours N] [--cache-dir DIR]',
  );
  return 2;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
