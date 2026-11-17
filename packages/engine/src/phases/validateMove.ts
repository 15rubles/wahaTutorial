import {
  pointInPolygon,
  dist,
  segmentCrossesPolygon,
  segmentNearPoint,
} from '../board/geometry.js';
import { inCoherency } from '../board/coherency.js';
import { unitsEngaged } from '../board/measure.js';
import { type RuleError, err } from '../game/errors.js';
import { type GameState, moveModels } from '../game/state.js';
import { type ModelState, type Point, type UnitState, aliveModels } from '../types.js';

export const ruleRefs = [
  'core.moving.moving-units',
  'core.moving.moving-units.moving-a-model-in-a-straight-line',
  'core.moving.moving-units.ending-a-move',
  'core.moving.coherency',
  'core.terrain.terrain-and-movement',
];

export interface MoveRules {
  /** Maximum distance for a model (null = no limit, e.g. set up). */
  readonly maxDistance: (m: ModelState) => number | null;
  /** Desperate escape lets models move through enemy models. */
  readonly throughEnemy?: boolean;
  /** Models that may not move at all (base contact during pile in). */
  readonly frozen?: (m: ModelState) => boolean;
}

/** Moves are straight lines from start to end (rotation is free). See decisions D-029. */
export function validateMove(
  state: GameState,
  unit: UnitState,
  positions: readonly Point[],
  rules: MoveRules,
): { unit: UnitState; moved: number } | RuleError {
  const alive = aliveModels(unit);
  if (positions.length !== alive.length)
    return err('BAD_POSITIONS', `expected ${alive.length} positions`);
  const { width, height, terrain } = state.battlefield;
  const others = Object.values(state.units).filter((u) => u.id !== unit.id);
  let moved = 0;

  for (let i = 0; i < alive.length; i++) {
    const m = alive[i]!;
    const to = positions[i]!;
    const from = m.position;
    if (!Number.isFinite(to.x) || !Number.isFinite(to.y)) return err('BAD_POSITIONS');
    if (
      to.x - m.baseRadius < -1e-6 ||
      to.y - m.baseRadius < -1e-6 ||
      to.x + m.baseRadius > width + 1e-6 ||
      to.y + m.baseRadius > height + 1e-6
    )
      return err('OFF_BATTLEFIELD', m.id);
    if (from) {
      const d = dist(from, to);
      if (d > 1e-6 && rules.frozen?.(m)) return err('NOT_ELIGIBLE', `${m.id} is in base contact`);
      const max = rules.maxDistance(m);
      if (max !== null && d > max + 1e-6)
        return err('TOO_FAR', `${m.id} moved ${d.toFixed(2)} of ${max}`);
      moved = Math.max(moved, d);
      // Bases cannot move through enemy models.
      if (!rules.throughEnemy && d > 1e-6) {
        for (const o of others) {
          if (o.player === unit.player) continue;
          for (const e of aliveModels(o)) {
            if (
              e.position &&
              segmentNearPoint(from, to, e.position, m.baseRadius + e.baseRadius - 0.01)
            )
              return err('THROUGH_ENEMY', `${m.id} through ${e.id}`);
          }
        }
      }
      // Only INFANTRY / BEASTS / SWARM / MOBILE cross dense terrain freely; others are treated as blocked.
      const nimble = ['INFANTRY', 'BEASTS', 'SWARM', 'MOBILE'].some((k) =>
        unit.keywords.includes(k),
      );
      if (!nimble && d > 1e-6) {
        for (const t of terrain) {
          if (!t.categories.includes('dense')) continue;
          const startsInside = pointInPolygon(from, t.polygon);
          if (!startsInside && segmentCrossesPolygon(from, to, t.polygon))
            return err('TERRAIN_BLOCKS', t.id);
        }
      }
    }
  }

  const next = moveModels(unit, positions);
  // Bases cannot end on top of other models.
  const placed = aliveModels(next);
  for (const m of placed) {
    for (const n of placed) if (m !== n && overlap(m, n)) return err('OVERLAPS', m.id);
    for (const o of others)
      for (const e of aliveModels(o))
        if (e.position && overlap(m, e)) return err('OVERLAPS', `${m.id} on ${e.id}`);
  }
  if (!inCoherency(next)) return err('COHERENCY');
  return { unit: next, moved };
}

function overlap(a: ModelState, b: ModelState): boolean {
  if (!a.position || !b.position) return false;
  return dist(a.position, b.position) < a.baseRadius + b.baseRadius - 0.01;
}

export function engagedEnemies(state: GameState, unit: UnitState): UnitState[] {
  return Object.values(state.units).filter(
    (o) => o.player !== unit.player && unitsEngaged(unit, o),
  );
}

export const isEngaged = (state: GameState, unit: UnitState): boolean =>
  engagedEnemies(state, unit).length > 0;
