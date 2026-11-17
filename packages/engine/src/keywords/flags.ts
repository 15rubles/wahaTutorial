import type { KeywordModule } from './types.js';

/** Keywords that change which shooting / fight options a unit has; read by the phase layer. */
export const assault: KeywordModule = {
  id: 'assault',
  ruleRefs: ['core.core-abilities.assault'],
  flags: ['assault'],
};
export const closeQuarters: KeywordModule = {
  id: 'close-quarters',
  ruleRefs: ['core.core-abilities.close-quarters'],
  flags: ['close-quarters'],
};
/** Identical to close-quarters for all rules purposes. */
export const pistol: KeywordModule = {
  id: 'pistol',
  ruleRefs: ['core.core-abilities.pistol', 'core.core-abilities.close-quarters'],
  flags: ['close-quarters'],
};
export const indirectFire: KeywordModule = {
  id: 'indirect-fire',
  ruleRefs: ['core.core-abilities.indirect-fire'],
  flags: ['indirect'],
};
export const oneShot: KeywordModule = {
  id: 'one-shot',
  ruleRefs: ['core.core-abilities.one-shot'],
  flags: ['one-shot'],
};
export const extraAttacks: KeywordModule = {
  id: 'extra-attacks',
  ruleRefs: ['core.core-abilities.extra-attacks'],
  flags: ['extra-attacks'],
};
