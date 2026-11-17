import type { ModelState, Point, UnitState } from '../types.js';
import { aliveModels } from '../types.js';
import { type Battlefield, type TerrainArea, isObscuring } from './battlefield.js';
import { add, pointInPolygon, segmentCrossesPolygon } from './geometry.js';

export const ruleRefs = [
  'core.other-concepts.visibility',
  'core.terrain.terrain-and-visibility',
  'core.terrain.obscuring',
  'core.terrain.benefit-of-cover',
];

/**
 * 2D line of sight. "Any part of a model to any part of another" is approximated with lines between
 * the base centre and four points on each base edge (25 lines per pair).
 * Models never block line of sight (flag MODELS_BLOCK_LOS): see decisions D-029.
 */
export const MODELS_BLOCK_LOS = false;

function samplePoints(m: ModelState): Point[] {
  const c = m.position!;
  const r = m.baseRadius * 0.95;
  return [
    c,
    add(c, { x: r, y: 0 }),
    add(c, { x: -r, y: 0 }),
    add(c, { x: 0, y: r }),
    add(c, { x: 0, y: -r }),
  ];
}

export function terrainContaining(battlefield: Battlefield, m: ModelState): TerrainArea[] {
  if (!m.position) return [];
  return battlefield.terrain.filter((t) => pointInPolygon(m.position!, t.polygon));
}

/** Obscuring areas that can block a pair: those neither model is within (13.10). */
function blockingAreas(battlefield: Battlefield, a: ModelState, b: ModelState): TerrainArea[] {
  const skip = new Set(
    [...terrainContaining(battlefield, a), ...terrainContaining(battlefield, b)].map((t) => t.id),
  );
  return battlefield.terrain.filter((t) => isObscuring(t) && !skip.has(t.id));
}

function clearLines(
  battlefield: Battlefield,
  a: ModelState,
  b: ModelState,
): { clear: number; total: number } {
  const areas = blockingAreas(battlefield, a, b);
  let clear = 0;
  let total = 0;
  for (const p of samplePoints(a)) {
    for (const q of samplePoints(b)) {
      total += 1;
      if (!areas.some((t) => segmentCrossesPolygon(p, q, t.polygon))) clear += 1;
    }
  }
  return { clear, total };
}

export function modelVisible(
  battlefield: Battlefield,
  observer: ModelState,
  target: ModelState,
): boolean {
  if (!observer.position || !target.position) return false;
  return clearLines(battlefield, observer, target).clear > 0;
}

/** Fully visible: nothing but the target itself blocks any part of it. */
export function modelFullyVisible(
  battlefield: Battlefield,
  observer: ModelState,
  target: ModelState,
): boolean {
  if (!observer.position || !target.position) return false;
  const { clear, total } = clearLines(battlefield, observer, target);
  return clear === total;
}

export function unitVisibleTo(
  battlefield: Battlefield,
  observer: ModelState,
  target: UnitState,
): boolean {
  return aliveModels(target).some((m) => modelVisible(battlefield, observer, m));
}

const COVER_KEYWORDS = ['INFANTRY', 'BEASTS', 'SWARM'];

/**
 * Benefit of cover against attacks from `observer` (13.08): every model in the target unit is either
 * an INFANTRY / BEASTS / SWARM model within a terrain area, or not fully visible because of terrain.
 */
export function hasBenefitOfCover(
  battlefield: Battlefield,
  observer: ModelState,
  target: UnitState,
): boolean {
  const alive = aliveModels(target);
  if (alive.length === 0) return false;
  const footSlogger = COVER_KEYWORDS.some((k) => target.keywords.includes(k));
  return alive.every(
    (m) =>
      (footSlogger && terrainContaining(battlefield, m).length > 0) ||
      !modelFullyVisible(battlefield, observer, m),
  );
}
