import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Directory with the invented fixture export (Rust Pilgrims and Glass Choir). */
export const FIXTURE_RAW_DIR = fileURLToPath(
  new URL('../../../fixtures/wahapedia', import.meta.url),
);

export function readFixtureFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(FIXTURE_RAW_DIR))
    out[name] = readFileSync(`${FIXTURE_RAW_DIR}/${name}`, 'utf8');
  return out;
}
