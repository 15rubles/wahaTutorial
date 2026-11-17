import type { GameAction } from './actions.js';
import { apply } from './apply.js';
import type { GameState } from './state.js';

/** A game is its starting state plus the actions taken. Undo and replay come from that. */
export interface History {
  readonly initial: GameState;
  readonly actions: readonly GameAction[];
  readonly current: GameState;
}

export const startHistory = (initial: GameState): History => ({
  initial,
  actions: [],
  current: initial,
});

export function replay(initial: GameState, actions: readonly GameAction[]): GameState {
  let state = initial;
  actions.forEach((a, i) => {
    const r = apply(state, a);
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
): { history: History; result: ReturnType<typeof apply> } {
  const result = apply(history.current, action);
  if (!result.ok) return { history, result };
  return {
    history: { ...history, actions: [...history.actions, action], current: result.state },
    result,
  };
}

export function undo(history: History): History {
  if (history.actions.length === 0) return history;
  const actions = history.actions.slice(0, -1);
  return { ...history, actions, current: replay(history.initial, actions) };
}
