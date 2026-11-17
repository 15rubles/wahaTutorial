import { dist } from '../board/geometry.js';
import { modelDistance, unitDistance, unitsEngaged, within } from '../board/measure.js';
import type { Roller } from '../dice/roller.js';
import { type RuleError, err } from '../game/errors.js';
import { type GameEvent, type GameState, withStatus, withUnit } from '../game/state.js';
import { type Point, type UnitState, aliveModels } from '../types.js';
import { engagedEnemies, isEngaged, validateMove } from './validateMove.js';

export const ruleRefs = [
  'core.charge-phase.charge-step',
  'core.charge-phase.charge-move',
  'core.core-abilities.fights-first',
];

export const CHARGE_DECLARE_RANGE = 12;

/** Eligible to declare a charge (11.02). */
export function canDeclareCharge(state: GameState, unitId: string): RuleError | null {
  const unit = state.units[unitId];
  const st = state.status[unitId];
  if (!unit || !st) return err('UNKNOWN_UNIT', unitId);
  if (!aliveModels(unit).some((m) => m.position))
    return err('NOT_ELIGIBLE', 'not on the battlefield');
  if (st.declaredCharge) return err('ALREADY_ACTED', 'already declared');
  if (st.moved === 'advance' || st.moved === 'fall-back') return err('NOT_ELIGIBLE', st.moved);
  if (isEngaged(state, unit)) return err('NOT_ELIGIBLE', 'engaged');
  const enemiesNear = Object.values(state.units).some(
    (o) =>
      o.player !== unit.player &&
      aliveModels(o).length > 0 &&
      within(unitDistance(unit, o), CHARGE_DECLARE_RANGE),
  );
  if (!enemiesNear) return err('NO_TARGET', 'no enemy within 12');
  return null;
}

export function declareCharge(
  state: GameState,
  unitId: string,
  roller: Roller,
): { state: GameState; events: GameEvent[] } | RuleError {
  const problem = canDeclareCharge(state, unitId);
  if (problem) return problem;
  const rolls = [roller.d6(), roller.d6()];
  const distance = Math.min(12, rolls[0]! + rolls[1]!);
  return {
    state: withStatus(state, unitId, { declaredCharge: true, chargeRoll: distance }),
    events: [{ type: 'ChargeDeclared', unitId, rolls, distance }],
  };
}

/** Enemy units that can be charge targets with the rolled distance (11.04 Before Moving). */
export function possibleChargeTargets(state: GameState, unitId: string): UnitState[] {
  const unit = state.units[unitId]!;
  const roll = state.status[unitId]?.chargeRoll ?? 0;
  return Object.values(state.units).filter((o) => {
    if (o.player === unit.player || aliveModels(o).length === 0) return false;
    const d = unitDistance(unit, o);
    return within(d, CHARGE_DECLARE_RANGE) && within(d, roll);
  });
}

function closestDistanceTo(p: Point, radius: number, targets: readonly UnitState[]): number {
  let best = Infinity;
  for (const t of targets)
    for (const m of aliveModels(t))
      if (m.position)
        best = Math.min(best, Math.max(0, dist(p, m.position) - radius - m.baseRadius));
  return best;
}

export function chargeMove(
  state: GameState,
  unitId: string,
  targetIds: readonly string[],
  positions: readonly Point[],
): { state: GameState; events: GameEvent[] } | RuleError {
  const unit = state.units[unitId];
  const st = state.status[unitId];
  if (!unit || !st) return err('UNKNOWN_UNIT', unitId);
  if (!st.declaredCharge || st.chargeRoll === null || st.charged)
    return err('NOT_ELIGIBLE', 'declare a charge first');
  if (targetIds.length === 0) return err('NO_TARGET');
  const allowed = new Set(possibleChargeTargets(state, unitId).map((u) => u.id));
  for (const id of targetIds) if (!allowed.has(id)) return err('OUT_OF_RANGE', id);
  const targets = targetIds.map((id) => state.units[id]!);

  const result = validateMove(state, unit, positions, { maxDistance: () => st.chargeRoll });
  if ('code' in result) return result;

  // Each model that moves must end closer to one or more charge targets.
  const before = aliveModels(unit);
  const after = aliveModels(result.unit);
  for (let i = 0; i < before.length; i++) {
    const a = before[i]!;
    const b = after[i]!;
    if (!a.position || !b.position || dist(a.position, b.position) < 1e-6) continue;
    if (
      closestDistanceTo(b.position, b.baseRadius, targets) >=
      closestDistanceTo(a.position, a.baseRadius, targets) - 1e-6
    )
      return err('NOT_CLOSER', b.id);
  }
  // RULES-QUESTION: RQ-4 "each model that can end within 1" / engaged must do so" is not enforced.
  const next = withUnit(state, result.unit);
  for (const t of targets)
    if (!unitsEngaged(result.unit, next.units[t.id]!)) return err('NOT_ALL_TARGETS_ENGAGED', t.id);
  for (const e of engagedEnemies(next, result.unit))
    if (!targetIds.includes(e.id)) return err('ENGAGED_NON_TARGET', e.id);

  return {
    state: withStatus(next, unitId, {
      charged: true,
      maxMoved: Math.max(st.maxMoved, result.moved),
    }),
    events: [{ type: 'ChargeMoved', unitId, targetIds }],
  };
}

export function skipCharge(
  state: GameState,
  unitId: string,
): { state: GameState; events: GameEvent[] } | RuleError {
  const st = state.status[unitId];
  if (!st) return err('UNKNOWN_UNIT', unitId);
  if (!st.declaredCharge || st.charged) return err('NOT_ELIGIBLE');
  return {
    state: withStatus(state, unitId, { chargeRoll: null }),
    events: [{ type: 'ChargeFailed', unitId }],
  };
}

/** True if the model is engaged with any model of the unit (helper for fights and UI). */
export function modelEngagedWith(
  state: GameState,
  modelId: string,
  unitId: string,
  other: UnitState,
): boolean {
  const m = aliveModels(state.units[unitId]!).find((x) => x.id === modelId);
  return !!m && aliveModels(other).some((o) => within(modelDistance(m, o), 2));
}
