import type { Roller } from '../dice/roller.js';
import type { ModelState, UnitState } from '../types.js';
import type { AttackEvent } from './events.js';
import { damageModel } from './inflictDamage.js';

export const ruleRefs = [
  'core.other-concepts.mortal-wounds',
  'core.core-abilities.devastating-wounds',
];

/** Select Model for a mortal wound (06.02). */
export function mortalWoundModel(
  unit: UnitState,
  preferredGroupModelIds?: readonly string[],
): ModelState | undefined {
  const alive = unit.models.filter((m) => !m.destroyed);
  if (preferredGroupModelIds) {
    const preferred = alive.filter((m) => preferredGroupModelIds.includes(m.id));
    const pick = preferred.find((m) => m.woundsLeft < m.wounds) ?? preferred[0];
    if (pick) return pick;
  }
  const wounded = (m: ModelState) => m.woundsLeft < m.wounds;
  const others = alive.filter((m) => !m.isCharacter);
  const chars = alive.filter((m) => m.isCharacter);
  return others.find(wounded) ?? others[0] ?? chars.find(wounded) ?? chars[0];
}

/**
 * Inflicts `count` mortal wounds one at a time. With `oneModelOnly` (devastating wounds), they can
 * damage at most one model: once that model is destroyed the rest are lost.
 */
export function inflictMortalWounds(
  unit: UnitState,
  count: number,
  roller: Roller,
  source: string,
  options: { oneModelOnly?: boolean; preferredModelIds?: readonly string[] } = {},
): { unit: UnitState; events: AttackEvent[] } {
  let current = unit;
  const events: AttackEvent[] = [];
  let lockedModel: string | undefined;
  for (let i = 0; i < count; i++) {
    const model = lockedModel
      ? current.models.find((m) => m.id === lockedModel && !m.destroyed)
      : mortalWoundModel(current, options.preferredModelIds);
    if (!model) break;
    if (options.oneModelOnly) lockedModel = model.id;
    const applied = damageModel(current, model.id, 1, roller);
    current = applied.unit;
    events.push({
      type: 'DamageInflicted',
      weapon: source,
      modelId: model.id,
      damage: 1,
      prevented: applied.prevented,
      woundsLeft: applied.model.woundsLeft,
      mortal: true,
    });
    if (applied.destroyed) {
      events.push({ type: 'ModelDestroyed', unitId: current.id, modelId: model.id });
      if (options.oneModelOnly) break;
    }
  }
  return { unit: current, events };
}
