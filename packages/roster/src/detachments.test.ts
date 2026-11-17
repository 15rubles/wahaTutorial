import type { Detachment } from '@battle-drill/data';
import { describe, expect, it } from 'vitest';
import {
  canAddDetachment,
  detachmentBudget,
  detachmentCost,
  guessBattleSize,
  migrateArmy,
} from './detachments.js';
import type { ResolvedArmy } from './types.js';

const det = (id: string, dp: number | null, keywordPoints: Detachment['keywordPoints'] = []) =>
  ({ id, factionId: 'RP', name: id, detachmentPoints: dp, keywordPoints }) as unknown as Detachment;
const pool = [det('a', 1), det('b', 2), det('c', 1, [{ keyword: 'Rust Order', points: 2 }])];
const army = (ids: string[], size: ResolvedArmy['battleSize'] = 'incursion') =>
  ({
    factionId: 'RP',
    detachmentIds: ids,
    battleSize: size,
    points: 1000,
  }) as unknown as ResolvedArmy;

describe('detachments', () => {
  it('guesses the battle size from roster text or points', () => {
    expect(guessBattleSize(['Strike Force (2000 points)'], null)).toBe('strike-force');
    expect(guessBattleSize([], 990)).toBe('incursion');
    expect(guessBattleSize([], 1500)).toBe('strike-force');
  });

  it('uses a keyword cost when the army has that keyword', () => {
    expect(detachmentCost(pool[2]!, ['INFANTRY'])).toBe(1);
    expect(detachmentCost(pool[2]!, ['RUST ORDER'])).toBe(2);
  });

  it('keeps detachments within the DP of the battle size', () => {
    expect(detachmentBudget(army(['a']), pool, [])).toEqual({ total: 2, used: 1, left: 1 });
    expect(canAddDetachment(army(['a']), pool[1]!, pool, [])).toBe(false);
    expect(canAddDetachment(army(['a']), pool[2]!, pool, [])).toBe(true);
    expect(canAddDetachment(army(['a'], 'strike-force'), pool[1]!, pool, [])).toBe(true);
    expect(canAddDetachment(army(['a']), pool[0]!, pool, [])).toBe(false);
  });

  it('migrates armies saved with one detachment', () => {
    const old = { ...army([]), detachmentIds: undefined, battleSize: null, detachmentId: 'b' };
    expect(migrateArmy(old as never)).toMatchObject({
      detachmentIds: ['b'],
      battleSize: 'incursion',
    });
  });
});
