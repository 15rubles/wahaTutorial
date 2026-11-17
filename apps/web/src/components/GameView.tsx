import {
  ARRIVAL_ENEMY_DISTANCE,
  type GameEvent,
  type GameState,
  INGRESS_EDGE_DISTANCE,
  aliveModels,
  eligibleMoveTypes,
  formation,
  hasDeepStrike,
} from '@battle-drill/engine';
import { type ReactNode, useMemo } from 'react';
import { PIECE_LABEL, PieceArt, pieceType } from '../art/pieces.js';
import { useData } from '../data/store.js';
import { useGame } from '../game/store.js';
import { ActionPanel } from './ActionPanel.js';
import { Battlefield } from './Battlefield.js';
import { DiceTray } from './DiceTray.js';
import { PhaseBar } from './PhaseBar.js';
import { UnitCard } from './UnitCard.js';
import { componentUnits } from '../game/components.js';

export function describeEvent(e: GameEvent, state: GameState): string | null {
  const name = (id: string) => state.units[id]?.name ?? id;
  switch (e.type) {
    case 'TurnStarted':
      return `Round ${e.round}: ${e.player === 'p1' ? 'your' : 'opponent'} turn`;
    case 'UnitPlacedInReserves':
      return `${name(e.unitId)} was placed in strategic reserves`;
    case 'UnitArrived':
      return `${name(e.unitId)} arrived from reserves${e.deepStrike ? ' by Deep Strike' : ''}`;
    case 'UnitMoved':
      if (e.moveType === 'ingress') return null;
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

/** The piece types on the board, with what they stand for. */
function PieceLegend({ state }: { state: GameState }) {
  const seen = new Map<
    string,
    { type: ReturnType<typeof pieceType>; side: 'p1' | 'p2'; names: string[] }
  >();
  for (const u of Object.values(state.units)) {
    if (!aliveModels(u).some((m) => m.position)) continue;
    for (const part of componentUnits(u)) {
      const type = pieceType(part.keywords, part.datasheetId);
      const key = `${u.player}-${type}`;
      const entry = seen.get(key) ?? { type, side: u.player, names: [] };
      entry.names.push(part.name);
      seen.set(key, entry);
    }
  }
  return (
    <div className="piece-legend" data-tutorial-id="piece-legend">
      {[...seen.values()].map((e) => (
        <span
          key={`${e.side}-${e.type}`}
          className={`legend-item side-${e.side}`}
          title={e.names.join(', ')}
        >
          <span className={`legend-token side-${e.side}`}>
            <PieceArt type={e.type} side={e.side} size={30} />
          </span>
          {PIECE_LABEL[e.type]}
        </span>
      ))}
      <span className="legend-note">
        Red rim: yours. Green rim: enemy. Hatched terrain blocks sight; yellow coins are objectives.
      </span>
    </div>
  );
}

/** Phase bar, battlefield, controls, dice and unit card: shared by the sandbox and lessons. */
export function GameView({ state, extra }: { state: GameState; extra?: ReactNode }) {
  const { datasheets } = useData();
  const { selectedUnitId, select, lastEvents, dragMode, pending, act } = useGame();
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
  const arrival =
    selected &&
    selected.player === 'p1' &&
    state.phase === 'movement' &&
    state.activePlayer === 'p1' &&
    eligibleMoveTypes(state, selected.id).includes('ingress')
      ? {
          deepStrike: hasDeepStrike(selected),
          edge: INGRESS_EDGE_DISTANCE,
          enemyGap: ARRIVAL_ENEMY_DISTANCE,
        }
      : null;
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
            arrival={arrival}
            onBackgroundClick={(at) => {
              if (at && arrival && selected)
                act({
                  type: 'move',
                  unitId: selected.id,
                  moveType: 'ingress',
                  positions: formation(selected, at),
                });
              else select(null);
            }}
            onConfirm={() =>
              pending &&
              act({
                type: 'move',
                unitId: pending.unitId,
                moveType: dragMode,
                positions: pending.positions,
              })
            }
          />
          <PieceLegend state={state} />
        </div>
        <aside className="side">
          <ActionPanel state={state} />
          {extra}
          <DiceTray events={lastEvents} />
          {selected && (
            <div className="attached-cards">
              {componentUnits(selected).map((part) => (
                <UnitCard
                  key={part.datasheetId + part.name}
                  unit={part}
                  datasheet={part.player === 'p1' ? datasheets.get(part.datasheetId) : undefined}
                />
              ))}
            </div>
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
