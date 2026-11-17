import { describe, expect, it } from 'vitest';
import { levenshtein, normalizeName, similarity } from './names.js';

describe('names', () => {
  it('normalizes case, punctuation, apostrophes and accents', () => {
    expect(normalizeName("  Cinder Lancer's ")).toBe('cinder lancers');
    expect(normalizeName('Pilgrim’s Toll')).toBe('pilgrims toll');
    expect(normalizeName('Scrap-Maul & Shield')).toBe('scrap maul and shield');
    expect(normalizeName('Café')).toBe('cafe');
  });

  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
  });

  it('scores near matches high and unrelated names low', () => {
    expect(similarity('Gutter Marksmen', 'Gutter Marksman')).toBeGreaterThan(0.9);
    expect(similarity('Pilgrim Scrapwardn', 'Pilgrim Scrapwarden')).toBeGreaterThan(0.9);
    expect(similarity('Totally Unknown Battle Robot', 'Furnace Walker')).toBeLessThan(0.5);
  });
});
