import type { KeywordModule } from './types.js';

/** A critical wound ends the sequence and inflicts mortal wounds equal to D, one model at most. */
export const devastatingWounds: KeywordModule = {
  id: 'devastating-wounds',
  ruleRefs: ['core.core-abilities.devastating-wounds', 'core.other-concepts.mortal-wounds'],
  devastating: () => true,
};
