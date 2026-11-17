import { DataGate } from './components/DataGate.js';
import { RulePopup } from './components/RulePopup.js';
import { useData } from './data/store.js';
import { ArmyPage } from './pages/ArmyPage.js';
import { ImportPage } from './pages/ImportPage.js';
import { RulesPage } from './pages/RulesPage.js';
import { SandboxPage } from './pages/SandboxPage.js';
import { UnitPage } from './pages/UnitPage.js';
import { href, useRoute } from './router.js';

function Home() {
  return (
    <section>
      <p>An interactive core rules tutorial that uses your own army.</p>
      <ul>
        <li>
          <a href={href('import')}>Import your army</a>
        </li>
        <li>
          <a href={href('sandbox')}>Sandbox: play a turn against practice dummies</a>
        </li>
        <li>
          <a href={href('rules')}>Rules browser</a>
        </li>
      </ul>
    </section>
  );
}

function DataSourceBadge() {
  const { source, setSource, meta } = useData();
  return (
    <div className="data-badge small">
      {source === 'fixture' ? 'Demo data (invented)' : 'Your local cache'}
      {meta?.sourceLastUpdate && (
        <span className="muted"> - source {meta.sourceLastUpdate}</span>
      )}{' '}
      <button
        type="button"
        className="link"
        onClick={() => setSource(source === 'fixture' ? 'cache' : 'fixture')}
      >
        switch
      </button>
    </div>
  );
}

export function App() {
  const [page, ...rest] = useRoute();
  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <a href={href()}>Battle Drill</a>
        </h1>
        <nav aria-label="Main">
          <a href={href('army')}>Army</a>
          <a href={href('sandbox')}>Sandbox</a>
          <a href={href('rules')}>Rules</a>
        </nav>
        <DataSourceBadge />
      </header>
      <main>
        {page === 'rules' ? (
          <DataGate>
            <RulesPage {...(rest[0] ? { selectedId: rest[0] } : {})} />
          </DataGate>
        ) : page === 'import' ? (
          <DataGate>
            <ImportPage />
          </DataGate>
        ) : page === 'army' ? (
          <DataGate>
            <ArmyPage />
          </DataGate>
        ) : page === 'sandbox' ? (
          <DataGate>
            <SandboxPage />
          </DataGate>
        ) : page === 'unit' && rest[0] ? (
          <DataGate>
            <UnitPage datasheetId={rest[0]} />
          </DataGate>
        ) : (
          <Home />
        )}
      </main>
      <RulePopup />
    </div>
  );
}
