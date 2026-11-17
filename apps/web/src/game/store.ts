import {
  type GameAction,
  type GameEvent,
  type GameState,
  type History,
  type Point,
  type RuleError,
  actingPlayer,
  nextAiAction,
  record,
  startHistory,
  undo,
} from '@battle-drill/engine';
import { create } from 'zustand';

export type DragMode = 'normal' | 'advance' | 'fall-back';

interface GameUiState {
  history: History | null;
  selectedUnitId: string | null;
  pending: { unitId: string; positions: Point[] } | null;
  dragMode: DragMode;
  /** Events from the last player action plus any opponent actions after it. */
  lastEvents: GameEvent[];
  lastError: RuleError | null;
  /** Bumped each time dice are rolled, to replay the dice tray animation. */
  rollId: number;
  start(state: GameState): void;
  act(action: GameAction): boolean;
  undo(): void;
  select(unitId: string | null): void;
  setPending(p: { unitId: string; positions: Point[] } | null): void;
  setDragMode(m: DragMode): void;
  clearError(): void;
}

const MAX_AI_STEPS = 400;

/** Lets the scripted opponent act until the game waits on the player again. */
function runOpponent(history: History): { history: History; events: GameEvent[] } {
  let h = history;
  const events: GameEvent[] = [];
  for (let i = 0; i < MAX_AI_STEPS; i++) {
    const s = h.current;
    if (s.phase === 'game-over' || actingPlayer(s) !== 'p2') break;
    const action = nextAiAction(s, 'p2');
    if (!action) break;
    const { history: next, result } = record(h, action);
    if (!result.ok) break;
    h = next;
    events.push(...result.events);
  }
  return { history: h, events };
}

export const useGame = create<GameUiState>((set, get) => ({
  history: null,
  selectedUnitId: null,
  pending: null,
  dragMode: 'normal',
  lastEvents: [],
  lastError: null,
  rollId: 0,
  start(state) {
    set({
      history: startHistory(state),
      selectedUnitId: null,
      pending: null,
      lastEvents: [],
      lastError: null,
    });
  },
  act(action) {
    const { history } = get();
    if (!history) return false;
    const { history: next, result } = record(history, action);
    if (!result.ok) {
      set({ lastError: result.error });
      return false;
    }
    const opp = runOpponent(next);
    const events = [...result.events, ...opp.events];
    const rolled = events.some(
      (e) =>
        e.type === 'HitRolled' ||
        e.type === 'ChargeDeclared' ||
        e.type === 'AdvanceRolled' ||
        e.type === 'BattleShockRolled',
    );
    set((s) => ({
      history: opp.history,
      lastEvents: events,
      lastError: null,
      pending: null,
      rollId: rolled ? s.rollId + 1 : s.rollId,
    }));
    return true;
  },
  undo() {
    const { history } = get();
    if (!history || history.actions.length === 0) return;
    // Undo back to the last state where the player was deciding.
    let h = undo(history);
    while (h.actions.length > 0 && actingPlayer(h.current) === 'p2') h = undo(h);
    set({ history: h, pending: null, lastEvents: [], lastError: null });
  },
  select(unitId) {
    set({ selectedUnitId: unitId, pending: null, lastError: null });
  },
  setPending(pending) {
    set({ pending });
  },
  setDragMode(dragMode) {
    set({ dragMode, pending: null });
  },
  clearError() {
    set({ lastError: null });
  },
}));

export const currentState = (): GameState | undefined => useGame.getState().history?.current;
