// Hard rule: no long dashes (en dash U+2013, em dash U+2014) anywhere in tracked text files.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter((f) => f && !f.endsWith('package-lock.json'));

const pattern = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
const hits = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    if (pattern.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
  });
}

if (hits.length > 0) {
  console.error('Long dashes found. Use a regular hyphen instead:\n' + hits.join('\n'));
  process.exit(1);
}
console.log(`check-dashes: ${files.length} files clean.`);
