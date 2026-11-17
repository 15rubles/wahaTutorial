import type { KeywordModule } from './types.js';

/** The wound roll may be re-rolled; the engine re-rolls failed wound rolls. */
export const twinLinked: KeywordModule = {
  id: 'twin-linked',
  ruleRefs: ['core.core-abilities.twin-linked', 'core.core-concepts.dice.re-rolls'],
  woundProfile: (_kw, _ctx, p) => ({ ...p, rerollFailed: true }),
};
