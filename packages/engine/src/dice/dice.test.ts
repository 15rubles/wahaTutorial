import { describe, expect, it } from 'vitest';
import { exprToString, flat, parseParam, rollDie, rollExpr } from './diceExpr.js';
import { createRng, nextFloat } from './rng.js';
import { scriptedRoller, seededRoller } from './roller.js';

describe('dice', () => {
  it('is deterministic for a seed and serializable', () => {
    const a = seededRoller(createRng(42));
    const b = seededRoller(createRng(42));
    const ra = Array.from({ length: 20 }, () => a.d6());
    expect(Array.from({ length: 20 }, () => b.d6())).toEqual(ra);
    expect(JSON.parse(JSON.stringify(a.state()))).toEqual(a.state());
    expect(a.state().draws).toBe(20);
    // Resuming from a saved state continues the same sequence.
    const c = seededRoller(createRng(42));
    for (let i = 0; i < 10; i++) c.d6();
    const resumed = seededRoller(c.state());
    expect(Array.from({ length: 10 }, () => resumed.d6())).toEqual(ra.slice(10));
  });

  it('produces every face with roughly equal frequency', () => {
    const r = seededRoller(createRng(7));
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60000; i++) counts[r.d6() - 1]! += 1;
    for (const c of counts) expect(Math.abs(c - 10000)).toBeLessThan(500);
  });

  it('nextFloat stays in [0, 1)', () => {
    let s = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const [v, n] = nextFloat(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      s = n;
    }
  });

  it('scripted roller plays queued values first', () => {
    const r = scriptedRoller([6, 1, 3], createRng(1));
    expect([r.d6(), r.d6(), r.d6()]).toEqual([6, 1, 3]);
    expect(r.d6()).toBeGreaterThanOrEqual(1);
    expect(() => scriptedRoller([7], createRng(1)).d6()).toThrow();
  });

  it('D3 halves a D6 rounding up', () => {
    expect([1, 2, 3, 4, 5, 6].map((v) => rollDie(3, scriptedRoller([v], createRng(1))))).toEqual([
      1, 1, 2, 2, 3, 3,
    ]);
  });

  it('rolls expressions and parses parameters', () => {
    expect(rollExpr({ dice: 2, sides: 6, plus: 3 }, scriptedRoller([4, 5], createRng(1)))).toEqual({
      value: 12,
      rolls: [4, 5],
    });
    expect(rollExpr(flat(3), seededRoller(createRng(1))).value).toBe(3);
    expect(parseParam('d3')).toEqual({ dice: 1, sides: 3, plus: 0 });
    expect(parseParam('2')).toEqual(flat(2));
    expect(parseParam('4+')).toEqual(flat(4));
    expect(parseParam(undefined, 1)).toEqual(flat(1));
    expect(exprToString({ dice: 2, sides: 6, plus: 1 })).toBe('2D6+1');
  });
});
