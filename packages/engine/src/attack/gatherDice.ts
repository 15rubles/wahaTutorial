import { rollExpr } from '../dice/diceExpr.js';
import type { Roller } from '../dice/roller.js';
import { keywordModule } from '../keywords/registry.js';
import { type WeaponContext, keywordApplies } from './context.js';
import type { AttackDiceGathered } from './events.js';

export const ruleRefs = [
  'core.making-attacks.resolve-attacks',
  'core.datasheets.profiles.random-characteristics',
];

/**
 * Attack dice for `count` copies of a weapon. A random A is rolled for each copy; abilities that add
 * dice (blast, rapid fire, cleave) add them per copy.
 */
export function gatherDice(ctx: WeaponContext, count: number, roller: Roller): AttackDiceGathered {
  let base = 0;
  const bonus = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    base += Math.max(1, rollExpr(ctx.weapon.attacks, roller).value);
    for (const kw of ctx.weapon.keywords) {
      const mod = keywordModule(kw.id);
      if (!mod?.extraAttackDice || !keywordApplies(kw, ctx.target)) continue;
      const extra = mod.extraAttackDice(kw, ctx, roller);
      if (extra > 0) bonus.set(kw.id, (bonus.get(kw.id) ?? 0) + extra);
    }
  }
  const bonusList = [...bonus].map(([keyword, dice]) => ({ keyword, dice }));
  return {
    type: 'AttackDiceGathered',
    weapon: ctx.weapon.name,
    base,
    bonus: bonusList,
    total: base + bonusList.reduce((n, b) => n + b.dice, 0),
  };
}
