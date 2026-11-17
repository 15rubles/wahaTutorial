import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { requiredWoundRoll } from './woundChart.js';

const stat = fc.integer({ min: 1, max: 30 });

describe('wound chart (property tests)', () => {
  it('always needs 2+ to 6+', () => {
    fc.assert(
      fc.property(stat, stat, (s, t) => {
        const r = requiredWoundRoll(s, t);
        return r >= 2 && r <= 6;
      }),
    );
  });

  it('never gets harder as Strength goes up', () => {
    fc.assert(
      fc.property(stat, stat, (s, t) => requiredWoundRoll(s + 1, t) <= requiredWoundRoll(s, t)),
    );
  });

  it('never gets easier as Toughness goes up', () => {
    fc.assert(
      fc.property(stat, stat, (s, t) => requiredWoundRoll(s, t + 1) >= requiredWoundRoll(s, t)),
    );
  });

  it('matches each band of the chart', () => {
    fc.assert(
      fc.property(stat, stat, (s, t) => {
        const r = requiredWoundRoll(s, t);
        if (s >= 2 * t) return r === 2;
        if (s > t) return r === 3;
        if (s === t) return r === 4;
        if (2 * s <= t) return r === 6;
        return r === 5;
      }),
    );
  });

  it('spot checks', () => {
    expect([
      requiredWoundRoll(8, 4),
      requiredWoundRoll(5, 4),
      requiredWoundRoll(4, 4),
      requiredWoundRoll(3, 4),
      requiredWoundRoll(2, 4),
    ]).toEqual([2, 3, 4, 5, 6]);
  });
});
