import { useState } from 'react';
import { DataGate } from './components/DataGate.js';
import { QuickReference } from './components/QuickReference.js';
import { cacheAgeDays, isStale } from './data/freshness.js';
import { RulePopup } from './components/RulePopup.js';
import { useData } from './data/store.js';
import { ArmyPage } from './pages/ArmyPage.js';
import { ImportPage } from './pages/ImportPage.js';
import { LessonList, LessonPage } from './pages/LearnPage.js';
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
          <a href={href('learn')}>Start the tutorial</a>
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

function FreshnessBanner() {
  const meta = useData((s) => s.meta);
  // Read the clock once per mount, not on every render.
  const [now] = useState(() => Date.now());
  const age = cacheAgeDays(meta, now);
  if (!isStale(age)) return null;
  return (
    <p className="banner" role="status" data-testid="freshness-banner">
      Your rules cache is {age} days old. Run <code>npm run data:sync</code> and{' '}
      <code>npm run data:build</code> to update it.
    </p>
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
          <a href={href('learn')}>Learn</a>
          <a href={href('army')}>Army</a>
          <a href={href('sandbox')}>Sandbox</a>
          <a href={href('rules')}>Rules</a>
        </nav>
        <QuickReference />
        <DataSourceBadge />
      </header>
      <FreshnessBanner />
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
        ) : page === 'learn' ? (
          <DataGate>
            {rest[0] ? <LessonPage key={rest[0]} lessonId={rest[0]} /> : <LessonList />}
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
