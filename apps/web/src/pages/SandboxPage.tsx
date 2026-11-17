import {
  type GameEvent,
  type GameState,
  aliveModels,
  eligibleMoveTypes,
} from '@battle-drill/engine';
import { useEffect, useMemo } from 'react';
import { useArmy } from '../army/store.js';
import { ActionPanel } from '../components/ActionPanel.js';
import { Battlefield } from '../components/Battlefield.js';
import { DiceTray } from '../components/DiceTray.js';
import { PhaseBar } from '../components/PhaseBar.js';
import { UnitCard } from '../components/UnitCard.js';
import { useData } from '../data/store.js';
import { armyUnits, sandboxGame } from '../game/buildGame.js';
import { useGame } from '../game/store.js';
import { href } from '../router.js';

function describe(e: GameEvent, state: GameState): string | null {
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
    case 'GameEnded':
      return e.winner
        ? `Game over: ${e.winner === 'p1' ? 'you win' : 'opponent wins'}`
        : 'Game over: draw';
    default:
      return null;
  }
}

export function SandboxPage() {
  const army = useArmy((s) => s.army);
  const hydrate = useArmy((s) => s.hydrate);
  const { datasheets, game: data } = useData();
  const { history, start, selectedUnitId, select, lastEvents, dragMode } = useGame();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const ready = !!army && army.units.every((u) => datasheets.has(u.datasheetId));
  const newGame = () => {
    if (!army) return;
    const units = armyUnits(
      army,
      (id) => datasheets.get(id),
      (id) => data?.abilities.find((a) => a.id === id)?.name,
    );
    const seedParam = Number(new URLSearchParams(window.location.search).get('seed'));
    start(
      sandboxGame(
        units,
        Number.isFinite(seedParam) && seedParam > 0 ? seedParam : Math.floor(Math.random() * 1e9),
      ),
    );
  };
  useEffect(() => {
    if (ready && !history) newGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, history]);

  const state = history?.current;
  const selected = state && selectedUnitId ? state.units[selectedUnitId] : undefined;
  const dragLimit = useMemo(() => {
    if (
      !state ||
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
    if (!state || !selected || state.phase !== 'shooting') return [];
    return [
      ...new Set(
        selected.weapons.filter((w) => w.type === 'ranged' && w.range).map((w) => w.range!),
      ),
    ].map((r) => ({ radius: r, label: `${r}"` }));
  }, [state, selected]);

  if (!army)
    return (
      <section>
        <p>Import your army first.</p>
        <a href={href('import')}>Import a roster</a>
      </section>
    );
  if (!state) return <p className="muted">Setting up the battlefield...</p>;

  const log = state.log.map((e) => describe(e, state)).filter((x): x is string => !!x);
  return (
    <section className="sandbox">
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
            Hatched terrain blocks sight. Dashed rings: weapon ranges. Circles on the board:
            objectives.
          </p>
        </div>
        <aside className="side">
          <ActionPanel state={state} />
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
      <button type="button" className="link" onClick={newGame}>
        Start a new sandbox game
      </button>
    </section>
  );
}
