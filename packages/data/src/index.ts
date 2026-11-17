/**
 * Browser-safe entry: the normalized schema and pure parsers.
 * Node-only parts (sync, file system build) are in `@battle-drill/data/node`.
 */
export const DATA_PACKAGE_VERSION = '0.1.0';

/** Directory (relative to the repo root) where all fetched and normalized data lives. Gitignored. */
export const DATA_CACHE_DIR = 'data-cache';

export * from './schema.js';
export { parseCsv, type CsvRow, type CsvTable } from './csv.js';
export { parseDice, parseLeadingInt, parseRange } from './values.js';
export {
  parseWeaponKeyword,
  parseWeaponKeywords,
  slugify,
  type WeaponKeyword,
} from './weaponKeywords.js';
export { normalize, EXPLANATIONS, type NormalizedData } from './normalize.js';
