import type { KeywordModule } from './types.js';

/** The target cannot have the benefit of cover against these attacks. */
export const ignoresCover: KeywordModule = {
  id: 'ignores-cover',
  ruleRefs: ['core.core-abilities.ignores-cover', 'core.terrain.benefit-of-cover'],
  hitProfile: (_kw, _ctx, p) => ({ ...p, ignoresCover: true }),
};
