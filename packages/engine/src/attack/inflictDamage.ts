import type { Roller } from '../dice/roller.js';
import type { ModelState, UnitState } from '../types.js';

export const ruleRefs = [
  'core.attack-sequence.inflict-damage',
  'core.attack-sequence.inflict-damage.destroyed',
  'core.core-abilities.feel-no-pain',
];

export interface DamageApplied {
  readonly unit: UnitState;
  readonly model: ModelState;
  readonly lost: number;
  readonly prevented: number;
  readonly destroyed: boolean;
}

/**
 * The model loses `damage` wounds (Feel No Pain rolled per wound). Wounds beyond what the model has
 * left are lost: damage never spills over to another model.
 */
export function damageModel(
  unit: UnitState,
  modelId: string,
  damage: number,
  roller: Roller,
): DamageApplied {
  const model = unit.models.find((m) => m.id === modelId)!;
  let prevented = 0;
  let toLose = 0;
  for (let i = 0; i < damage; i++) {
    if (model.feelNoPain !== null && roller.d6() >= model.feelNoPain) prevented += 1;
    else toLose += 1;
  }
  const lost = Math.min(toLose, model.woundsLeft);
  const woundsLeft = model.woundsLeft - lost;
  const updated: ModelState = { ...model, woundsLeft, destroyed: woundsLeft <= 0 };
  return {
    unit: { ...unit, models: unit.models.map((m) => (m.id === modelId ? updated : m)) },
    model: updated,
    lost,
    prevented,
    destroyed: updated.destroyed,
  };
}
