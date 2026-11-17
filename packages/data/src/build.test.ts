import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildNormalized } from './build.js';
import { FIXTURE_RAW_DIR } from './fixtures.js';
import { DatasheetSchema } from './schema.js';

describe('buildNormalized', () => {
  it('writes normalized json and a report', async () => {
    const out = await mkdtemp(join(tmpdir(), 'bd-build-'));
    try {
      await buildNormalized({
        rawDir: FIXTURE_RAW_DIR,
        outDir: out,
        fixture: true,
        now: '2026-01-01T00:00:00.000Z',
      });
      expect((await readdir(join(out, 'datasheets'))).sort()).toEqual(['GC.json', 'RP.json']);
      const rp = JSON.parse(
        await readFile(join(out, 'datasheets', 'RP.json'), 'utf8'),
      ) as unknown[];
      expect(rp.every((d) => DatasheetSchema.safeParse(d).success)).toBe(true);
      const report = JSON.parse(await readFile(join(out, '_report.json'), 'utf8')) as {
        errors: unknown[];
      };
      expect(report.errors).toEqual([]);
      const meta = JSON.parse(await readFile(join(out, 'meta.json'), 'utf8')) as {
        fixture: boolean;
      };
      expect(meta.fixture).toBe(true);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});
