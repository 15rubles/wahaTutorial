import type { Roller } from '../dice/roller.js';
import { aliveModels, type UnitState } from '../types.js';
import type { AttackEvent } from './events.js';
import { inflictMortalWounds } from './mortalWounds.js';

export const ruleRefs = ['core.other-concepts.hazard-rolls', 'core.core-abilities.hazardous'];

/** Hazard rolls (06.03): 1-2 fails; 1 mortal wound, or 3 if every model is a MONSTER / VEHICLE. */
export function makeHazardRolls(
  unit: UnitState,
  count: number,
  roller: Roller,
): { unit: UnitState; events: AttackEvent[] } {
  if (count <= 0) return { unit, events: [] };
  const rolls = Array.from({ length: count }, () => roller.d6());
  const failed = rolls.filter((r) => r <= 2).length;
  // RULES-QUESTION: RQ-3 "each model is a MONSTER/VEHICLE model" is read from the unit's keywords.
  const big =
    aliveModels(unit).length > 0 &&
    (unit.keywords.includes('MONSTER') || unit.keywords.includes('VEHICLE'));
  const perFail = big ? 3 : 1;
  const mortal = failed * perFail;
  const result = inflictMortalWounds(unit, mortal, roller, 'hazard');
  return {
    unit: result.unit,
    events: [
      { type: 'HazardRolled', unitId: unit.id, rolls, failed, mortalWounds: mortal },
      ...result.events,
    ],
  };
}
