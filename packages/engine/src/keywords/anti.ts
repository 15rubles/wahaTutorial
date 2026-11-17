import { liveKeywords } from '../units/attach.js';
import type { KeywordModule } from './types.js';

/** An unmodified wound roll of Y+ is critical against targets with keyword X. */
export const anti: KeywordModule = {
  id: 'anti',
  ruleRefs: ['core.core-abilities.anti'],
  woundProfile(kw, ctx, p) {
    const threshold = Number((kw.param ?? '').replace('+', ''));
    if (!kw.target || !threshold) return p;
    const wanted = kw.target.split('/').map((k) => k.trim().toUpperCase());
    // RULES-QUESTION: RQ-2 ANTI-X/Y is read as "X or Y".
    const matches = wanted.some((k) => liveKeywords(ctx.target).includes(k));
    return matches ? { ...p, criticalOn: Math.min(p.criticalOn, threshold) } : p;
  },
};
