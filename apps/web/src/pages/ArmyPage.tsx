import type { CatalogEntry } from '@battle-drill/data';
import { type UnresolvedUnit, normalizeName } from '@battle-drill/roster';
import { useEffect, useMemo, useState } from 'react';
import { useArmy } from '../army/store.js';
import { useData } from '../data/store.js';
import { href } from '../router.js';

function FixMe({ entry }: { entry: UnresolvedUnit }) {
  const { assign, drop } = useArmy();
  const catalog = useData((s) => s.game?.catalog ?? []);
  const factionId = useArmy((s) => s.army?.factionId);
  const [query, setQuery] = useState('');
  const [allFactions, setAllFactions] = useState(false);
  const matches = useMemo(() => {
    const q = normalizeName(query);
    if (!q) return [] as CatalogEntry[];
    return catalog
      .filter(
        (c) =>
          (allFactions || !factionId || c.factionId === factionId) &&
          normalizeName(c.name).includes(q),
      )
      .slice(0, 12);
  }, [catalog, query, allFactions, factionId]);

  return (
    <li className="fixme" data-testid="fixme-entry">
      <div>
        <strong>{entry.draft.name}</strong>
        {entry.draft.points !== undefined && (
          <span className="muted"> ({entry.draft.points} pts)</span>
        )}
        <span className="muted small"> - not found in the data</span>
      </div>
      {entry.suggestions.length > 0 && (
        <div className="button-row">
          <span className="small">Did you mean:</span>
          {entry.suggestions.slice(0, 3).map((s) => (
            <button
              key={s.datasheetId}
              type="button"
              onClick={() => void assign(entry.key, s.datasheetId)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="button-row">
        <input
          type="search"
          aria-label={`Find a datasheet for ${entry.draft.name}`}
          placeholder="Search datasheets"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="small">
          <input
            type="checkbox"
            checked={allFactions}
            onChange={(e) => setAllFactions(e.target.checked)}
          />{' '}
          all factions
        </label>
        <button type="button" className="link" onClick={() => drop(entry.key)}>
          Remove from army
        </button>
      </div>
      {matches.length > 0 && (
        <ul className="picker">
          {matches.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => void assign(entry.key, c.id)}>
                {c.name} <span className="muted small">{c.factionId}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function ArmyPage() {
  const { army, setDetachment, clear, hydrate } = useArmy();
  const { game, datasheets } = useData();
  useEffect(() => {
    void hydrate();
  }, [hydrate, army?.units.length]);

  if (!army)
    return (
      <section>
        <p>No army yet.</p>
        <a href={href('import')}>Import a roster</a>
      </section>
    );

  const faction = game?.factions.find((f) => f.id === army.factionId);
  const detachments = game?.detachments.filter((d) => d.factionId === army.factionId) ?? [];
  const enhancementName = (id: string) => game?.enhancements.find((e) => e.id === id)?.name ?? id;

  return (
    <section className="army-page">
      <div className="army-head">
        <div>
          <h2 data-testid="army-name">{army.name}</h2>
          <p className="muted">
            {faction?.name ?? 'Unknown faction'} - {army.units.length} units
            {army.points !== null && ` - ${army.points} points`}
          </p>
        </div>
        <div className="button-row">
          <a href={href('import')}>Import another</a>
          <button type="button" className="link" onClick={clear}>
            Clear army
          </button>
        </div>
      </div>

      <label>
        Detachment{' '}
        <select
          value={army.detachmentId ?? ''}
          onChange={(e) => setDetachment(e.target.value || null)}
          data-testid="detachment-select"
        >
          <option value="">(none)</option>
          {detachments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      {army.unresolved.length > 0 && (
        <div className="panel fixme-panel" data-testid="fixme">
          <h3>Fix me: {army.unresolved.length} unit(s) need a datasheet</h3>
          <ul>
            {army.unresolved.map((u) => (
              <FixMe key={u.key} entry={u} />
            ))}
          </ul>
        </div>
      )}

      <table className="unit-table" data-testid="army-units">
        <thead>
          <tr>
            <th>Unit</th>
            <th>Models</th>
            <th>Weapons</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {army.units.map((u) => {
            const ds = datasheets.get(u.datasheetId);
            return (
              <tr key={u.key}>
                <td>
                  <a href={href('unit', u.datasheetId)}>{u.datasheetName}</a>
                  {u.isWarlord && <span className="tag">Warlord</span>}
                  {u.enhancementIds.map((id) => (
                    <span key={id} className="tag">
                      {enhancementName(id)}
                    </span>
                  ))}
                  {u.rosterName !== u.datasheetName && (
                    <div className="muted small">roster: {u.rosterName}</div>
                  )}
                  {u.match.method === 'fuzzy' && (
                    <div className="small warn">matched by similarity</div>
                  )}
                  {!ds && <div className="small muted">loading datasheet...</div>}
                </td>
                <td>{u.modelCount}</td>
                <td className="small">
                  {u.weapons.map((w) => `${w.count}x ${w.name}`).join(', ')}
                  {u.wargearDefaulted && (
                    <div className="muted">(no wargear in roster: all datasheet weapons shown)</div>
                  )}
                </td>
                <td>{u.points ?? '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {army.warnings.length > 0 && (
        <details className="panel">
          <summary>{army.warnings.length} import note(s)</summary>
          <ul className="small">
            {army.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
