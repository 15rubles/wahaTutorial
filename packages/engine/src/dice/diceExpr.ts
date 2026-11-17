import type { Roller } from './roller.js';

/** Same shape as the data package's DiceExpr: `D6+1` is { dice: 1, sides: 6, plus: 1 }. */
export interface DiceExpr {
  readonly dice: number;
  readonly sides: number;
  readonly plus: number;
}

export const ruleRefs = [
  'core.core-concepts.dice',
  'core.datasheets.profiles.random-characteristics',
];

export const flat = (n: number): DiceExpr => ({ dice: 0, sides: 0, plus: n });

/** D3 is a D6 halved, rounding up (01.05). */
export function rollDie(sides: number, roller: Roller): number {
  const d = roller.d6();
  if (sides === 6) return d;
  if (sides === 3) return Math.ceil(d / 2);
  // Other die sizes do not appear in the data; scale a D6 as a fallback.
  return Math.max(1, Math.ceil((d / 6) * sides));
}

export function rollExpr(expr: DiceExpr, roller: Roller): { value: number; rolls: number[] } {
  const rolls: number[] = [];
  for (let i = 0; i < expr.dice; i++) rolls.push(rollDie(expr.sides, roller));
  return { value: rolls.reduce((a, b) => a + b, 0) + expr.plus, rolls };
}

export function isRandom(expr: DiceExpr): boolean {
  return expr.dice > 0;
}

/** Parses a keyword parameter like `1`, `d3`, `2d6+1`. */
export function parseParam(param: string | undefined, fallback = 1): DiceExpr {
  if (!param) return flat(fallback);
  const s = param.trim().toLowerCase().replace(/\+$/, '');
  if (/^\d+$/.test(s)) return flat(Number(s));
  const m = /^(\d*)d(\d+)(?:\+(\d+))?$/.exec(s);
  if (!m) return flat(fallback);
  return { dice: m[1] ? Number(m[1]) : 1, sides: Number(m[2]), plus: m[3] ? Number(m[3]) : 0 };
}

export function exprToString(e: DiceExpr): string {
  if (e.dice === 0) return String(e.plus);
  return `${e.dice > 1 ? e.dice : ''}D${e.sides}${e.plus ? `+${e.plus}` : ''}`;
}
