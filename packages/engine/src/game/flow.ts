import { inCoherency } from '../board/coherency.js';
import type { Roller } from '../dice/roller.js';
import { battleShockStep, gainCoreCp } from '../phases/command.js';
import { eligibleToFight, nextFightSelector } from '../phases/fight.js';
import { scoreEndOfTurn, updateObjectiveControl } from '../phases/objectives.js';
import { isEngaged } from '../phases/validateMove.js';
import { type UnitState, aliveModels } from '../types.js';
import {
  type GameEvent,
  type GameState,
  type Phase,
  freshStatus,
  opponent,
  unitsOf,
  withStatus,
} from './state.js';

export const ruleRefs = [
  'core.the-battle-round',
  'core.the-battle-round.start-of-battle-round',
  'core.the-battle-round.player-turns',
  'core.the-battle-round.end-of-battle-round',
  'core.moving.coherency',
  'core.strategic-reserves.placing-units-in-strategic-reserves.strategic-reserves-at-the-end-of-the-battle',
];

type Step = { state: GameState; events: GameEvent[] };

const ORDER: Phase[] = ['command', 'movement', 'shooting', 'charge', 'fight'];

function enterPhase(state: GameState, phase: Phase, roller: Roller): Step {
  let next: GameState = {
    ...state,
    phase,
    fightStep: null,
    fightSelector: null,
    stratagemsThisPhase: [],
  };
  const events: GameEvent[] = [{ type: 'PhaseStarted', phase, player: state.activePlayer }];
  if (phase === 'command') {
    const cp = gainCoreCp(next);
    next = cp.state;
    events.push(...cp.events);
    const shock = battleShockStep(next, next.activePlayer, roller);
    next = shock.state;
    events.push(...shock.events);
  }
  if (phase === 'fight') {
    for (const u of Object.values(next.units)) {
      if (
        aliveModels(u).some((m) => m.position) &&
        (isEngaged(next, u) || next.status[u.id]!.charged)
      )
        next = withStatus(next, u.id, { eligibleToFight: true });
    }
    next = { ...next, fightStep: 'pile-in', fightSelector: next.activePlayer };
    events.push({ type: 'FightStepStarted', step: 'pile-in' });
  }
  return { state: next, events };
}

function startTurn(state: GameState, player: typeof state.activePlayer, roller: Roller): Step {
  const status = Object.fromEntries(
    Object.entries(state.status).map(([id, s]) => [id, freshStatus(s.battleShocked, s.inReserves)]),
  );
  const base: GameState = { ...state, activePlayer: player, status };
  const entered = enterPhase(base, 'command', roller);
  return {
    state: entered.state,
    events: [{ type: 'TurnStarted', player, round: state.battleRound }, ...entered.events],
  };
}

/** End of turn: regain coherency by removing models (03.03), then score. */
function endTurn(state: GameState): Step {
  let next = state;
  const events: GameEvent[] = [];
  for (const unit of Object.values(next.units)) {
    let u: UnitState = unit;
    let changed = false;
    while (aliveModels(u).length > 1 && !inCoherency(u)) {
      const last = aliveModels(u).at(-1)!;
      u = { ...u, models: u.models.map((m) => (m.id === last.id ? { ...m, destroyed: true } : m)) };
      events.push({ type: 'ModelDestroyed', unitId: u.id, modelId: last.id });
      changed = true;
    }
    if (changed) next = { ...next, units: { ...next.units, [u.id]: u } };
  }
  const control = updateObjectiveControl(next);
  next = control.state;
  events.push(...control.events);
  const score = scoreEndOfTurn(next);
  return { state: score.state, events: [...events, ...score.events] };
}

/** Moves the game forward one step when the active player is done with the current phase / step. */
export function endPhase(state: GameState, roller: Roller): Step {
  const events: GameEvent[] = [];
  let next = state;

  if (state.phase === 'deployment') {
    next = { ...next, battleRound: 1 };
    events.push({ type: 'BattleRoundStarted', round: 1 });
    const t = startTurn(next, next.firstPlayer, roller);
    return { state: t.state, events: [...events, ...t.events] };
  }

  if (state.phase === 'movement') {
    // Every unit must be selected to move; any that were not remain stationary (09.02).
    for (const u of unitsOf(next, next.activePlayer)) {
      if (
        !next.status[u.id]!.moved &&
        !next.status[u.id]!.inReserves &&
        aliveModels(u).some((m) => m.position)
      ) {
        next = withStatus(next, u.id, { moved: 'stationary' });
        events.push({
          type: 'UnitMoved',
          unitId: u.id,
          moveType: 'stationary',
          maxDistance: 0,
          moved: 0,
        });
      }
    }
  }

  if (state.phase === 'fight') {
    const active = next.activePlayer;
    if (next.fightStep === 'pile-in' && next.fightSelector === active) {
      return { state: { ...next, fightSelector: opponent(active) }, events };
    }
    if (next.fightStep === 'pile-in') {
      const selector = nextFightSelector(next, null);
      return {
        state: { ...next, fightStep: 'fight', fightSelector: selector },
        events: [{ type: 'FightStepStarted', step: 'fight' }],
      };
    }
    if (next.fightStep === 'fight') {
      // Units that were eligible but did not fight lose the chance; the step ends.
      return {
        state: { ...next, fightStep: 'consolidate', fightSelector: active },
        events: [{ type: 'FightStepStarted', step: 'consolidate' }],
      };
    }
    if (next.fightStep === 'consolidate' && next.fightSelector === active) {
      return { state: { ...next, fightSelector: opponent(active) }, events };
    }
  }

  // End of a phase: objective control is checked at the end of each phase (14.02).
  const control = updateObjectiveControl(next);
  next = control.state;
  events.push(...control.events);

  const idx = ORDER.indexOf(state.phase);
  if (idx >= 0 && idx < ORDER.length - 1) {
    const entered = enterPhase(next, ORDER[idx + 1]!, roller);
    return { state: entered.state, events: [...events, ...entered.events] };
  }

  // End of turn.
  const ended = endTurn(next);
  next = ended.state;
  events.push(...ended.events);
  if (next.activePlayer === next.firstPlayer) {
    const t = startTurn(next, opponent(next.activePlayer), roller);
    return { state: t.state, events: [...events, ...t.events] };
  }
  if (next.battleRound >= next.mission.battleRounds) {
    const { p1, p2 } = next.players;
    const winner = p1.vp > p2.vp ? 'p1' : p2.vp > p1.vp ? 'p2' : null;
    // 20.01.02: reserve units that never arrived count as destroyed when the game ends.
    for (const [id, st] of Object.entries(next.status)) {
      if (!st.inReserves) continue;
      const u = next.units[id]!;
      const models = u.models.map((m) => ({ ...m, destroyed: true }));
      next = { ...next, units: { ...next.units, [id]: { ...u, models } } };
      events.push({ type: 'UnitDestroyed', unitId: id });
    }
    return {
      state: { ...next, phase: 'game-over' },
      events: [...events, { type: 'GameEnded', winner }],
    };
  }
  next = { ...next, battleRound: next.battleRound + 1 };
  events.push({ type: 'BattleRoundStarted', round: next.battleRound });
  const t = startTurn(next, next.firstPlayer, roller);
  return { state: t.state, events: [...events, ...t.events] };
}

/** True when the fight step has no more units to fight. */
export function fightStepDone(state: GameState): boolean {
  return (
    state.phase === 'fight' &&
    state.fightStep === 'fight' &&
    !Object.keys(state.units).some((id) => eligibleToFight(state, id))
  );
}
