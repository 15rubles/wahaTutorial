import { describe, expect, it } from 'vitest';
import { cacheAgeDays, isStale } from './freshness.js';

describe('freshness', () => {
  const now = Date.parse('2026-03-01T00:00:00Z');
  it('computes the cache age and flags old caches', () => {
    const meta = {
      schemaVersion: 1 as const,
      builtAt: '',
      fixture: false,
      rawFetchedAt: '2026-01-15T00:00:00Z',
    };
    expect(cacheAgeDays(meta, now)).toBe(45);
    expect(isStale(45)).toBe(true);
    expect(isStale(cacheAgeDays({ ...meta, rawFetchedAt: '2026-02-20T00:00:00Z' }, now))).toBe(
      false,
    );
  });
  it('ignores demo data and missing dates', () => {
    expect(
      cacheAgeDays(
        { schemaVersion: 1, builtAt: '', fixture: true, rawFetchedAt: '2020-01-01T00:00:00Z' },
        now,
      ),
    ).toBeNull();
    expect(cacheAgeDays(undefined, now)).toBeNull();
    expect(isStale(null)).toBe(false);
  });
});
