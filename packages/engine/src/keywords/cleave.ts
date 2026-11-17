import { parseParam, rollExpr } from '../dice/diceExpr.js';
import type { KeywordModule } from './types.js';

/** Like blast, but only when all of the weapon's attacks target one unit. */
export const cleave: KeywordModule = {
  id: 'cleave',
  ruleRefs: ['core.core-abilities.cleave'],
  extraAttackDice(kw, ctx, roller) {
    if (!ctx.singleTarget) return 0;
    return (
      Math.floor(ctx.targetModelsAtSelect / 5) * rollExpr(parseParam(kw.param, 1), roller).value
    );
  },
};
