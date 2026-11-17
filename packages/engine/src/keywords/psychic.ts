import type { KeywordModule } from './types.js';

/** The attacker may ignore modifiers to BS / WS and the hit roll; the engine ignores harmful ones. */
export const psychic: KeywordModule = {
  id: 'psychic',
  ruleRefs: ['core.core-abilities.psychic'],
  flags: ['psychic'],
  hitProfile: (_kw, _ctx, p) => ({ ...p, ignoreNegative: true }),
};
