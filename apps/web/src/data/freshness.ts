import type { BuildMeta } from '@battle-drill/data';

export const STALE_AFTER_DAYS = 30;

/** Age in whole days of the user's cache, or null for demo data / unknown dates. */
export function cacheAgeDays(meta: BuildMeta | undefined, now: number): number | null {
  if (!meta || meta.fixture || !meta.rawFetchedAt) return null;
  const t = Date.parse(meta.rawFetchedAt);
  return Number.isFinite(t) ? Math.floor((now - t) / 86_400_000) : null;
}

export const isStale = (age: number | null): boolean => age !== null && age > STALE_AFTER_DAYS;
