import type { GameState } from '@battle-drill/engine';
import { useGame } from '../game/store.js';

const PHASE_LABEL: Record<string, string> = {
  deployment: 'Deployment',
  command: 'Command phase',
  movement: 'Movement phase',
  shooting: 'Shooting phase',
  charge: 'Charge phase',
  fight: 'Fight phase',
  'game-over': 'Game over',
};

const STEP_LABEL: Record<string, string> = {
  'pile-in': 'Pile in',
  fight: 'Fight step',
  consolidate: 'Consolidate',
};

export function endPhaseLabel(state: GameState): string {
  if (state.phase === 'fight')
    return `End ${STEP_LABEL[state.fightStep ?? 'fight']?.toLowerCase()}`;
  if (state.phase === 'deployment') return 'Start the battle';
  return `End ${PHASE_LABEL[state.phase]?.toLowerCase()}`;
}

export function PhaseBar({ state }: { state: GameState }) {
  const { act, undo, history } = useGame();
  const yourTurn = state.activePlayer === 'p1';
  return (
    <div className="phase-bar" data-testid="phase-bar" data-tutorial-id="phase-bar">
      <span data-testid="round">Round {state.battleRound}</span>
      <span className={yourTurn ? 'turn-you' : 'turn-them'}>
        {yourTurn ? 'Your turn' : 'Opponent’s turn'}
      </span>
      <strong data-testid="phase">
        {PHASE_LABEL[state.phase]}
        {state.fightStep && ` - ${STEP_LABEL[state.fightStep]}`}
      </strong>
      <span title="Command points">CP {state.players.p1.cp}</span>
      <span title="Victory points">
        VP {state.players.p1.vp} : {state.players.p2.vp}
      </span>
      <span className="spacer" />
      <button
        type="button"
        onClick={undo}
        disabled={!history?.actions.length}
        data-tutorial-id="undo"
      >
        Undo
      </button>
      <button
        type="button"
        className="primary"
        onClick={() => act({ type: 'endPhase' })}
        disabled={state.phase === 'game-over'}
        data-tutorial-id="end-phase"
        data-testid="end-phase"
      >
        {endPhaseLabel(state)}
      </button>
    </div>
  );
}
