/** Parsers for characteristic strings as they appear in the export (`6"`, `3+`, `D6+1`, `-`). */

export interface DiceExpr {
  /** Number of dice (0 for a flat value). */
  readonly dice: number;
  /** Sides per die (0 for a flat value). */
  readonly sides: number;
  readonly plus: number;
  readonly raw: string;
}

const EMPTY = new Set(['', '-', 'n/a', '*']);

export function isEmptyValue(raw: string | undefined): boolean {
  return raw === undefined || EMPTY.has(raw.trim().toLowerCase());
}

/** `6` -> 6, `D6+1` -> 1d6+1, `2D3` -> 2d3. Returns undefined if not a dice expression. */
export function parseDice(raw: string): DiceExpr | undefined {
  const s = raw.trim().replace(/\s+/g, '');
  if (/^\d+$/.test(s)) return { dice: 0, sides: 0, plus: Number(s), raw };
  const m = /^(\d*)[dD](\d+)(?:\+(\d+))?$/.exec(s);
  if (!m) return undefined;
  return { dice: m[1] ? Number(m[1]) : 1, sides: Number(m[2]), plus: m[3] ? Number(m[3]) : 0, raw };
}

/** Leading integer of values like `6"`, `3+`, `12`, `20+"`. */
export function parseLeadingInt(raw: string): number | undefined {
  const m = /^\s*(-?\d+)/.exec(raw);
  return m ? Number(m[1]) : undefined;
}

/** `Melee` -> null (melee weapon), `24"` -> 24. */
export function parseRange(raw: string): number | null | undefined {
  if (/^\s*melee\s*$/i.test(raw)) return null;
  return parseLeadingInt(raw);
}

export function parseBool(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === 'true';
}

export function blankToUndefined(raw: string | undefined): string | undefined {
  const s = raw?.trim();
  return s ? s : undefined;
}
