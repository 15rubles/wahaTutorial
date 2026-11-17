import type { KeywordModule } from './types.js';

/** +1 to the wound roll if the attacking unit charged this turn. */
export const lance: KeywordModule = {
  id: 'lance',
  ruleRefs: ['core.core-abilities.lance'],
  woundProfile: (_kw, ctx, p) => (ctx.attackerCharged ? { ...p, modifier: p.modifier + 1 } : p),
};
