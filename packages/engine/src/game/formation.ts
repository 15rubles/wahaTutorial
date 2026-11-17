/** Helpers that compute positions for common moves (UI dragging, scripted opponents, tests). */
import { centroid, dist, len, scale, sub } from '../board/geometry.js';
import { modelDistance } from '../board/measure.js';
import { type Point, type UnitState, aliveModels } from '../types.js';
import type { GameState } from './state.js';

/** Rows of up to `perRow` models, centred on `center`, with a small gap so coherency holds. */
export function formation(unit: UnitState, center: Point, perRow = 5): Point[] {
  const ms = aliveModels(unit);
  const r = Math.max(...ms.map((m) => m.baseRadius));
  const step = 2 * r + 0.5;
  const rows = Math.ceil(ms.length / perRow);
  return ms.map((_, i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, ms.length - row * perRow);
    const col = i % perRow;
    return {
      x: center.x + (col - (inRow - 1) / 2) * step,
      y: center.y + (row - (rows - 1) / 2) * step,
    };
  });
}

export function translate(unit: UnitState, delta: Point): Point[] {
  return aliveModels(unit).map((m) => ({ x: m.position!.x + delta.x, y: m.position!.y + delta.y }));
}

/** Moves the whole unit up to `maxDistance` straight towards `goal` (stopping `stopShort` early). */
export function moveToward(
  unit: UnitState,
  goal: Point,
  maxDistance: number,
  stopShort = 0,
): Point[] {
  const c = centroid(aliveModels(unit).map((m) => m.position!));
  const v = sub(goal, c);
  const d = len(v);
  const travel = Math.max(0, Math.min(maxDistance, d - stopShort));
  return translate(unit, d < 1e-9 ? { x: 0, y: 0 } : scale(v, travel / d));
}

/** Closest pair of models between two units. */
export function closestPair(a: UnitState, b: UnitState) {
  let best = { from: aliveModels(a)[0]!, to: aliveModels(b)[0]!, d: Infinity };
  for (const x of aliveModels(a))
    for (const y of aliveModels(b)) {
      const d = modelDistance(x, y);
      if (d < best.d) best = { from: x, to: y, d };
    }
  return best;
}

/**
 * Translates the unit towards the target so its closest model ends `gap` inches from the closest
 * enemy model. Returns null if that needs more than `maxDistance`.
 */
export function closeTo(
  unit: UnitState,
  target: UnitState,
  maxDistance: number,
  gap = 0.5,
): Point[] | null {
  const pair = closestPair(unit, target);
  if (!pair.from.position || !pair.to.position) return null;
  const need = pair.d - gap;
  if (need <= 0) return translate(unit, { x: 0, y: 0 });
  if (need > maxDistance + 1e-9) return null;
  const v = sub(pair.to.position, pair.from.position);
  return translate(unit, scale(v, need / len(v)));
}

/** Per model: step each model straight at its nearest enemy model, up to `max`, ending `gap` away. */
export function stepModelsToward(
  state: GameState,
  unit: UnitState,
  targets: readonly UnitState[],
  max: number,
  gap = 0.3,
): Point[] {
  return aliveModels(unit).map((m) => {
    let best: { p: Point; d: number; r: number } | null = null;
    for (const t of targets)
      for (const e of aliveModels(t))
        if (e.position) {
          const d = modelDistance(m, e);
          if (!best || d < best.d) best = { p: e.position, d, r: e.baseRadius };
        }
    if (!best || !m.position || best.d <= gap) return m.position!;
    const travel = Math.min(max, best.d - gap);
    const v = sub(best.p, m.position);
    const k = travel / Math.max(1e-9, dist(best.p, m.position));
    return { x: m.position.x + v.x * k, y: m.position.y + v.y * k };
  });
}
