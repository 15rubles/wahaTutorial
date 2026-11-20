import { useMemo, useState } from 'react';
import type { DatasheetSummary } from '../../api/gameTypes';
import { MissingData } from '../../components/ui/States';
import { groupByRole } from '../../lib/roles';
import type { RosterView } from '../rosters/api';
import { useBuilderUi } from './store';
import styles from './builder.module.css';

/** Search, role filters, units grouped by role with points and a "+" button (DESIGN.md 7.2). */
export function AddUnitsPane({
  roster,
  datasheets,
  onAdd,
  adding,
}: {
  roster: RosterView;
  datasheets: DatasheetSummary[];
  onAdd: (key: string) => void;
  adding: boolean;
}) {
  const [q, setQ] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const select = useBuilderUi((s) => s.select);
  const selection = useBuilderUi((s) => s.selection);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return datasheets.filter((d) => (roster.flags.legends || !d.legends) && (!needle || d.name.toLowerCase().includes(needle)));
  }, [datasheets, q, roster.flags.legends]);
  const groups = groupByRole(visible, (d) => d.role);
  const shown = role ? groups.filter((g) => g.group.id === role) : groups;

  return (
    <div className={styles.addPane}>
      <label className={styles.searchLabel}>
        <span className="sr-only">Search datasheets</span>
        <input type="search" className={styles.search} placeholder="Search datasheets" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className={styles.filters} role="group" aria-label="Filter by role">
        <button type="button" className={`${styles.filter} ${role === null ? styles.filterOn : ''}`} onClick={() => setRole(null)} aria-pressed={role === null}>
          All
        </button>
        {groups.map((g) => (
          <button
            key={g.group.id}
            type="button"
            className={`${styles.filter} ${role === g.group.id ? styles.filterOn : ''}`}
            onClick={() => setRole(role === g.group.id ? null : g.group.id)}
            aria-pressed={role === g.group.id}
          >
            {g.group.label}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className={styles.muted}>No units match.</p>}
      {shown.map((g) => (
        <div key={g.group.id} className={styles.addGroup}>
          <h3 className={`${styles.addGroupHead} ${styles[`tone_${g.group.tone}`] ?? ''}`}>{g.group.label.toUpperCase()}</h3>
          <ul className={styles.addList}>
            {g.items.map((d) => {
              const pts = d.sizes[0]?.points;
              const on = selection?.kind === 'datasheet' && selection.key === d.key;
              return (
                <li key={d.key} className={`${styles.addRow} ${on ? styles.addRowOn : ''}`}>
                  <button type="button" className={styles.addName} onClick={() => select({ kind: 'datasheet', key: d.key })}>
                    {d.name}
                    {d.legends && <span className={styles.legendsTag}>Legends</span>}
                  </button>
                  <span className={`${styles.addPts} num`}>{pts !== undefined ? pts : <MissingData what="pts" />}</span>
                  <button type="button" className={styles.plus} aria-label={`Add ${d.name}`} onClick={() => onAdd(d.key)} disabled={adding}>
                    +
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
