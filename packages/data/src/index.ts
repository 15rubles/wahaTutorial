/**
 * Data package: fetches, parses, normalizes and caches Wahapedia data into ./data-cache.
 * Nothing is implemented yet. The sync CLI arrives in M1, the normalizer in M2.
 */
export const DATA_PACKAGE_VERSION = '0.0.0';

/** Directory (relative to the repo root) where all fetched and normalized data lives. Gitignored. */
export const DATA_CACHE_DIR = 'data-cache';
