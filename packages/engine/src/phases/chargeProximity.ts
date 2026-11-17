import { inCoherency } from '../board/coherency.js';
import { dist, pointInPolygon } from '../board/geometry.js';
import { ENGAGEMENT_RANGE } from '../board/measure.js';
import { closeTo } from '../game/formation.js';
import type { GameState } from '../game/state.js';
import { type ModelState, type Point, type UnitState, aliveModels } from '../types.js';

export const ruleRefs = ['core.charge-phase.charge-move'];

/**
 * RULES-QUESTION: RQ-4. "Each model that can end within 1" (then: engaged) must do so" asks about
 * every possible placement. We check a simpler, conservative version: a model breaks the rule only
 * if one straight-line spot next to a target model was free for it (on the battlefield, outside
 * terrain, no overlapping bases, unit still coherent, within the charge roll). Turn off with the flag.
 */
export const ENFORCE_CHARGE_PROXIMITY = true;
export const CHARGE_CLOSE_DISTANCE = 1;

const EPS = 1e-6;
const ANGLES = [0, 20, -20, 40, -40, 60, -60, 90, -90, 120, -120, 150, -150, 180];

function edgeDistance(p: Point, r: number, targets: readonly UnitState[]): number {
  let best = Infinity;
  for (const t of targets)
    for (const m of aliveModels(t))
      if (m.position) best = Math.min(best, Math.max(0, dist(p, m.position) - r - m.baseRadius));
  return best;
}

function freeSpot(
  state: GameState,
  after: UnitState,
  index: number,
  start: Point,
  spot: Point,
  roll: number,
): boolean {
  const model = aliveModels(after)[index]!;
  const r = model.baseRadius;
  const { width, height, terrain } = state.battlefield;
  if (dist(start, spot) > roll + EPS) return false;
  if (spot.x - r < 0 || spot.y - r < 0 || spot.x + r > width || spot.y + r > height) return false;
  if (terrain.some((t) => pointInPolygon(spot, t.polygon))) return false;
  const clash = (o: ModelState) =>
    !!o.position && o.id !== model.id && dist(o.position, spot) < o.baseRadius + r - 0.01;
  for (const u of Object.values(state.units)) {
    const models = u.id === after.id ? aliveModels(after) : aliveModels(u);
    if (models.some(clash)) return false;
  }
  const moved = {
    ...after,
    models: after.models.map((m) => (m.id === model.id ? { ...m, position: spot } : m)),
  };
  return inCoherency(moved);
}

/**
 * The id of a model that ended further than `threshold` from every charge target although it had a
 * free spot within `threshold`, or null.
 */
function missed(
  state: GameState,
  before: UnitState,
  after: UnitState,
  targets: readonly UnitState[],
  roll: number,
  threshold: number,
): string | null {
  const starts = aliveModels(before);
  const ends = aliveModels(after);
  for (let i = 0; i < ends.length; i++) {
    const end = ends[i]!;
    const start = starts[i]?.position;
    if (!end.position || !start) continue;
    if (edgeDistance(end.position, end.baseRadius, targets) <= threshold + EPS) continue;
    for (const t of targets)
      for (const tm of aliveModels(t)) {
        if (!tm.position) continue;
        const gap = tm.baseRadius + end.baseRadius + threshold - 0.05;
        const base = Math.atan2(start.y - tm.position.y, start.x - tm.position.x);
        for (const a of ANGLES) {
          const ang = base + (a * Math.PI) / 180;
          const spot = {
            x: tm.position.x + Math.cos(ang) * gap,
            y: tm.position.y + Math.sin(ang) * gap,
          };
          if (freeSpot(state, after, i, start, spot, roll)) return end.id;
        }
      }
  }
  return null;
}

/** Checks both "within 1"" and "engaged" requirements of a charge move. */
export function chargeProximityProblem(
  state: GameState,
  before: UnitState,
  after: UnitState,
  targets: readonly UnitState[],
  roll: number,
): { code: 'MUST_END_WITHIN_1' | 'MUST_END_ENGAGED'; modelId: string } | null {
  if (!ENFORCE_CHARGE_PROXIMITY) return null;
  const near = missed(state, before, after, targets, roll, CHARGE_CLOSE_DISTANCE);
  if (near) return { code: 'MUST_END_WITHIN_1', modelId: near };
  const engaged = missed(state, before, after, targets, roll, ENGAGEMENT_RANGE);
  if (engaged) return { code: 'MUST_END_ENGAGED', modelId: engaged };
  return null;
}

/** Free spots within `threshold` of a target model for model `index`, nearest to `from` first. */
function spotsFor(
  state: GameState,
  after: UnitState,
  index: number,
  start: Point,
  from: Point,
  targets: readonly UnitState[],
  roll: number,
  threshold: number,
): Point[] {
  const model = aliveModels(after)[index]!;
  const out: Point[] = [];
  for (const t of targets)
    for (const tm of aliveModels(t)) {
      if (!tm.position) continue;
      const gap = tm.baseRadius + model.baseRadius + threshold - 0.05;
      const base = Math.atan2(start.y - tm.position.y, start.x - tm.position.x);
      for (const a of ANGLES) {
        const ang = base + (a * Math.PI) / 180;
        const spot = {
          x: tm.position.x + Math.cos(ang) * gap,
          y: tm.position.y + Math.sin(ang) * gap,
        };
        if (freeSpot(state, after, index, start, spot, roll)) out.push(spot);
      }
    }
  return out.sort((a, b) => dist(a, from) - dist(b, from));
}

/**
 * Charge move positions that follow the proximity rules as the engine checks them: the unit slides
 * in as one block, then each model that could get closer is moved to the nearest free spot within
 * 1" of a target model (or, failing that, into engagement range). Null if no block move reaches.
 */
export function chargePositions(
  state: GameState,
  unit: UnitState,
  targets: readonly UnitState[],
  roll: number,
  gap = 0.5,
): Point[] | null {
  const first = targets[0];
  if (!first) return null;
  const block = closeTo(unit, first, roll, gap);
  if (!block) return null;
  const starts = aliveModels(unit).map((m) => m.position!);
  let after: UnitState = {
    ...unit,
    models: unit.models.map((m) => {
      const i = aliveModels(unit).indexOf(m);
      return i >= 0 ? { ...m, position: block[i]! } : m;
    }),
  };
  for (const threshold of [CHARGE_CLOSE_DISTANCE, ENGAGEMENT_RANGE]) {
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      const models = aliveModels(after);
      for (let i = 0; i < models.length; i++) {
        const m = models[i]!;
        if (edgeDistance(m.position!, m.baseRadius, targets) <= threshold + EPS) continue;
        const spot = spotsFor(
          state,
          after,
          i,
          starts[i]!,
          m.position!,
          targets,
          roll,
          threshold,
        )[0];
        if (!spot) continue;
        after = {
          ...after,
          models: after.models.map((x) => (x.id === m.id ? { ...x, position: spot } : x)),
        };
        changed = true;
      }
      if (!changed) break;
    }
  }
  return aliveModels(after).map((m) => m.position!);
}
