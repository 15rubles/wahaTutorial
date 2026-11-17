import { unitFromDatasheet } from '@battle-drill/engine';
import { useEffect } from 'react';
import { UnitCard } from '../components/UnitCard.js';
import { useData } from '../data/store.js';

export function UnitPage({ datasheetId }: { datasheetId: string }) {
  const { datasheets, game, ensureFactions } = useData();
  const entry = game?.catalog.find((c) => c.id === datasheetId);
  useEffect(() => {
    if (entry) void ensureFactions([entry.factionId]);
  }, [entry, ensureFactions]);
  const ds = datasheets.get(datasheetId);
  if (!ds) return <p className="muted">Loading datasheet...</p>;
  const unit =
    ds.models.length > 0 ? unitFromDatasheet(ds, { id: 'preview', player: 'p1' }) : undefined;
  return (
    <section>
      <UnitCard datasheet={ds} unit={unit} />
      <p className="small">
        <a href={ds.sourceUrl} target="_blank" rel="noreferrer">
          Source page
        </a>
      </p>
    </section>
  );
}
