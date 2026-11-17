import type { KeywordModule } from './types.js';

/** +1 to the hit roll in the shooting phase when the attacking unit is braced. */
export const heavy: KeywordModule = {
  id: 'heavy',
  ruleRefs: ['core.core-abilities.heavy'],
  flags: ['heavy'],
  hitProfile: (_kw, ctx, p) =>
    ctx.kind === 'shooting' && ctx.attackerBraced ? { ...p, modifier: p.modifier + 1 } : p,
};
