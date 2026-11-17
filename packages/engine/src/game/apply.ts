import { seededRoller } from '../dice/roller.js';
import type { Roller } from '../dice/roller.js';
import { chargeMove, declareCharge, skipCharge } from '../phases/charge.js';
import { deploy } from '../phases/deployment.js';
import { consolidate, fight, pileIn } from '../phases/fight.js';
import { advanceRoll, move } from '../phases/movement.js';
import { shoot } from '../phases/shooting.js';
import { aliveModels } from '../types.js';
import type { GameAction } from './actions.js';
import { type RuleError, err } from './errors.js';
import { endPhase } from './flow.js';
import type { GameEvent, GameState, Phase } from './state.js';

export type ApplyResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: RuleError };

const PHASE_OF: Partial<Record<GameAction['type'], Phase>> = {
  deploy: 'deployment',
  advanceRoll: 'movement',
  move: 'movement',
  shoot: 'shooting',
  declareCharge: 'charge',
  chargeMove: 'charge',
  skipCharge: 'charge',
  pileIn: 'fight',
  fight: 'fight',
  consolidate: 'fight',
};

function check(state: GameState, action: GameAction): RuleError | null {
  if (state.phase === 'game-over') return err('GAME_OVER');
  const phase = PHASE_OF[action.type];
  if (phase && phase !== state.phase) return err('WRONG_PHASE', `${action.type} in ${state.phase}`);
  if (!('unitId' in action)) return null;
  const unit = state.units[action.unitId];
  if (!unit) return err('UNKNOWN_UNIT', action.unitId);
  if (state.phase === 'deployment') return null;
  if (state.phase === 'fight') {
    const step =
      action.type === 'pileIn' ? 'pile-in' : action.type === 'fight' ? 'fight' : 'consolidate';
    if (state.fightStep !== step)
      return err('WRONG_PHASE', `${action.type} during ${state.fightStep}`);
    if (unit.player !== state.fightSelector) return err('NOT_ACTIVE_PLAYER');
    return null;
  }
  if (unit.player !== state.activePlayer) return err('NOT_YOUR_UNIT', action.unitId);
  return null;
}

function dispatch(
  state: GameState,
  action: GameAction,
  roller: Roller,
): { state: GameState; events: GameEvent[] } | RuleError {
  switch (action.type) {
    case 'deploy':
      return deploy(state, action.unitId, action.positions);
    case 'endPhase':
      return endPhase(state, roller);
    case 'advanceRoll':
      return advanceRoll(state, action.unitId, roller);
    case 'move':
      return move(state, action.unitId, action.moveType, action.positions, roller);
    case 'shoot':
      return shoot(state, action.unitId, action.shootingType, action.targets, roller);
    case 'declareCharge':
      return declareCharge(state, action.unitId, roller);
    case 'chargeMove':
      return chargeMove(state, action.unitId, action.targetIds, action.positions);
    case 'skipCharge':
      return skipCharge(state, action.unitId);
    case 'pileIn':
      return pileIn(state, action.unitId, action.positions);
    case 'fight':
      return fight(
        state,
        action.unitId,
        action.targetId,
        action.weapon,
        action.pileInPositions,
        roller,
      );
    case 'consolidate':
      return consolidate(state, action.unitId, action.positions);
  }
}

/**
 * The single entry point: validate an action, apply it, and return the new state with the events it
 * produced. Pure: the dice come from `state.rng` (or a scripted roller for tutorials).
 */
export function apply(state: GameState, action: GameAction, roller?: Roller): ApplyResult {
  const problem = check(state, action);
  if (problem) return { ok: false, error: problem };
  const dice = roller ?? seededRoller(state.rng);
  const result = dispatch(state, action, dice);
  if ('code' in result) return { ok: false, error: result };
  const events = [...result.events];
  // Report units destroyed by this action.
  for (const [id, before] of Object.entries(state.units)) {
    const after = result.state.units[id]!;
    if (aliveModels(before).length > 0 && aliveModels(after).length === 0)
      events.push({ type: 'UnitDestroyed', unitId: id });
  }
  const next: GameState = { ...result.state, rng: dice.state(), log: [...state.log, ...events] };
  return { ok: true, state: next, events };
}
