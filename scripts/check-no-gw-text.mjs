// Hard rule 1 check: no text from the local GW data cache may appear in committed files.
// Builds every 8-word sequence ("shingle") from data-cache/raw and looks for them in tracked files.
// Usage: npm run check:no-gw-text (needs a synced cache; skips with a note otherwise).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAW = 'data-cache/raw';
const N = 8;
if (!existsSync(RAW)) {
  console.log('No data-cache/raw: nothing to compare against. Run npm run data:sync first.');
  process.exit(0);
}

const words = (text) =>
  text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

const shingles = new Set();
// Structure is not prose: CSV header rows, headings (section titles and codes) are skipped.
const prose = (file, text) =>
  file.endsWith('.csv')
    ? text.slice(text.indexOf('\n') + 1)
    : text
        .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/g, ' | ')
        .replace(
          /<div class="(?:abName|str11HeadBlock[^"]*|tooltip_header)"[^>]*>[\s\S]*?<\/div>/g,
          ' | ',
        );

for (const f of readdirSync(RAW)) {
  if (!/\.(csv|html)$/.test(f)) continue;
  const w = words(prose(f, readFileSync(join(RAW, f), 'utf8')));
  for (let i = 0; i + N <= w.length; i++) shingles.add(w.slice(i, i + N).join(' '));
}

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  // fixtures/normalized is generated from the invented fixtures.
  .filter(
    (f) =>
      f &&
      !/\.(png|jpg|rosz|lock)$/.test(f) &&
      !f.endsWith('package-lock.json') &&
      !f.startsWith('fixtures/normalized/'),
  );
const hits = [];
for (const f of files) {
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  // Rule ids (core.x.y) are references, not text.
  const w = words(text.replace(/core\.[a-z0-9.-]+/g, ' '));
  for (let i = 0; i + N <= w.length; i++) {
    const slice = w.slice(i, i + N);
    // Runs of numbers and stat names are not prose: need at least 5 real words.
    if (slice.filter((x) => /^[a-z]{3,}$/.test(x)).length < 5) continue;
    const s = slice.join(' ');
    if (shingles.has(s)) {
      hits.push(`${f}: "${s}"`);
      break;
    }
  }
}
console.log(`Compared ${files.length} tracked files against ${shingles.size} cache shingles.`);
if (hits.length) {
  console.log('Possible copied text:\n' + hits.join('\n'));
  process.exit(1);
}
console.log('No cache text found in the repository.');
