import type { Detachment } from '@battle-drill/data';
import type { BattleSize, ResolvedArmy } from './types.js';

export const ruleRefs = [
  'core.muster-armies.select-battle-size',
  'core.muster-armies.fill-your-army-roster',
  'core.muster-armies.fill-your-army-roster.select-detachments',
];

/** The battle size table (25.03), as read from the cached rules. */
export const BATTLE_SIZES: Readonly<
  Record<
    BattleSize,
    {
      readonly name: string;
      readonly points: number;
      readonly detachmentPoints: number;
      readonly enhancements: number;
      readonly unitLimit: number;
    }
  >
> = {
  incursion: {
    name: 'Incursion',
    points: 1000,
    detachmentPoints: 2,
    enhancements: 2,
    unitLimit: 2,
  },
  'strike-force': {
    name: 'Strike Force',
    points: 2000,
    detachmentPoints: 3,
    enhancements: 4,
    unitLimit: 3,
  },
};

/** Battle size named in roster text, or the smallest one the points fit. */
export function guessBattleSize(
  hints: readonly string[],
  points: number | null,
): BattleSize | null {
  const text = hints.join(' ').toLowerCase();
  if (/strike\s*force/.test(text)) return 'strike-force';
  if (/incursion/.test(text)) return 'incursion';
  if (points === null) return null;
  return points <= BATTLE_SIZES.incursion.points ? 'incursion' : 'strike-force';
}

/**
 * DP cost of a detachment for this army: a keyword specific cost when the army has that keyword
 * (for example a chapter), otherwise the detachment's own cost.
 * RULES-QUESTION: RQ-11 detachments with no DP value in the data count as 0, and a keyword cost
 * applies when any unit in the army has that keyword.
 */
export function detachmentCost(d: Detachment, armyKeywords: readonly string[]): number {
  const kws = new Set(armyKeywords.map((k) => k.toLowerCase()));
  const special = d.keywordPoints.find((k) => kws.has(k.keyword.toLowerCase()));
  return special?.points ?? d.detachmentPoints ?? 0;
}

export interface DetachmentBudget {
  readonly total: number | null;
  readonly used: number;
  readonly left: number | null;
}

export function detachmentBudget(
  army: ResolvedArmy,
  detachments: readonly Detachment[],
  armyKeywords: readonly string[],
): DetachmentBudget {
  const used = army.detachmentIds.reduce((n, id) => {
    const d = detachments.find((x) => x.id === id);
    return n + (d ? detachmentCost(d, armyKeywords) : 0);
  }, 0);
  const total = army.battleSize ? BATTLE_SIZES[army.battleSize].detachmentPoints : null;
  return { total, used, left: total === null ? null : total - used };
}

/** Can this detachment be added without going over the DP of the battle size? */
export function canAddDetachment(
  army: ResolvedArmy,
  detachment: Detachment,
  detachments: readonly Detachment[],
  armyKeywords: readonly string[],
): boolean {
  if (army.detachmentIds.includes(detachment.id)) return false;
  if (army.factionId && detachment.factionId !== army.factionId) return false;
  const { left } = detachmentBudget(army, detachments, armyKeywords);
  return left === null || detachmentCost(detachment, armyKeywords) <= left;
}

/** Armies saved before several detachments existed had one `detachmentId`. */
export function migrateArmy(army: ResolvedArmy & { detachmentId?: string | null }): ResolvedArmy {
  const { detachmentId, ...rest } = army;
  return {
    ...rest,
    detachmentIds: army.detachmentIds ?? (detachmentId ? [detachmentId] : []),
    battleSize: army.battleSize ?? guessBattleSize([], army.points),
  };
}
