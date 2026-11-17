import type { KeywordModule } from './types.js';

/** Attacks hit automatically (no roll, so never critical). */
export const torrent: KeywordModule = {
  id: 'torrent',
  ruleRefs: [
    'core.core-abilities.torrent',
    'core.core-concepts.dice.automatically-successful-passes-hits-wounds',
  ],
  hitProfile: (_kw, _ctx, p) => ({ ...p, autoHit: true }),
};
