import { scriptedRoller } from '../dice/roller.js';
import type { GameAction } from './actions.js';
import { apply } from './apply.js';
import type { GameState } from './state.js';

/**
 * A game is its starting state plus the actions taken. Undo and replay come from that.
 * Actions played with forced dice (tutorials) keep those dice so replays match.
 */
export interface History {
  readonly initial: GameState;
  readonly actions: readonly GameAction[];
  /** Forced dice per action (null = dice from the game's RNG). Same length as `actions`. */
  readonly scripted: readonly (readonly number[] | null)[];
  readonly current: GameState;
}

export const startHistory = (initial: GameState): History => ({
  initial,
  actions: [],
  scripted: [],
  current: initial,
});

function applyOne(
  state: GameState,
  action: GameAction,
  dice: readonly number[] | null | undefined,
) {
  return apply(
    state,
    action,
    dice && dice.length > 0 ? scriptedRoller(dice, state.rng) : undefined,
  );
}

export function replay(
  initial: GameState,
  actions: readonly GameAction[],
  scripted: readonly (readonly number[] | null)[] = [],
): GameState {
  let state = initial;
  actions.forEach((a, i) => {
    const r = applyOne(state, a, scripted[i]);
    if (!r.ok)
      throw new Error(
        `Replay failed at action ${i} (${a.type}): ${r.error.code} ${r.error.detail}`,
      );
    state = r.state;
  });
  return state;
}

export function record(
  history: History,
  action: GameAction,
  dice?: readonly number[],
): { history: History; result: ReturnType<typeof apply> } {
  const result = applyOne(history.current, action, dice);
  if (!result.ok) return { history, result };
  return {
    history: {
      ...history,
      actions: [...history.actions, action],
      scripted: [...history.scripted, dice && dice.length > 0 ? [...dice] : null],
      current: result.state,
    },
    result,
  };
}

export function undo(history: History): History {
  if (history.actions.length === 0) return history;
  const actions = history.actions.slice(0, -1);
  const scripted = history.scripted.slice(0, -1);
  return { ...history, actions, scripted, current: replay(history.initial, actions, scripted) };
}

/** Replaces the current state (lesson step setup) by starting a new history from it. */
export const restartFrom = (state: GameState): History => startHistory(state);
