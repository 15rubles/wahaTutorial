import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { errorMessage } from '../../components/ui/States';
import { useDataUpdatePreview, useRosterMutations, type RosterView } from '../rosters/api';
import styles from './builder.module.css';

/** Shown when the list was built on an older data version (DESIGN.md 5.3). */
export function DataBanner({ roster }: { roster: RosterView }) {
  const [open, setOpen] = useState(false);
  const preview = useDataUpdatePreview(roster.id, roster.version.outdated);
  const m = useRosterMutations(roster.id);
  if (!roster.version.outdated) return null;
  const p = preview.data;
  const changed = (p?.changes.length ?? 0) + (p?.removedUnits.length ?? 0);
  return (
    <div className={styles.banner} role="status">
      <div className={styles.bannerRow}>
        <span>
          {changed > 0 ? 'Points changed since this list was built.' : 'This list was built on older game data.'}
          {p && p.totalBefore !== p.totalAfter && (
            <>
              {' '}
              Total <span className="num">{p.totalBefore}</span> → <span className="num">{p.totalAfter}</span>.
            </>
          )}
        </span>
        <div className={styles.bannerActions}>
          {changed > 0 && (
            <Button size="s" variant="ghost" onClick={() => setOpen(!open)}>
              {open ? 'Hide changes' : 'Show changes'}
            </Button>
          )}
          <Button size="s" variant="primary" onClick={() => m.applyDataUpdate.mutate()} disabled={m.applyDataUpdate.isPending}>
            Update to current data
          </Button>
        </div>
      </div>
      {open && p && (
        <ul className={styles.bannerList}>
          {p.changes.map((c) => (
            <li key={c.entryId}>
              {c.name}: <span className="num">{c.before}</span> → <span className="num">{c.after}</span>
            </li>
          ))}
          {p.removedUnits.map((n) => (
            <li key={n}>{n}: no longer in the data</li>
          ))}
        </ul>
      )}
      {m.applyDataUpdate.isError && <span>{errorMessage(m.applyDataUpdate.error)}</span>}
    </div>
  );
}
