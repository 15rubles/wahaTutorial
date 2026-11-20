import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import type { RosterView } from '../rosters/api';
import styles from './builder.module.css';

/** List name, faction, Points [total] / [limit], DP [used] / [budget], legal pill, Export PDF. No progress bars. */
export function BuilderHeader({
  roster,
  battleSizeName,
  onRename,
  onExport,
}: {
  roster: RosterView;
  battleSizeName: string | undefined;
  onRename: (name: string) => void;
  onExport: () => void;
}) {
  const t = roster.totals;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(roster.name);
  const over = t.pointsLimit !== undefined && t.points > t.pointsLimit;
  const dpOver = t.dpBudget !== undefined && t.dp > t.dpBudget;
  return (
    <header className={styles.header}>
      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>
          {roster.factionName}
          {battleSizeName ? ` · ${battleSizeName}` : ''}
        </span>
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onRename(name.trim());
              setEditing(false);
            }}
          >
            <input
              className={styles.nameInput}
              value={name}
              aria-label="List name"
              maxLength={100}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() && name.trim() !== roster.name) onRename(name.trim());
                setEditing(false);
              }}
            />
          </form>
        ) : (
          <button type="button" className={styles.listName} onClick={() => { setName(roster.name); setEditing(true); }} title="Rename">
            {roster.name}
          </button>
        )}
      </div>
      <div className={styles.metric}>
        <span className={`${styles.eyebrow} ${styles.metricLabel}`}>Points</span>
        <span className={`${styles.metricValue} num ${over ? styles.metricOver : ''}`} data-testid="points-total">
          {t.points}
          {!t.pointsComplete && <span title="Some units have no points in the data">*</span>}{' '}
          <span className={styles.metricLimit}>/ {t.pointsLimit ?? '-'}</span>
          <span className={styles.metricUnit}> pts</span>
        </span>
      </div>
      <div className={styles.metric}>
        <span className={`${styles.eyebrow} ${styles.metricLabel}`}>Detachment pts</span>
        <span className={`${styles.metricValue} num ${dpOver ? styles.metricOver : ''}`} data-testid="dp-total">
          {t.dp} <span className={styles.metricLimit}>/ {t.dpBudget ?? '-'}</span>
          <span className={styles.metricUnit}> DP</span>
        </span>
      </div>
      <span className={`${styles.statusPill} ${t.legal ? styles.pillOk : styles.pillBad}`} role="status" data-testid="legal-status">
        {t.legal ? 'Legal' : `${t.errors} ${t.errors === 1 ? 'error' : 'errors'}`}
        {t.warnings > 0 && <span className={styles.pillExtra}>{` · ${t.warnings} ${t.warnings === 1 ? 'warning' : 'warnings'}`}</span>}
      </span>
      <Button variant="primary" onClick={onExport} aria-label="Export PDF">
        <span className={styles.exportLong}>Export PDF</span>
        <span className={styles.exportShort} aria-hidden="true">
          PDF
        </span>
      </Button>
    </header>
  );
}
