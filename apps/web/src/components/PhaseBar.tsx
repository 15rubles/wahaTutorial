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

const STEPS = ['command', 'movement', 'shooting', 'charge', 'fight'] as const;

export function PhaseBar({ state }: { state: GameState }) {
  const { act, undo, history } = useGame();
  const yourTurn = state.activePlayer === 'p1';
  const current = STEPS.indexOf(state.phase as (typeof STEPS)[number]);
  return (
    <div className="phase-bar" data-testid="phase-bar" data-tutorial-id="phase-bar">
      <div className="pb-counters">
        <b className="pb-round" data-testid="round">
          Round {state.battleRound}
        </b>
        <span className={`pb-turn ${yourTurn ? 'turn-you' : 'turn-them'}`}>
          {yourTurn ? 'Your turn' : 'Opponent\u2019s turn'}
        </span>
      </div>
      <ol className="pb-steps" aria-label="Phases">
        {STEPS.map((p, i) => (
          <li
            key={p}
            className={i < current ? 'done' : i === current ? 'on' : ''}
            aria-current={i === current ? 'step' : undefined}
          >
            {i < current ? '\u2713 ' : ''}
            {p}
          </li>
        ))}
      </ol>
      <strong className="pb-phase" data-testid="phase">
        {PHASE_LABEL[state.phase]}
        {state.fightStep && ` - ${STEP_LABEL[state.fightStep]}`}
      </strong>
      <div className="pb-counters">
        <span className="pb-count" title="Command points">
          <small>CP</small>
          <b>{state.players.p1.cp}</b>
        </span>
        <span className="pb-count" title="Victory points">
          <small>VP</small>
          <b>
            {state.players.p1.vp} : {state.players.p2.vp}
          </b>
        </span>
      </div>
      <button
        type="button"
        className="pb-undo"
        onClick={undo}
        disabled={!history?.actions.length}
        data-tutorial-id="undo"
      >
        Undo
      </button>
      <button
        type="button"
        className="pb-end"
        onClick={() => act({ type: 'endPhase' })}
        disabled={state.phase === 'game-over'}
        data-tutorial-id="end-phase"
        data-testid="end-phase"
      >
        {endPhaseLabel(state)} &#9656;
      </button>
    </div>
  );
}
