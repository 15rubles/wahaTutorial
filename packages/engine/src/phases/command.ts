import type { Roller } from '../dice/roller.js';
import { type GameEvent, type GameState, unitsOf, withStatus } from '../game/state.js';
import type { PlayerId, UnitState } from '../types.js';
import { aliveModels } from '../types.js';

export const ruleRefs = [
  'core.command-phase.gain-core-cp',
  'core.command-phase.battle-shock-step',
  'core.core-concepts.battle-shock-rolls',
  'core.core-concepts.leadership-rolls',
  'core.core-concepts.units-and-models.starting-strength-and-half-strength',
];

/** Gain Core CP: both players gain 1 CP (08.02). */
export function gainCoreCp(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const players = { ...state.players };
  for (const p of ['p1', 'p2'] as const) {
    players[p] = { ...players[p], cp: players[p].cp + 1 };
    events.push({ type: 'CommandPointsGained', player: p, amount: 1, total: players[p].cp });
  }
  return { state: { ...state, players }, events };
}

/** At or below half strength (01.02.01). */
export function atOrBelowHalfStrength(unit: UnitState): boolean {
  const alive = aliveModels(unit);
  if (alive.length === 0) return false;
  if (unit.startingStrength === 1) {
    const m = alive[0]!;
    return m.woundsLeft * 2 <= m.wounds;
  }
  return alive.length * 2 <= unit.startingStrength;
}

/** Leadership roll: 2D6 equal to or greater than one of the unit's Ld (01.06). */
export function leadershipRoll(
  unit: UnitState,
  roller: Roller,
): { rolls: number[]; target: number; passed: boolean } {
  const target = Math.min(...aliveModels(unit).map((m) => m.leadership));
  const rolls = [roller.d6(), roller.d6()];
  return { rolls, target, passed: rolls[0]! + rolls[1]! >= target };
}

/** Battle-shock step (08.03) for the active player's units. */
export function battleShockStep(
  state: GameState,
  player: PlayerId,
  roller: Roller,
): { state: GameState; events: GameEvent[] } {
  let next = state;
  const events: GameEvent[] = [];
  for (const unit of unitsOf(state, player)) {
    if (aliveModels(unit).length === 0 || !aliveModels(unit).some((m) => m.position)) continue;
    const shocked = state.status[unit.id]!.battleShocked;
    if (!shocked && !atOrBelowHalfStrength(unit)) continue;
    const r = leadershipRoll(unit, roller);
    events.push({
      type: 'BattleShockRolled',
      unitId: unit.id,
      rolls: r.rolls,
      target: r.target,
      passed: r.passed,
    });
    next = withStatus(next, unit.id, { battleShocked: !r.passed });
  }
  return { state: next, events };
}
