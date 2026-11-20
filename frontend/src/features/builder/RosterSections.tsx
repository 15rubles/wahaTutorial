import type { DatasheetSummary } from '../../api/gameTypes';
import { groupByRole } from '../../lib/roles';
import type { EntryView, RosterView, Violation } from '../rosters/api';
import { useBuilderUi } from './store';
import styles from './builder.module.css';

/** Roster sections by role: header (role, count, subtotal) and one row per unit (DESIGN.md 7.2). */
export function RosterSections({ roster, datasheets }: { roster: RosterView; datasheets: DatasheetSummary[] }) {
  const select = useBuilderUi((s) => s.select);
  const selection = useBuilderUi((s) => s.selection);
  const byId = new Map(roster.entries.map((e) => [e.id, e]));
  const groups = groupByRole(roster.entries, (e) => e.role);
  const general = roster.violations.filter((v) => v.entryIds.length === 0 && v.severity !== 'INFO');
  const battlelineMissing = roster.violations.find((v) => v.code === 'BATTLELINE_MINIMUM');
  const errorsFor = (id: number) => roster.violations.filter((v) => v.entryIds.includes(id) && v.severity === 'ERROR');

  return (
    <div className={styles.sections}>
      {general.length > 0 && <ViolationList violations={general} />}
      {roster.entries.length === 0 && (
        <div className={styles.emptyList}>
          <p>No units yet. Add units from the left pane.</p>
        </div>
      )}
      {battlelineMissing && !groups.some((g) => g.group.id === 'battleline') && (
        <section className={styles.section}>
          <div className={`${styles.sectionHead} ${styles.tone_sage}`}>
            <h3 className={styles.sectionTitle}>BATTLELINE · 0</h3>
          </div>
          <div className={styles.sectionWarn}>{battlelineMissing.message}</div>
        </section>
      )}
      {groups.map((g) => {
        const subtotal = g.items.reduce((s, e) => s + e.points, 0);
        return (
          <section key={g.group.id} className={styles.section} aria-label={`${g.group.label}, ${g.items.length} units`}>
            <div className={`${styles.sectionHead} ${styles[`tone_${g.group.tone}`] ?? ''}`}>
              <h3 className={styles.sectionTitle}>
                {g.group.label.toUpperCase()} · {g.items.length}
              </h3>
              <span className={`${styles.sectionPts} num`}>{subtotal}</span>
            </div>
            {g.items.map((e) => {
              const on = selection?.kind === 'entry' && selection.id === e.id;
              const errors = errorsFor(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  className={`${styles.entry} ${on ? styles.entryOn : ''}`}
                  onClick={() => select({ kind: 'entry', id: e.id })}
                  aria-current={on ? 'true' : undefined}
                  data-testid={`entry-${e.datasheetKey}`}
                >
                  <span className={styles.entryMain}>
                    <span className={styles.entryName}>
                      {e.name}
                      {e.warlord && <span className={styles.warlordTag}>WARLORD</span>}
                      {errors.length > 0 && (
                        <span className={styles.errorDot} title={errors.map((v) => v.message).join('\n')} aria-label={`${errors.length} problems`} />
                      )}
                    </span>
                    <span className={styles.entrySub}>{subLine(e, byId, datasheets)}</span>
                  </span>
                  <span className={`${styles.entryPts} num`}>{e.pointsComplete ? e.points : `${e.points}*`}</span>
                </button>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function subLine(e: EntryView, byId: Map<number, EntryView>, sheets: DatasheetSummary[]): string {
  const parts: string[] = [];
  if (e.missing) parts.push('Not in the current data');
  const sizes = sheets.find((s) => s.key === e.datasheetKey)?.sizes.length ?? 0;
  if (e.sizeName && (sizes > 1 || e.models > 1)) parts.push(e.sizeName);
  if (e.wargear.length > 0) parts.push(e.wargear.map((w) => `${w.count}x ${w.choice}`).join(', '));
  if (e.enhancementName) parts.push(`Enhancement: ${e.enhancementName}`);
  if (e.attachedTo !== undefined) parts.push(`Leading: ${byId.get(e.attachedTo)?.name ?? 'unit'}`);
  return parts.join(' · ') || 'Default wargear';
}

export function ViolationList({ violations }: { violations: Violation[] }) {
  if (violations.length === 0) return null;
  return (
    <ul className={styles.violations} aria-label="Problems with this list">
      {violations.map((v, i) => (
        <li key={i} className={`${styles.violation} ${v.severity === 'ERROR' ? styles.vError : v.severity === 'WARNING' ? styles.vWarn : styles.vInfo}`}>
          <span className={styles.vMark} aria-hidden="true">
            {v.severity === 'ERROR' ? '!' : 'i'}
          </span>
          <span>{v.message}</span>
        </li>
      ))}
    </ul>
  );
}
