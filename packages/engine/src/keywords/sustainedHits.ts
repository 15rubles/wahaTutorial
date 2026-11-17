import { parseParam, rollExpr } from '../dice/diceExpr.js';
import type { KeywordModule } from './types.js';

/** A critical hit scores X additional hits. */
export const sustainedHits: KeywordModule = {
  id: 'sustained-hits',
  ruleRefs: ['core.core-abilities.sustained-hits'],
  onCriticalHit: (kw, _ctx, roller) => ({
    extraHits: rollExpr(parseParam(kw.param, 1), roller).value,
  }),
};
