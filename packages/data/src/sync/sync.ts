import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stripBom } from '../text.js';
import { type Clock, type Fetcher, PoliteClient } from './http.js';
import { type Manifest, type ManifestEntry, loadManifest, saveManifest } from './manifest.js';
import { isAllowed, parseRobots } from './robots.js';
import {
  LAST_UPDATE_FILE,
  type SourceFile,
  WAHAPEDIA_ORIGIN,
  allContentSources,
  csvSource,
  robotsSource,
} from './sources.js';

export const USER_AGENT_TOKEN = 'BattleDrill';
export const USER_AGENT = `${USER_AGENT_TOKEN}/0.1 (personal non-commercial rules tutorial; manual data sync)`;

export interface SyncOptions {
  readonly rawDir: string;
  readonly fetcher: Fetcher;
  readonly clock: Clock;
  readonly origin?: string;
  readonly force?: boolean;
  readonly maxAgeHours?: number;
  readonly minIntervalMs?: number;
  readonly maxRetries?: number;
  readonly log?: (line: string) => void;
}

export type FileOutcome =
  'downloaded' | 'changed' | 'unchanged' | 'not-modified' | 'skipped' | 'disallowed' | 'failed';

export interface FileResult {
  readonly key: string;
  readonly url: string;
  readonly outcome: FileOutcome;
  readonly detail?: string;
}

export interface SyncLog {
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly requests: number;
  readonly reason: string;
  readonly sourceLastUpdate?: string | undefined;
  readonly files: readonly FileResult[];
}

export const SYNC_LOG_FILE = 'sync-log.json';

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseLastUpdate(bytes: Uint8Array): string | undefined {
  const text = stripBom(new TextDecoder().decode(bytes));
  const line = text.split(/\r?\n/)[1];
  const value = line?.split('|')[0]?.trim();
  return value || undefined;
}

export async function runSync(options: SyncOptions): Promise<SyncLog> {
  const {
    rawDir,
    clock,
    origin = WAHAPEDIA_ORIGIN,
    force = false,
    maxAgeHours = 24,
    log = () => undefined,
  } = options;
  const startedAt = new Date(clock.now()).toISOString();
  const client = new PoliteClient({
    userAgent: USER_AGENT,
    minIntervalMs: options.minIntervalMs ?? 1100,
    maxRetries: options.maxRetries ?? 3,
    fetcher: options.fetcher,
    clock,
  });
  await mkdir(rawDir, { recursive: true });
  let manifest: Manifest = await loadManifest(rawDir);
  const files: FileResult[] = [];

  const finish = async (reason: string, ok: boolean): Promise<SyncLog> => {
    const finishedAt = new Date(clock.now()).toISOString();
    if (ok) manifest = { ...manifest, lastSuccessfulSyncAt: finishedAt };
    await saveManifest(rawDir, manifest);
    const result: SyncLog = {
      startedAt,
      finishedAt,
      requests: client.requestCount,
      reason,
      sourceLastUpdate: manifest.sourceLastUpdate,
      files,
    };
    await writeFile(join(rawDir, SYNC_LOG_FILE), JSON.stringify(result, null, 2) + '\n', 'utf8');
    return result;
  };

  // 1. Freshness window: a normal run makes zero requests.
  if (!force && manifest.lastSuccessfulSyncAt) {
    const ageHours = (clock.now() - Date.parse(manifest.lastSuccessfulSyncAt)) / 3_600_000;
    if (ageHours < maxAgeHours) {
      log(
        `Cache is ${ageHours.toFixed(1)} h old (limit ${maxAgeHours} h). Nothing to do. Use --force to check anyway.`,
      );
      return finish('cache-fresh', true);
    }
  }

  /** Fetches one file with a conditional GET and stores it. */
  const fetchFile = async (
    source: SourceFile,
  ): Promise<{ result: FileResult; bytes?: Uint8Array }> => {
    const previous = manifest.files[source.key];
    const now = new Date(clock.now()).toISOString();
    try {
      const res = await client.get(source.url, previous ?? {});
      if (res.status === 304 && previous) {
        manifest = {
          ...manifest,
          files: { ...manifest.files, [source.key]: { ...previous, checkedAt: now } },
        };
        return { result: { key: source.key, url: source.url, outcome: 'not-modified' } };
      }
      if (res.status !== 200) {
        return {
          result: {
            key: source.key,
            url: source.url,
            outcome: 'failed',
            detail: `HTTP ${res.status}`,
          },
        };
      }
      const hash = sha256(res.body);
      const outcome: FileOutcome = !previous
        ? 'downloaded'
        : previous.sha256 === hash
          ? 'unchanged'
          : 'changed';
      if (outcome !== 'unchanged') await writeFile(join(rawDir, source.key), res.body);
      const entry: ManifestEntry = {
        key: source.key,
        url: source.url,
        etag: res.headers['etag'],
        lastModified: res.headers['last-modified'],
        checkedAt: now,
        fetchedAt: outcome === 'unchanged' && previous ? previous.fetchedAt : now,
        sha256: hash,
        bytes: res.body.byteLength,
      };
      manifest = { ...manifest, files: { ...manifest.files, [source.key]: entry } };
      return { result: { key: source.key, url: source.url, outcome }, bytes: res.body };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { result: { key: source.key, url: source.url, outcome: 'failed', detail } };
    }
  };

  // 2. robots.txt first.
  const robots = await fetchFile(robotsSource(origin));
  files.push(robots.result);
  let robotsText: string;
  try {
    robotsText = robots.bytes
      ? new TextDecoder().decode(robots.bytes)
      : await readFile(join(rawDir, 'robots.txt'), 'utf8');
  } catch {
    log('Could not read robots.txt. Stopping without fetching anything else.');
    return finish('robots-unavailable', false);
  }
  const groups = parseRobots(robotsText);
  const allowed = (url: string) => isAllowed(groups, USER_AGENT_TOKEN, new URL(url).pathname);

  // 3. Last_update.csv decides whether anything else is needed.
  const lastUpdateSource = csvSource(LAST_UPDATE_FILE, origin);
  if (!allowed(lastUpdateSource.url)) {
    files.push({ key: lastUpdateSource.key, url: lastUpdateSource.url, outcome: 'disallowed' });
    return finish('disallowed', false);
  }
  const lastUpdate = await fetchFile(lastUpdateSource);
  files.push(lastUpdate.result);
  if (lastUpdate.result.outcome === 'failed') return finish('last-update-failed', false);

  let sourceLastUpdate = manifest.sourceLastUpdate;
  if (lastUpdate.bytes) sourceLastUpdate = parseLastUpdate(lastUpdate.bytes) ?? sourceLastUpdate;
  const contentSources = allContentSources(origin);
  const haveAll = contentSources.every((s) => manifest.files[s.key]);
  if (!force && haveAll && sourceLastUpdate && sourceLastUpdate === manifest.sourceLastUpdate) {
    for (const s of contentSources)
      files.push({ key: s.key, url: s.url, outcome: 'skipped', detail: 'source not updated' });
    log(
      `Source last update unchanged (${sourceLastUpdate}). Skipped ${contentSources.length} files.`,
    );
    return finish('source-unchanged', true);
  }

  // 4. Conditional GET for every content file.
  let failures = 0;
  for (const source of contentSources) {
    if (!allowed(source.url)) {
      files.push({ key: source.key, url: source.url, outcome: 'disallowed' });
      log(`  disallowed by robots.txt: ${source.url}`);
      continue;
    }
    const { result } = await fetchFile(source);
    files.push(result);
    if (result.outcome === 'failed') failures += 1;
    log(
      `  ${result.outcome.padEnd(12)} ${source.key}${result.detail ? ` (${result.detail})` : ''}`,
    );
  }
  if (failures === 0) manifest = { ...manifest, sourceLastUpdate };
  return finish(failures === 0 ? 'synced' : 'partial', failures === 0);
}

export function summarize(result: SyncLog): string {
  const counts = new Map<FileOutcome, number>();
  for (const f of result.files) counts.set(f.outcome, (counts.get(f.outcome) ?? 0) + 1);
  const parts = [...counts.entries()].map(([k, v]) => `${k}: ${v}`);
  return `Sync ${result.reason}. Requests: ${result.requests}. ${parts.join(', ')}`;
}
