import type { KeywordModule } from './types.js';

/** Turns off cover for attacks with this weapon. */
export const ignoresCover: KeywordModule = {
  id: 'ignores-cover',
  ruleRefs: ['core.core-abilities.ignores-cover', 'core.terrain.benefit-of-cover'],
  hitProfile: (_kw, _ctx, p) => ({ ...p, ignoresCover: true }),
};
