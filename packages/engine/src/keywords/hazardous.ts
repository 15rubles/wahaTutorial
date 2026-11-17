import type { KeywordModule } from './types.js';

/** One hazard roll per selected hazardous weapon after the unit's attacks. */
export const hazardous: KeywordModule = {
  id: 'hazardous',
  ruleRefs: ['core.core-abilities.hazardous', 'core.other-concepts.hazard-rolls'],
  hazardRolls: () => 1,
};
