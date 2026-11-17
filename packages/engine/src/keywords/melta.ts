import { parseParam, rollExpr } from '../dice/diceExpr.js';
import type { KeywordModule } from './types.js';

/** +X to D when the target was within half range. */
export const melta: KeywordModule = {
  id: 'melta',
  ruleRefs: ['core.core-abilities.melta'],
  damageBonus: (kw, ctx, roller) =>
    ctx.withinHalfRange ? rollExpr(parseParam(kw.param, 1), roller).value : 0,
};
