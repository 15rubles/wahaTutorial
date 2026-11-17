import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BOM } from '../text.js';
import { CSV_FILES } from './sources.js';
import { runSync } from './sync.js';
import { type FakeFile, fakeClock, fakeServer } from './testing.js';

const ORIGIN = 'https://example.test';

function siteFiles(lastUpdate: string): Record<string, FakeFile> {
  const files: Record<string, FakeFile> = {
    '/robots.txt': { body: 'User-agent: *\nDisallow: /wh40k11ed_/\n', etag: '"r1"' },
    '/wh40k11ed/Last_update.csv': {
      body: `${BOM}last_update|\r\n${lastUpdate}|\r\n`,
      etag: `"lu-${lastUpdate}"`,
    },
    '/wh40k11ed/the-rules/core-rules/': { body: '<html>invented</html>', etag: '"core1"' },
  };
  for (const f of CSV_FILES)
    files[`/wh40k11ed/${f}.csv`] = { body: `id|name|\r\n1|${f}|\r\n`, etag: `"${f}-1"` };
  return files;
}

describe('runSync', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bd-sync-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('downloads everything on first run, rate limited, with a User-Agent', async () => {
    const clock = fakeClock();
    const server = fakeServer(clock, siteFiles('2026-01-01 10:00:00'));
    const log = await runSync({ rawDir: dir, fetcher: server.fetcher, clock, origin: ORIGIN });

    expect(log.reason).toBe('synced');
    expect(server.requests).toHaveLength(2 + CSV_FILES.length + 1);
    for (let i = 1; i < server.requests.length; i++) {
      expect(server.requests[i]!.at - server.requests[i - 1]!.at).toBeGreaterThanOrEqual(1000);
    }
    expect(server.requests.every((r) => r.headers['user-agent']?.startsWith('BattleDrill/'))).toBe(
      true,
    );
    expect(await readFile(join(dir, 'Factions.csv'), 'utf8')).toContain('Factions');
    expect(log.files.filter((f) => f.outcome === 'downloaded')).toHaveLength(
      server.requests.length,
    );
  });

  it('makes zero requests on a second run inside the freshness window', async () => {
    const clock = fakeClock();
    const server = fakeServer(clock, siteFiles('2026-01-01 10:00:00'));
    await runSync({ rawDir: dir, fetcher: server.fetcher, clock, origin: ORIGIN });
    const before = server.requests.length;
    clock.advance(60_000);
    const second = await runSync({ rawDir: dir, fetcher: server.fetcher, clock, origin: ORIGIN });
    expect(second.reason).toBe('cache-fresh');
    expect(second.requests).toBe(0);
    expect(server.requests.length).toBe(before);
    const written = JSON.parse(await readFile(join(dir, 'sync-log.json'), 'utf8')) as {
      requests: number;
    };
    expect(written.requests).toBe(0);
  });

  it('only checks robots and Last_update when the window expired but nothing changed', async () => {
    const clock = fakeClock();
    const server = fakeServer(clock, siteFiles('2026-01-01 10:00:00'));
    await runSync({ rawDir: dir, fetcher: server.fetcher, clock, origin: ORIGIN });
    clock.advance(25 * 3_600_000);
    const before = server.requests.length;
    const log = await runSync({ rawDir: dir, fetcher: server.fetcher, clock, origin: ORIGIN });
    expect(log.reason).toBe('source-unchanged');
    expect(server.requests.length - before).toBe(2);
    expect(log.files.find((f) => f.key === 'robots.txt')?.outcome).toBe('not-modified');
  });

  it('uses conditional GET and reports changed files after a source update', async () => {
    const clock = fakeClock();
    const files = siteFiles('2026-01-01 10:00:00');
    const server = fakeServer(clock, files);
    await runSync({ rawDir: dir, fetcher: server.fetcher, clock, origin: ORIGIN });

    const updated = siteFiles('2026-02-01 10:00:00');
    updated['/wh40k11ed/Datasheets.csv'] = { body: 'id|name|\r\n1|new|\r\n', etag: '"ds-2"' };
    Object.assign(server.files, updated);
    for (const f of CSV_FILES)
      if (f !== 'Datasheets') server.files[`/wh40k11ed/${f}.csv`] = files[`/wh40k11ed/${f}.csv`]!;

    clock.advance(25 * 3_600_000);
    const log = await runSync({ rawDir: dir, fetcher: server.fetcher, clock, origin: ORIGIN });
    expect(log.reason).toBe('synced');
    expect(log.files.find((f) => f.key === 'Datasheets.csv')?.outcome).toBe('changed');
    expect(log.files.find((f) => f.key === 'Factions.csv')?.outcome).toBe('not-modified');
    const conditional = server.requests.filter((r) => r.url.endsWith('/Factions.csv'));
    expect(conditional.at(-1)?.headers['if-none-match']).toBe('"Factions-1"');
    expect(log.sourceLastUpdate).toBe('2026-02-01 10:00:00');
  });

  it('obeys robots.txt', async () => {
    const clock = fakeClock();
    const files = siteFiles('2026-01-01 10:00:00');
    files['/robots.txt'] = {
      body: 'User-agent: *\nDisallow: /wh40k11ed/the-rules/\n',
      etag: '"r2"',
    };
    const server = fakeServer(clock, files);
    const log = await runSync({ rawDir: dir, fetcher: server.fetcher, clock, origin: ORIGIN });
    expect(log.files.find((f) => f.key === 'core-rules.html')?.outcome).toBe('disallowed');
    expect(server.requests.some((r) => r.url.includes('the-rules'))).toBe(false);
  });

  it('retries a reset connection with backoff', async () => {
    const clock = fakeClock();
    const server = fakeServer(clock, siteFiles('2026-01-01 10:00:00'));
    server.failNext.set(`${ORIGIN}/wh40k11ed/Factions.csv`, 2);
    const log = await runSync({ rawDir: dir, fetcher: server.fetcher, clock, origin: ORIGIN });
    expect(log.files.find((f) => f.key === 'Factions.csv')?.outcome).toBe('downloaded');
    expect(clock.sleeps).toContain(2000);
    expect(clock.sleeps).toContain(4000);
  });

  it('--force rechecks everything even inside the window', async () => {
    const clock = fakeClock();
    const server = fakeServer(clock, siteFiles('2026-01-01 10:00:00'));
    await runSync({ rawDir: dir, fetcher: server.fetcher, clock, origin: ORIGIN });
    const log = await runSync({
      rawDir: dir,
      fetcher: server.fetcher,
      clock,
      origin: ORIGIN,
      force: true,
    });
    expect(log.files.filter((f) => f.outcome === 'not-modified').length).toBe(
      2 + CSV_FILES.length + 1,
    );
  });
});
