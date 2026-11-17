import { parseParam, rollExpr } from '../dice/diceExpr.js';
import type { KeywordModule } from './types.js';

/** X (default 1) extra attack dice per five models in the target unit at Select Targets. */
export const blast: KeywordModule = {
  id: 'blast',
  ruleRefs: ['core.core-abilities.blast'],
  extraAttackDice(kw, ctx, roller) {
    const per = rollExpr(parseParam(kw.param, 1), roller).value;
    return Math.floor(ctx.targetModelsAtSelect / 5) * per;
  },
};
