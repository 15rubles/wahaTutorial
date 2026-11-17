import { pointInPolygon } from '../board/geometry.js';
import { modelDistance } from '../board/measure.js';
import { type RuleError, err } from '../game/errors.js';
import { type GameEvent, type GameState, withStatus, withUnit } from '../game/state.js';
import { type Point, type UnitState, aliveModels } from '../types.js';
import { validateMove } from './validateMove.js';

export const ruleRefs = [
  'core.strategic-reserves.placing-units-in-strategic-reserves',
  'core.strategic-reserves.arriving-from-strategic-reserves',
  'core.strategic-reserves.ingress-move',
  'core.core-abilities.deep-strike',
];

/** Set-up distance from a battlefield edge for an ingress move (20.04). */
export const INGRESS_EDGE_DISTANCE = 6;
/** Minimum horizontal distance from every enemy unit when arriving (20.04, 24.09). */
export const ARRIVAL_ENEMY_DISTANCE = 8;

export const hasDeepStrike = (u: UnitState): boolean => (u.abilities ?? []).includes('deep-strike');

/** Deployment: put a unit in strategic reserves instead of setting it up (20.01). */
export function placeInReserves(
  state: GameState,
  unitId: string,
): { state: GameState; events: GameEvent[] } | RuleError {
  const unit = state.units[unitId];
  if (!unit) return err('UNKNOWN_UNIT', unitId);
  if (aliveModels(unit).some((m) => m.position)) return err('ALREADY_ACTED', 'already deployed');
  if (unit.keywords.includes('FORTIFICATION'))
    return err('NOT_ELIGIBLE', 'fortifications cannot be in reserves');
  // RULES-QUESTION: RQ-6 the 50% points limit is not checked (the engine does not track points).
  return {
    state: withStatus(state, unitId, { inReserves: true }),
    events: [{ type: 'UnitPlacedInReserves', unitId }],
  };
}

export function canIngress(state: GameState, unitId: string): boolean {
  const st = state.status[unitId];
  return !!st && st.inReserves && !st.moved && state.battleRound >= 2;
}

/** Ingress move (20.04): set up near an edge (or anywhere with Deep Strike), far from enemies. */
export function ingress(
  state: GameState,
  unitId: string,
  positions: readonly Point[],
): { state: GameState; events: GameEvent[] } | RuleError {
  const unit = state.units[unitId];
  if (!unit) return err('UNKNOWN_UNIT', unitId);
  if (!state.status[unitId]?.inReserves) return err('NOT_ELIGIBLE', 'not in reserves');
  if (state.battleRound < 2) return err('NOT_ELIGIBLE', 'reserves arrive from battle round 2');
  const deep = hasDeepStrike(unit);
  const { width, height } = state.battlefield;
  const models = aliveModels(unit);
  if (positions.length !== models.length) return err('BAD_POSITIONS');

  if (!deep) {
    for (let i = 0; i < models.length; i++) {
      const p = positions[i]!;
      const r = models[i]!.baseRadius;
      // Wholly within 6" of one or more battlefield edges.
      const near =
        p.x + r <= INGRESS_EDGE_DISTANCE ||
        width - (p.x - r) <= INGRESS_EDGE_DISTANCE ||
        p.y + r <= INGRESS_EDGE_DISTANCE ||
        height - (p.y - r) <= INGRESS_EDGE_DISTANCE;
      if (!near) return err('NOT_NEAR_EDGE', models[i]!.id);
      if (state.battleRound < 3) {
        const enemyZone = state.battlefield.deploymentZones.find((z) => z.player !== unit.player);
        if (enemyZone && pointInPolygon(p, enemyZone.polygon))
          return err('OUTSIDE_DEPLOYMENT_ZONE', 'enemy zone before round 3');
      }
    }
  }
  const result = validateMove(state, unit, positions, { maxDistance: () => null });
  if ('code' in result) return result;
  const placed = result.unit;
  for (const enemy of Object.values(state.units)) {
    if (enemy.player === unit.player) continue;
    for (const a of aliveModels(placed))
      for (const b of aliveModels(enemy)) {
        if (b.position && modelDistance(a, b) <= ARRIVAL_ENEMY_DISTANCE + 1e-9)
          return err('TOO_CLOSE_TO_ENEMY', enemy.id);
      }
  }
  let next = withUnit(state, placed);
  next = withStatus(next, unitId, { inReserves: false, moved: 'ingress', setUpThisTurn: true });
  return { state: next, events: [{ type: 'UnitArrived', unitId, deepStrike: deep }] };
}
