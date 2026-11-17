import { rollExpr } from '../dice/diceExpr.js';
import type { Roller } from '../dice/roller.js';
import { keywordModule } from '../keywords/registry.js';
import type { WoundProfile } from '../keywords/types.js';
import { aliveModels, type UnitState } from '../types.js';
import { type WeaponContext, keywordApplies } from './context.js';
import type { WoundOutcome, WoundRolled } from './events.js';
import { capRollModifier, modifiedRoll } from './modifiers.js';
import { requiredWoundRoll } from './woundChart.js';

export const ruleRefs = [
  'core.attack-sequence.wound-roll',
  'core.attack-sequence.wound-roll.multiple-toughness-characteristics',
];

/**
 * Toughness used against a unit (05.02.01): the highest T among bodyguard (non CHARACTER) models if
 * the unit mixes characters with others, otherwise the highest T among its models.
 */
export function unitToughness(unit: UnitState): number {
  const alive = aliveModels(unit);
  const bodyguards = alive.filter((m) => !m.isCharacter);
  const pool = bodyguards.length > 0 && bodyguards.length < alive.length ? bodyguards : alive;
  return Math.max(1, ...pool.map((m) => m.toughness));
}

export function woundProfile(ctx: WeaponContext): WoundProfile {
  let p: WoundProfile = { modifier: ctx.woundModifier, criticalOn: 6, rerollFailed: false };
  for (const kw of ctx.weapon.keywords) {
    const mod = keywordModule(kw.id);
    if (mod?.woundProfile && keywordApplies(kw, ctx.target)) p = mod.woundProfile(kw, ctx, p);
  }
  return p;
}

export interface WoundResult {
  readonly event: WoundRolled;
  /** Wounds that go on to save rolls. */
  readonly toSave: number;
  /** Critical wounds that become mortal wounds instead. */
  readonly devastating: number;
}

export function rollWounds(
  ctx: WeaponContext,
  hits: number,
  autoWounds: number,
  roller: Roller,
): WoundResult {
  const p = woundProfile(ctx);
  const strength = Math.max(1, rollExpr(ctx.weapon.strength, roller).value);
  const toughness = unitToughness(ctx.target);
  const target = requiredWoundRoll(strength, toughness);
  const modifier = capRollModifier(p.modifier);
  const devastatingWeapon = ctx.weapon.keywords.some(
    (k) => keywordApplies(k, ctx.target) && keywordModule(k.id)?.devastating?.(k, ctx),
  );

  const rolls: { roll: number | null; rerolledFrom?: number; outcome: WoundOutcome }[] = [];
  const judge = (roll: number): WoundOutcome =>
    roll === 1
      ? 'fail'
      : roll >= p.criticalOn
        ? 'critical'
        : modifiedRoll(roll, modifier) >= target
          ? 'wound'
          : 'fail';

  let wounds = autoWounds;
  let criticals = 0;
  let devastating = 0;
  for (let i = 0; i < autoWounds; i++) rolls.push({ roll: null, outcome: 'auto' });
  for (let i = 0; i < hits; i++) {
    let roll = roller.d6();
    let outcome = judge(roll);
    let rerolledFrom: number | undefined;
    if (outcome === 'fail' && p.rerollFailed) {
      rerolledFrom = roll;
      roll = roller.d6();
      outcome = judge(roll);
    }
    rolls.push({ roll, outcome, ...(rerolledFrom !== undefined ? { rerolledFrom } : {}) });
    if (outcome === 'fail') continue;
    wounds += 1;
    if (outcome === 'critical') {
      criticals += 1;
      if (devastatingWeapon) devastating += 1;
    }
  }
  const event: WoundRolled = {
    type: 'WoundRolled',
    weapon: ctx.weapon.name,
    strength,
    toughness,
    target,
    modifier,
    rolls,
    wounds,
    criticals,
    devastating,
  };
  return { event, toSave: wounds - devastating, devastating };
}
