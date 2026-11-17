import { describe, expect, it } from 'vitest';
import { parseDice, parseLeadingInt, parseRange } from './values.js';

describe('values', () => {
  it('parses dice expressions', () => {
    expect(parseDice('3')).toMatchObject({ dice: 0, sides: 0, plus: 3 });
    expect(parseDice('D6')).toMatchObject({ dice: 1, sides: 6, plus: 0 });
    expect(parseDice('2D3+1')).toMatchObject({ dice: 2, sides: 3, plus: 1 });
    expect(parseDice('d6 + 2')).toMatchObject({ dice: 1, sides: 6, plus: 2 });
    expect(parseDice('-')).toBeUndefined();
  });

  it('parses characteristics', () => {
    expect(parseLeadingInt('6"')).toBe(6);
    expect(parseLeadingInt('3+')).toBe(3);
    expect(parseLeadingInt('-2')).toBe(-2);
    expect(parseLeadingInt('-')).toBeUndefined();
    expect(parseRange('Melee')).toBeNull();
    expect(parseRange('24"')).toBe(24);
  });
});
