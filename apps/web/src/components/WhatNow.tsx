import { type GameState, type LegalOption, legalActions } from '@battle-drill/engine';
import { useState } from 'react';

const MOVE: Record<string, string> = {
  stationary: 'remain stationary',
  normal: 'make a normal move',
  advance: 'advance (roll a D6 for extra distance)',
  'fall-back': 'fall back out of combat',
  ingress: 'arrive from reserves',
};
const SHOOT: Record<string, string> = {
  normal: 'shoot normally',
  assault: 'shoot its assault weapons',
  'close-quarters': 'shoot close-quarters weapons at enemies it is fighting',
};

export function describeOption(o: LegalOption, state: GameState): string {
  switch (o.kind) {
    case 'move':
      return `It can ${o.moveTypes.map((t) => MOVE[t] ?? t).join(', or ')}.`;
    case 'shoot':
      return `It can ${o.shootingTypes.map((t) => SHOOT[t] ?? t).join(', or ')}.`;
    case 'in-reserves':
      return o.canArrive
        ? 'It is in reserves: it can arrive now with an ingress move. Click the board to set it up.'
        : 'It is in reserves, waiting off the battlefield. Reserves can arrive from battle round 2.';
    case 'declare-charge':
      return 'It can declare a charge: an enemy is within 12".';
    case 'charge-move':
      return o.targets.length > 0
        ? `It can finish its charge into ${o.targets.map((id) => state.units[id]?.name ?? id).join(' or ')}.`
        : 'The charge roll was too short: continue without charging.';
    case 'pile-in':
      return 'It can pile in up to 3" towards the enemy.';
    case 'fight':
      return 'It can fight now.';
    case 'consolidate':
      return 'It can consolidate up to 3".';
    case 'none':
      return o.reason === 'destroyed'
        ? 'This unit is destroyed.'
        : o.reason === 'not-your-turn'
          ? 'It is not this unit’s turn.'
          : o.reason === 'already-acted'
            ? 'This unit has already acted this phase.'
            : 'Nothing for this unit in this phase. End the phase when you are ready.';
  }
}

/** "What can I do now?" helper: lists the selected unit's legal options in plain words. */
export function WhatNow({ state, unitId }: { state: GameState; unitId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="what-now">
      <button
        type="button"
        className="link small"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        data-testid="what-now"
      >
        What can I do now?
      </button>
      {open && (
        <ul className="small" data-testid="what-now-list">
          {legalActions(state, unitId).map((o, i) => (
            <li key={i}>{describeOption(o, state)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
