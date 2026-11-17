import {
  type GameEvent,
  type GameState,
  aliveModels,
  eligibleMoveTypes,
} from '@battle-drill/engine';
import { type ReactNode, useMemo } from 'react';
import { useData } from '../data/store.js';
import { useGame } from '../game/store.js';
import { ActionPanel } from './ActionPanel.js';
import { Battlefield } from './Battlefield.js';
import { DiceTray } from './DiceTray.js';
import { PhaseBar } from './PhaseBar.js';
import { UnitCard } from './UnitCard.js';

export function describeEvent(e: GameEvent, state: GameState): string | null {
  const name = (id: string) => state.units[id]?.name ?? id;
  switch (e.type) {
    case 'TurnStarted':
      return `Round ${e.round}: ${e.player === 'p1' ? 'your' : 'opponent'} turn`;
    case 'UnitMoved':
      return e.moveType === 'stationary'
        ? `${name(e.unitId)} remained stationary`
        : `${name(e.unitId)} made a ${e.moveType} move (${e.moved.toFixed(1)}")`;
    case 'UnitShot':
      return `${name(e.unitId)} shot at ${e.targetIds.map(name).join(', ')}`;
    case 'ChargeDeclared':
      return `${name(e.unitId)} declared a charge (${e.distance}")`;
    case 'ChargeMoved':
      return `${name(e.unitId)} charged ${e.targetIds.map(name).join(', ')}`;
    case 'ChargeFailed':
      return `${name(e.unitId)} did not charge`;
    case 'UnitFought':
      return `${name(e.unitId)} fought ${e.targetIds.map(name).join(', ')}`;
    case 'UnitDestroyed':
      return `${name(e.unitId)} was destroyed`;
    case 'BattleShockRolled':
      return `${name(e.unitId)} battle-shock: ${e.passed ? 'passed' : 'failed'}`;
    case 'VictoryPointsScored':
      return `${e.player === 'p1' ? 'You' : 'Opponent'} scored ${e.amount} VP`;
    case 'ObjectiveControlled':
      return `Objective ${e.objectiveId}: ${e.player === 'p1' ? 'you control it' : e.player === 'p2' ? 'opponent controls it' : 'nobody controls it'}`;
    case 'GameEnded':
      return e.winner
        ? `Game over: ${e.winner === 'p1' ? 'you win' : 'opponent wins'}`
        : 'Game over: draw';
    default:
      return null;
  }
}

/** Phase bar, battlefield, controls, dice and unit card: shared by the sandbox and lessons. */
export function GameView({ state, extra }: { state: GameState; extra?: ReactNode }) {
  const { datasheets } = useData();
  const { selectedUnitId, select, lastEvents, dragMode } = useGame();
  const selected = selectedUnitId ? state.units[selectedUnitId] : undefined;
  const dragLimit = useMemo(() => {
    if (
      !selected ||
      selected.player !== 'p1' ||
      state.phase !== 'movement' ||
      state.activePlayer !== 'p1'
    )
      return null;
    const types = eligibleMoveTypes(state, selected.id);
    const m = Math.min(...aliveModels(selected).map((x) => x.movement ?? 0));
    if (dragMode === 'normal' && types.includes('normal')) return m;
    if (dragMode === 'fall-back' && types.includes('fall-back')) return m;
    const roll = state.status[selected.id]?.advanceRoll;
    if (dragMode === 'advance' && types.includes('advance') && roll !== null && roll !== undefined)
      return m + roll;
    return null;
  }, [state, selected, dragMode]);
  const rings = useMemo(() => {
    if (!selected || state.phase !== 'shooting') return [];
    return [
      ...new Set(
        selected.weapons.filter((w) => w.type === 'ranged' && w.range).map((w) => w.range!),
      ),
    ].map((r) => ({ radius: r, label: `${r}"` }));
  }, [state, selected]);
  const log = state.log.map((e) => describeEvent(e, state)).filter((x): x is string => !!x);

  return (
    <>
      <PhaseBar state={state} />
      <div className="sandbox-grid">
        <div className="board-wrap">
          <Battlefield
            state={state}
            dragLimit={dragLimit}
            rings={rings}
            onUnitClick={(id) => select(id)}
            onBackgroundClick={() => select(null)}
          />
          <p className="small muted legend">
            <span className="swatch p1" /> your units <span className="swatch p2" /> opponent.
            Hatched terrain blocks sight. Dashed rings: weapon ranges. Yellow circles: objectives.
          </p>
        </div>
        <aside className="side">
          <ActionPanel state={state} />
          {extra}
          <DiceTray events={lastEvents} />
          {selected && (
            <UnitCard
              unit={selected}
              datasheet={
                selected.player === 'p1' ? datasheets.get(selected.datasheetId) : undefined
              }
            />
          )}
        </aside>
      </div>
      <details className="panel">
        <summary>Battle log ({log.length})</summary>
        <ol className="small" data-testid="battle-log">
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </details>
    </>
  );
}
