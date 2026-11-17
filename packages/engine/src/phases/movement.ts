import { makeHazardRolls } from '../attack/hazard.js';
import type { Roller } from '../dice/roller.js';
import { type RuleError, err } from '../game/errors.js';
import {
  type GameEvent,
  type GameState,
  type MoveType,
  withStatus,
  withUnit,
} from '../game/state.js';
import { type Point, aliveModels } from '../types.js';
import { canIngress, ingress } from './reserves.js';
import { isEngaged, validateMove } from './validateMove.js';

export const ruleRefs = [
  'core.movement-phase.move-units-step',
  'core.movement-phase.remain-stationary',
  'core.movement-phase.normal-move',
  'core.movement-phase.advance-move',
  'core.movement-phase.fall-back-move',
  'core.movement-phase.fall-back-move.desperate-escape',
];

type Result = { state: GameState; events: GameEvent[] } | RuleError;

/** Which move types a unit may pick right now. */
export function eligibleMoveTypes(state: GameState, unitId: string): MoveType[] {
  const unit = state.units[unitId];
  const st = state.status[unitId];
  if (!unit || !st || st.moved) return [];
  if (!aliveModels(unit).some((m) => m.position))
    return canIngress(state, unitId) ? ['ingress'] : [];
  const engaged = isEngaged(state, unit);
  return engaged ? ['stationary', 'fall-back'] : ['stationary', 'normal', 'advance'];
}

/** Advance roll: one D6, made before an advance move (09.06). */
export function advanceRoll(state: GameState, unitId: string, roller: Roller): Result {
  const st = state.status[unitId];
  if (!st) return err('UNKNOWN_UNIT', unitId);
  if (!eligibleMoveTypes(state, unitId).includes('advance')) return err('NOT_ELIGIBLE', 'advance');
  if (st.advanceRoll !== null) return err('ALREADY_ACTED', 'advance roll made');
  const roll = roller.d6();
  return {
    state: withStatus(state, unitId, { advanceRoll: roll }),
    events: [{ type: 'AdvanceRolled', unitId, roll }],
  };
}

export function move(
  state: GameState,
  unitId: string,
  moveType: MoveType,
  positions: readonly Point[] | undefined,
  roller: Roller,
): Result {
  const unit = state.units[unitId];
  const st = state.status[unitId];
  if (!unit || !st) return err('UNKNOWN_UNIT', unitId);
  if (!eligibleMoveTypes(state, unitId).includes(moveType)) return err('NOT_ELIGIBLE', moveType);

  if (moveType === 'ingress') {
    if (!positions) return err('BAD_POSITIONS', 'positions required');
    const r = ingress(state, unitId, positions);
    if ('code' in r) return r;
    return {
      state: r.state,
      events: [...r.events, { type: 'UnitMoved', unitId, moveType, maxDistance: 0, moved: 0 }],
    };
  }
  if (moveType === 'stationary') {
    return {
      state: withStatus(state, unitId, { moved: 'stationary' }),
      events: [{ type: 'UnitMoved', unitId, moveType, maxDistance: 0, moved: 0 }],
    };
  }
  if (moveType === 'advance' && st.advanceRoll === null)
    return err('NOT_ELIGIBLE', 'make the advance roll first');
  if (!positions) return err('BAD_POSITIONS', 'positions required');

  const bonus = moveType === 'advance' ? st.advanceRoll! : 0;
  // Desperate escape when battle-shocked (09.07): may move through enemy models.
  const desperate = moveType === 'fall-back' && st.battleShocked;
  const result = validateMove(state, unit, positions, {
    maxDistance: (m) => (m.movement ?? 0) + bonus,
    throughEnemy: desperate,
  });
  if ('code' in result) return result;
  let next = withUnit(state, result.unit);
  if (isEngaged(next, result.unit)) return err('ENDS_ENGAGED');

  const events: GameEvent[] = [];
  const maxDistance = Math.max(...aliveModels(unit).map((m) => (m.movement ?? 0) + bonus));
  events.push({ type: 'UnitMoved', unitId, moveType, maxDistance, moved: result.moved });
  next = withStatus(next, unitId, {
    moved: moveType,
    maxMoved: Math.max(st.maxMoved, result.moved),
  });

  if (desperate) {
    // One hazard roll per model, then a battle-shock roll if the unit is not battle-shocked.
    const h = makeHazardRolls(next.units[unitId]!, aliveModels(unit).length, roller);
    next = withUnit(next, h.unit);
    events.push(...h.events);
  }
  return { state: next, events };
}
