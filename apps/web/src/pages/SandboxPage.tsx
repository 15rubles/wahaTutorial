import { useEffect } from 'react';
import { useArmy } from '../army/store.js';
import { GameView } from '../components/GameView.js';
import { StratagemPanel } from '../components/StratagemPanel.js';
import { useData } from '../data/store.js';
import { armyUnits, sandboxGame } from '../game/buildGame.js';
import { useGame } from '../game/store.js';
import { href } from '../router.js';

export function SandboxPage() {
  const army = useArmy((s) => s.army);
  const hydrate = useArmy((s) => s.hydrate);
  const { datasheets, game: data } = useData();
  const { history, start, setGuard, setDice } = useGame();

  useEffect(() => {
    void hydrate();
    // The sandbox has no tutorial guard.
    setGuard(null);
    setDice(null);
  }, [hydrate, setGuard, setDice]);

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
  const isSandbox = history?.initial.players.p2.name === 'Opponent';
  useEffect(() => {
    if (ready && (!history || !isSandbox)) newGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, history, isSandbox]);

  if (!army)
    return (
      <section>
        <p>Import your army first.</p>
        <a href={href('import')}>Import a roster</a>
      </section>
    );
  const state = history?.current;
  if (!state || !isSandbox) return <p className="muted">Setting up the battlefield...</p>;
  return (
    <section className="sandbox">
      <GameView state={state} extra={<StratagemPanel state={state} />} />
      <button type="button" className="link" onClick={newGame}>
        Start a new sandbox game
      </button>
    </section>
  );
}
