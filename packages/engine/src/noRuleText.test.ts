import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Hard rule 1: the engine holds mechanics, never rules prose. Flags any long string literal. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : [];
  });
}

describe('engine source', () => {
  it('has no prose string literals', () => {
    const offenders: string[] = [];
    for (const file of files(import.meta.dirname)) {
      const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      for (const m of src.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)) {
        const s = m[1] ?? m[2] ?? m[3] ?? '';
        if (s.split(/\s+/).filter(Boolean).length > 8) offenders.push(`${file}: ${s.slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
