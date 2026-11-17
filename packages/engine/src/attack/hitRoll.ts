import type { Roller } from '../dice/roller.js';
import { hasKeywordId, keywordModule } from '../keywords/registry.js';
import type { HitProfile } from '../keywords/types.js';
import { type WeaponContext, keywordApplies } from './context.js';
import type { HitOutcome, HitRolled } from './events.js';
import { capRollModifier, clampSkill, modifiedRoll } from './modifiers.js';

export const ruleRefs = [
  'core.attack-sequence.hit-roll',
  'core.attack-sequence.hit-roll.critical-hits-and-critical-wounds',
  'core.terrain.benefit-of-cover',
];

export function hitProfile(ctx: WeaponContext): HitProfile {
  let p: HitProfile = {
    autoHit: ctx.weapon.skill === null,
    modifier: ctx.hitModifier,
    skillWorsened: ctx.skillWorsened,
    criticalOn: 6,
    ignoreNegative: false,
    ignoresCover: false,
  };
  for (const kw of ctx.weapon.keywords) {
    const mod = keywordModule(kw.id);
    if (mod?.hitProfile && keywordApplies(kw, ctx.target)) p = mod.hitProfile(kw, ctx, p);
  }
  // Benefit of cover worsens BS by 1 (13.08), unless ignored.
  if (ctx.kind === 'shooting' && ctx.targetHasCover && !p.ignoresCover)
    p = { ...p, skillWorsened: p.skillWorsened + 1 };
  if (p.ignoreNegative)
    p = { ...p, modifier: Math.max(0, p.modifier), skillWorsened: Math.min(0, p.skillWorsened) };
  return p;
}

export interface HitResult {
  readonly event: HitRolled;
  /** Hits that need a wound roll. */
  readonly toWound: number;
  /** Hits that wound automatically (lethal hits). */
  readonly autoWounds: number;
}

export function rollHits(ctx: WeaponContext, dice: number, roller: Roller): HitResult {
  const p = hitProfile(ctx);
  const modifier = capRollModifier(p.modifier);
  const target = p.autoHit ? null : clampSkill((ctx.weapon.skill ?? 6) + p.skillWorsened);
  const rolls: { roll: number | null; outcome: HitOutcome }[] = [];
  let hits = 0;
  let criticals = 0;
  let extraHits = 0;
  let autoWounds = 0;

  const appliedKeywords = ctx.weapon.keywords.filter((k) => keywordApplies(k, ctx.target));
  // Lethal hits is a choice. By default skip it when a critical wound would be worth more.
  const preferCriticalWounds =
    ctx.lethalHitsAutoWound === 'unless-better-on-critical-wound' &&
    appliedKeywords.some((k) => k.id === 'devastating-wounds' || k.id === 'anti');

  for (let i = 0; i < dice; i++) {
    if (p.autoHit) {
      rolls.push({ roll: null, outcome: 'auto' });
      hits += 1;
      continue;
    }
    const roll = roller.d6();
    let outcome: HitOutcome;
    if (roll <= Math.max(1, ctx.hitFailsUpTo) && roll < p.criticalOn) outcome = 'fail';
    else if (roll >= p.criticalOn) outcome = 'critical';
    else outcome = modifiedRoll(roll, modifier) >= target! ? 'hit' : 'fail';
    rolls.push({ roll, outcome });
    if (outcome === 'fail') continue;
    hits += 1;
    if (outcome !== 'critical') continue;
    criticals += 1;
    let auto = false;
    for (const kw of appliedKeywords) {
      const effect = keywordModule(kw.id)?.onCriticalHit?.(kw, ctx, roller);
      if (!effect) continue;
      extraHits += effect.extraHits ?? 0;
      if (effect.autoWound && !preferCriticalWounds) auto = true;
    }
    if (auto) autoWounds += 1;
  }
  const event: HitRolled = {
    type: 'HitRolled',
    weapon: ctx.weapon.name,
    target,
    modifier,
    rolls,
    hits: hits + extraHits,
    criticals,
    extraHits,
    autoWounds,
  };
  return { event, toWound: hits + extraHits - autoWounds, autoWounds };
}

/** True if the weapon's attacks lose cover (for UI explanations). */
export function weaponIgnoresCover(ctx: WeaponContext): boolean {
  return hasKeywordId(ctx.weapon, 'ignores-cover');
}
