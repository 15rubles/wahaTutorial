import { type ModelState, type UnitState, aliveModels } from '../types.js';
import { dist } from './geometry.js';

export const ruleRefs = ['core.core-concepts.measuring-distances', 'core.moving.engagement'];

/** Engagement range: within 2" horizontally (03.04). The board is flat, so vertical is ignored. */
export const ENGAGEMENT_RANGE = 2;

/** Closest base edge to closest base edge (01.04). */
export function modelDistance(a: ModelState, b: ModelState): number {
  if (!a.position || !b.position) return Infinity;
  return Math.max(0, dist(a.position, b.position) - a.baseRadius - b.baseRadius);
}

export function unitDistance(a: UnitState, b: UnitState): number {
  let best = Infinity;
  for (const x of aliveModels(a))
    for (const y of aliveModels(b)) best = Math.min(best, modelDistance(x, y));
  return best;
}

/** "Within" means not more than (01.04.01). */
export const within = (d: number, range: number): boolean => d <= range + 1e-9;

export function modelsEngaged(a: ModelState, b: ModelState): boolean {
  return within(modelDistance(a, b), ENGAGEMENT_RANGE);
}

export function unitsEngaged(a: UnitState, b: UnitState): boolean {
  return a.player !== b.player && within(unitDistance(a, b), ENGAGEMENT_RANGE);
}

export function onBattlefield(u: UnitState): boolean {
  return aliveModels(u).some((m) => m.position !== null);
}

/** Base contact: bases touching (tolerance for floating point). */
export function inBaseContact(a: ModelState, b: ModelState): boolean {
  return modelDistance(a, b) <= 0.05;
}
