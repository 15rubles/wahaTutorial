import type { KeywordModule } from './types.js';

/** Lets the attacker pick a visible CHARACTER allocation group (handled in allocation.ts). */
export const precision: KeywordModule = {
  id: 'precision',
  ruleRefs: ['core.core-abilities.precision'],
};
