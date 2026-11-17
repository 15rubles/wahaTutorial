import { type UnitState, aliveModels } from '../types.js';
import { modelDistance, within } from './measure.js';

export const ruleRefs = ['core.moving.coherency'];

/** Coherency (03.03): each model within 2" of another model and within 9" of every model. */
export function inCoherency(unit: UnitState): boolean {
  const ms = aliveModels(unit).filter((m) => m.position);
  if (ms.length <= 1) return true;
  for (const a of ms) {
    let near = false;
    for (const b of ms) {
      if (a === b) continue;
      const d = modelDistance(a, b);
      if (within(d, 2)) near = true;
      if (!within(d, 9)) return false;
    }
    if (!near) return false;
  }
  return true;
}
