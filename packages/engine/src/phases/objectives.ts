import { OBJECTIVE_RANGE } from '../board/battlefield.js';
import { within } from '../board/measure.js';
import type { GameEvent, GameState } from '../game/state.js';
import { type PlayerId, aliveModels } from '../types.js';
import { objectiveDistance } from './fight.js';

export const ruleRefs = ['core.objectives.level-of-control', 'core.objectives.terrain-objectives'];

/** Level of control per player for one objective (14.02). Battle-shocked units have OC '-'. */
export function controlLevels(state: GameState, objectiveId: string): Record<PlayerId, number> {
  const obj = state.battlefield.objectives.find((o) => o.id === objectiveId)!;
  const levels: Record<PlayerId, number> = { p1: 0, p2: 0 };
  for (const unit of Object.values(state.units)) {
    if (state.status[unit.id]?.battleShocked) continue;
    for (const m of aliveModels(unit)) {
      if (!m.position) continue;
      const d = objectiveDistance(state, obj.position, obj.terrainAreaId, m);
      const inRange = obj.terrainAreaId ? d <= 1e-9 : within(d, OBJECTIVE_RANGE);
      if (inRange) levels[unit.player] += m.objectiveControl;
    }
  }
  return levels;
}

/** Re-checks control of every objective; called at the end of each phase and turn. */
export function updateObjectiveControl(state: GameState): {
  state: GameState;
  events: GameEvent[];
} {
  const control = { ...state.objectiveControl };
  const events: GameEvent[] = [];
  for (const obj of state.battlefield.objectives) {
    const levels = controlLevels(state, obj.id);
    const owner: PlayerId | null =
      levels.p1 > levels.p2 ? 'p1' : levels.p2 > levels.p1 ? 'p2' : null;
    if (control[obj.id] !== owner)
      events.push({ type: 'ObjectiveControlled', objectiveId: obj.id, player: owner, levels });
    control[obj.id] = owner;
  }
  return { state: { ...state, objectiveControl: control }, events };
}

/** Training mission scoring (invented): VP per controlled objective at the end of your turn. */
export function scoreEndOfTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  const p = state.activePlayer;
  const held = Object.values(state.objectiveControl).filter((o) => o === p).length;
  if (held === 0) return { state, events: [] };
  const amount = held * state.mission.vpPerObjective;
  const vp = state.players[p].vp + amount;
  return {
    state: { ...state, players: { ...state.players, [p]: { ...state.players[p], vp } } },
    events: [{ type: 'VictoryPointsScored', player: p, amount, total: vp }],
  };
}
