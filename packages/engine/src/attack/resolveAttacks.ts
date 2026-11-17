import { rollExpr } from '../dice/diceExpr.js';
import type { Roller } from '../dice/roller.js';
import { keywordModule } from '../keywords/registry.js';
import { type UnitState, type Weapon, isDestroyed } from '../types.js';
import { allocationOrder } from './allocation.js';
import { type AttackContext, keywordApplies } from './context.js';
import type { AttackEvent } from './events.js';
import { gatherDice } from './gatherDice.js';
import { makeHazardRolls } from './hazard.js';
import { rollHits } from './hitRoll.js';
import { inflictMortalWounds } from './mortalWounds.js';
import { resolveSaves } from './saveRoll.js';
import { rollWounds } from './woundRoll.js';

export const ruleRefs = ['core.making-attacks.resolve-attacks', 'core.attack-sequence'];

export interface WeaponSelection {
  readonly weapon: Weapon;
  /** How many copies of this weapon attack (one per model carrying it). */
  readonly count: number;
}

export interface AttackResult {
  readonly attacker: UnitState;
  readonly target: UnitState;
  readonly events: readonly AttackEvent[];
}

/**
 * Resolves one unit's attacks against one target, weapon by weapon (04.03, 05). Normal damage is
 * resolved before mortal wounds from devastating wounds; hazard rolls come after all attacks.
 */
export function resolveAttacks(
  ctx: AttackContext,
  selections: readonly WeaponSelection[],
  roller: Roller,
): AttackResult {
  let target = ctx.target;
  let attacker = ctx.attacker;
  const events: AttackEvent[] = [];
  const pendingMortal: { count: number; weapon: string; preferred?: readonly string[] }[] = [];
  const startModels = target.models.filter((m) => !m.destroyed).length;
  const startWounds = target.models.reduce((n, m) => n + m.woundsLeft, 0);
  let hazardRolls = 0;

  for (const sel of selections) {
    if (sel.count <= 0) continue;
    const wctx = { ...ctx, target, attacker, weapon: sel.weapon };
    for (const kw of sel.weapon.keywords) {
      const mod = keywordModule(kw.id);
      if (mod?.hazardRolls && keywordApplies(kw, target))
        hazardRolls += mod.hazardRolls(kw, wctx) * sel.count;
    }
    if (isDestroyed(target)) continue;

    const gathered = gatherDice(wctx, sel.count, roller);
    events.push(gathered);
    const hit = rollHits(wctx, gathered.total, roller);
    events.push(hit.event);
    if (hit.toWound + hit.autoWounds === 0) continue;
    const wound = rollWounds(wctx, hit.toWound, hit.autoWounds, roller);
    events.push(wound.event);

    let precisionGroup: string | undefined;
    if (wound.toSave > 0) {
      const saved = resolveSaves({ ...wctx, target }, wound.toSave, roller);
      target = saved.target;
      precisionGroup = saved.precisionGroup;
      events.push(...saved.events);
    }
    if (wound.devastating > 0) {
      const preferred = precisionGroup
        ? allocationOrder(target).find((g) => g.key === precisionGroup)?.modelIds
        : undefined;
      for (let i = 0; i < wound.devastating; i++) {
        const damage = Math.max(1, rollExpr(sel.weapon.damage, roller).value);
        pendingMortal.push({
          count: damage,
          weapon: sel.weapon.name,
          ...(preferred ? { preferred } : {}),
        });
      }
    }
  }

  // Mortal wounds after all normal damage; each critical wound's mortal wounds hit one model at most.
  for (const mw of pendingMortal) {
    const r = inflictMortalWounds(target, mw.count, roller, mw.weapon, {
      oneModelOnly: true,
      ...(mw.preferred ? { preferredModelIds: mw.preferred } : {}),
    });
    target = r.unit;
    events.push(...r.events);
  }

  if (hazardRolls > 0) {
    const h = makeHazardRolls(attacker, hazardRolls, roller);
    attacker = h.unit;
    events.push(...h.events);
  }

  const endModels = target.models.filter((m) => !m.destroyed).length;
  const endWounds = target.models.reduce((n, m) => n + m.woundsLeft, 0);
  events.push({
    type: 'AttacksResolved',
    attackerId: attacker.id,
    targetId: target.id,
    modelsDestroyed: startModels - endModels,
    woundsInflicted: startWounds - endWounds,
  });
  return { attacker, target, events };
}
