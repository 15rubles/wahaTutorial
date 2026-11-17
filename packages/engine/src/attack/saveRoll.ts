import { rollExpr } from '../dice/diceExpr.js';
import type { Roller } from '../dice/roller.js';
import { keywordModule } from '../keywords/registry.js';
import type { UnitState } from '../types.js';
import { allocationOrder, currentGroup, precisionGroupKey, selectModel } from './allocation.js';
import { type WeaponContext, keywordApplies } from './context.js';
import type { AttackEvent, SaveOutcome, SaveRolled } from './events.js';
import { damageModel } from './inflictDamage.js';
import { clampAp } from './modifiers.js';

export const ruleRefs = ['core.attack-sequence.save-rolls', 'core.attack-sequence.inflict-damage'];

/** Check Save Roll (05.04), first matching condition wins. */
export function checkSave(
  roll: number,
  save: number,
  invuln: number | null,
  ap: number,
): SaveOutcome {
  if (roll === 1) return 'damage';
  if (invuln !== null && roll >= invuln) return 'saved-invuln';
  if (Math.max(1, roll + ap) >= save) return 'saved-armour';
  return 'damage';
}

/**
 * Make Save Rolls for every wound at once, then resolve them from lowest to highest against the
 * current allocation group, re-checking the group as models are destroyed.
 */
export function resolveSaves(
  ctx: WeaponContext,
  wounds: number,
  roller: Roller,
): { target: UnitState; events: AttackEvent[]; precisionGroup: string | undefined } {
  let target = ctx.target;
  const events: AttackEvent[] = [];
  const ap = clampAp(ctx.weapon.ap);
  const rolled = Array.from({ length: wounds }, () => roller.d6()).sort((a, b) => a - b);
  const order = allocationOrder(target);
  const usesPrecision = ctx.weapon.keywords.some(
    (k) => k.id === 'precision' && keywordApplies(k, ctx.target),
  );
  const precisionGroup = usesPrecision
    ? precisionGroupKey(target, ctx.visibleCharacterIds)
    : undefined;
  const damageBonus = (): number =>
    ctx.weapon.keywords.reduce((n, kw) => {
      const mod = keywordModule(kw.id);
      return (
        n +
        (mod?.damageBonus && keywordApplies(kw, ctx.target) ? mod.damageBonus(kw, ctx, roller) : 0)
      );
    }, 0);

  const saveRolls: SaveRolled['rolls'][number][] = [];
  const damageEvents: AttackEvent[] = [];
  for (const roll of rolled) {
    const group = currentGroup(target, order, precisionGroup);
    if (!group) break; // every model destroyed: remaining attacks are lost
    const model = selectModel(target, group)!;
    const outcome = checkSave(roll, model.save, model.invuln, ap);
    saveRolls.push({ roll, modelId: model.id, save: model.save, invuln: model.invuln, outcome });
    if (outcome !== 'damage') continue;
    // Random damage is rolled once the model is selected (02.02.03).
    const damage = Math.max(1, rollExpr(ctx.weapon.damage, roller).value + damageBonus());
    const applied = damageModel(target, model.id, damage, roller);
    target = applied.unit;
    damageEvents.push({
      type: 'DamageInflicted',
      weapon: ctx.weapon.name,
      modelId: model.id,
      damage,
      prevented: applied.prevented,
      woundsLeft: applied.model.woundsLeft,
      mortal: false,
    });
    if (applied.destroyed)
      damageEvents.push({ type: 'ModelDestroyed', unitId: target.id, modelId: model.id });
  }
  events.push({
    type: 'SaveRolled',
    weapon: ctx.weapon.name,
    ap,
    rolls: saveRolls,
    failed: saveRolls.filter((r) => r.outcome === 'damage').length,
  });
  events.push(...damageEvents);
  return { target, events, precisionGroup };
}
