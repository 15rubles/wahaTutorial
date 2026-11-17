import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type NormalizedData, normalize } from './normalize.js';
import type { BuildMeta } from './schema.js';
import { loadManifest } from './sync/manifest.js';

export interface BuildOptions {
  readonly rawDir: string;
  readonly outDir: string;
  readonly fixture?: boolean;
  readonly now?: string;
  /** Hook for later milestones (core rules) to add files and fill the report. */
  readonly extend?: (
    data: NormalizedData,
    files: Record<string, string>,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

async function readRawFiles(rawDir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const name of await readdir(rawDir)) {
    if (name.endsWith('.csv') || name.endsWith('.html'))
      out[name] = await readFile(join(rawDir, name), 'utf8');
  }
  return out;
}

const json = (value: unknown) => JSON.stringify(value) + '\n';

export async function buildNormalized(options: BuildOptions): Promise<NormalizedData> {
  // Fixture builds are committed, so they use a fixed time to keep diffs clean.
  const now =
    options.now ?? (options.fixture ? '2026-01-01T00:00:00.000Z' : new Date().toISOString());
  const files = await readRawFiles(options.rawDir);
  const data = normalize(files, { now });
  const extra = (await options.extend?.(data, files)) ?? {};

  await rm(options.outDir, { recursive: true, force: true });
  await mkdir(join(options.outDir, 'datasheets'), { recursive: true });

  const manifest = await loadManifest(options.rawDir);
  const fetched = Object.values(manifest.files)
    .map((f) => f.fetchedAt)
    .sort()
    .at(0);
  const meta: BuildMeta = {
    schemaVersion: 1,
    builtAt: now,
    ...(manifest.sourceLastUpdate ? { sourceLastUpdate: manifest.sourceLastUpdate } : {}),
    ...(fetched ? { rawFetchedAt: fetched } : {}),
    fixture: options.fixture ?? false,
  };

  const write = (name: string, value: unknown) =>
    writeFile(join(options.outDir, name), json(value), 'utf8');
  await write('meta.json', meta);
  await write('factions.json', data.factions);
  await write('publications.json', data.publications);
  await write('abilities.json', data.abilities);
  await write('stratagems.json', data.stratagems);
  await write('enhancements.json', data.enhancements);
  await write('detachment-abilities.json', data.detachmentAbilities);
  await write('detachments.json', data.detachments);
  await write('keywords.json', data.keywords);
  await write('catalog.json', data.catalog);
  const byFaction = new Map<string, unknown[]>();
  for (const ds of data.datasheets) {
    const list = byFaction.get(ds.factionId) ?? [];
    list.push(ds);
    byFaction.set(ds.factionId, list);
  }
  for (const [factionId, list] of byFaction) {
    await writeFile(
      join(options.outDir, 'datasheets', `${factionId || '_none'}.json`),
      json(list),
      'utf8',
    );
  }
  for (const [name, value] of Object.entries(extra)) await write(name, value);
  await writeFile(
    join(options.outDir, '_report.json'),
    JSON.stringify(data.report, null, 2) + '\n',
    'utf8',
  );
  return data;
}
