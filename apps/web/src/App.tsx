import { createEmptyGameState } from '@battle-drill/engine';

export function App() {
  const state = createEmptyGameState();
  return (
    <main className="app">
      <h1>Battle Drill</h1>
      <p>An interactive core rules tutorial that uses your own army.</p>
      <p className="muted">Engine ready. Battle round {state.battleRound}.</p>
    </main>
  );
}
