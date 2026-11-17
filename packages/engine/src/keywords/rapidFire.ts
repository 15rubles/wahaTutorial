import { parseParam, rollExpr } from '../dice/diceExpr.js';
import type { KeywordModule } from './types.js';

/** X extra attack dice when the target was within half range. */
export const rapidFire: KeywordModule = {
  id: 'rapid-fire',
  ruleRefs: ['core.core-abilities.rapid-fire'],
  extraAttackDice(kw, ctx, roller) {
    return ctx.withinHalfRange ? rollExpr(parseParam(kw.param, 1), roller).value : 0;
  },
};
