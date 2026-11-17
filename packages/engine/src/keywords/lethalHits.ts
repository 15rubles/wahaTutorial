import type { KeywordModule } from './types.js';

/** A critical hit may automatically wound (the attacker chooses; see AttackContext.lethalHitsAutoWound). */
export const lethalHits: KeywordModule = {
  id: 'lethal-hits',
  ruleRefs: ['core.core-abilities.lethal-hits'],
  onCriticalHit: () => ({ autoWound: true }),
};
