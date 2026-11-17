import { type ReactNode, useEffect } from 'react';
import { useData } from '../data/store.js';

/** Loads data once and shows setup instructions when the local cache is missing. */
export function DataGate({ children }: { children: ReactNode }) {
  const { status, error, source, load, setSource } = useData();
  useEffect(() => {
    if (status === 'idle') void load();
  }, [status, load]);

  if (status === 'idle' || status === 'loading')
    return <p className="muted">Loading rules data...</p>;
  if (status === 'missing')
    return (
      <section className="panel" data-testid="data-missing">
        <h2>No local rules data yet</h2>
        <p>
          Battle Drill never ships rules text. Fetch it to your own machine once (rate limited,
          about 30 seconds), then build the local cache:
        </p>
        <pre>npm run data:sync{'\n'}npm run data:build</pre>
        <p>Then reload this page. Or try the app with invented demo data first:</p>
        <button type="button" onClick={() => setSource('fixture')}>
          Use demo data (invented factions)
        </button>
      </section>
    );
  if (status === 'error')
    return (
      <section className="panel">
        <h2>Could not load data</h2>
        <p>{error}</p>
        <button type="button" onClick={() => void load()}>
          Retry
        </button>
        {source === 'cache' && (
          <button type="button" onClick={() => setSource('fixture')}>
            Use demo data
          </button>
        )}
      </section>
    );
  return <>{children}</>;
}
