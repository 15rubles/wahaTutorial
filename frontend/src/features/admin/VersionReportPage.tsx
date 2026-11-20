import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Issue, IssueLevel, VersionReport } from '../../api/gameTypes';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState, Notice, errorMessage } from '../../components/ui/States';
import { useActivateVersion, useDataVersions, useVersionReport } from './dataApi';
import styles from './Admin.module.css';

export function VersionReportPage() {
  const id = Number(useParams().id);
  const report = useVersionReport(id);
  const versions = useDataVersions();
  const activate = useActivateVersion();
  const status = versions.data?.find((v) => v.version.id === id)?.version.status;

  if (!Number.isFinite(id)) return <ErrorState error={new Error('Bad version id')} />;
  return (
    <div className={styles.section}>
      <p>
        <Link to="/admin/data">Back to data versions</Link>
      </p>
      <div className={styles.headRow}>
        <h2 className={styles.sectionTitle}>
          Import report for version <span className="num">#{id}</span>
          {status && <span className={`${styles.status} ${styles[`vs_${status}`]}`}>{status.toLowerCase()}</span>}
        </h2>
        {status === 'DRAFT' && (
          <Button variant="primary" onClick={() => activate.mutate(id)} disabled={activate.isPending}>
            Activate this version
          </Button>
        )}
      </div>
      {activate.isError && <Notice>{errorMessage(activate.error)}</Notice>}
      {report.isPending && <LoadingState />}
      {report.isError && <ErrorState error={report.error} />}
      {report.data && <ReportBody report={report.data} />}
    </div>
  );
}

const TYPES = ['datasheet', 'unit_size', 'weapon', 'ability', 'detachment', 'enhancement', 'stratagem', 'glossary'];

function ReportBody({ report }: { report: VersionReport }) {
  const factions = Object.keys(report.counts).sort();
  return (
    <>
      <div className={styles.stats}>
        <Stat label="Sources" value={Object.keys(report.sourceImports).join(', ') || '-'} />
        <Stat label="Phase tags to review" value={String(report.phaseTagsToReview)} />
        <Stat label="Overrides applied" value={String(report.overridesApplied)} />
        <Stat label="Errors" value={String(report.issues.filter((i) => i.level === 'ERROR').length)} />
        <Stat label="Warnings" value={String(report.issues.filter((i) => i.level === 'WARNING').length)} />
      </div>

      <h3 className={styles.subTitle}>Counts per faction</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Faction</th>
              {TYPES.map((t) => (
                <th key={t}>{t.replace('_', ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factions.map((f) => (
              <tr key={f}>
                <td>{f}</td>
                {TYPES.map((t) => (
                  <td key={t} className="num">
                    {report.counts[f]?.[t] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Diff report={report} />
      <Issues issues={report.issues} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} num`}>{value}</span>
    </div>
  );
}

function Diff({ report }: { report: VersionReport }) {
  const d = report.diff;
  if (d.comparedToVersion === undefined) {
    return <p className={styles.muted}>No active version to compare with.</p>;
  }
  return (
    <>
      <h3 className={styles.subTitle}>
        Changes since version <span className="num">#{d.comparedToVersion}</span>
      </h3>
      <div className={styles.stats}>
        <Stat label="New" value={String(d.added.length)} />
        <Stat label="Changed" value={String(d.changed.length)} />
        <Stat label="Removed" value={String(d.removed.length)} />
        <Stat label="Points changes" value={String(d.points.length)} />
      </div>
      {d.points.length > 0 && (
        <details className={styles.details} open>
          <summary>Points changes</summary>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Entry</th>
                  <th>Key</th>
                  <th>Old</th>
                  <th>New</th>
                </tr>
              </thead>
              <tbody>
                {d.points.map((p) => (
                  <tr key={p.key}>
                    <td>{p.name}</td>
                    <td className={styles.key}>{p.key}</td>
                    <td className="num">{p.before ?? '-'}</td>
                    <td className="num">{p.after ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {(['added', 'changed', 'removed'] as const).map((k) =>
        d[k].length > 0 ? (
          <details key={k} className={styles.details}>
            <summary>
              {k} ({d[k].length})
            </summary>
            <ul className={styles.plainList}>
              {d[k].map((c) => (
                <li key={`${c.type}${c.key}`}>
                  {c.name} <span className={styles.key}>{c.key}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null,
      )}
    </>
  );
}

function Issues({ issues }: { issues: Issue[] }) {
  const [level, setLevel] = useState<IssueLevel | 'ALL'>('ALL');
  const grouped = useMemo(() => {
    const map = new Map<string, Issue[]>();
    for (const i of issues) {
      if (level !== 'ALL' && i.level !== level) continue;
      const list = map.get(i.category) ?? [];
      list.push(i);
      map.set(i.category, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [issues, level]);

  return (
    <>
      <div className={styles.headRow}>
        <h3 className={styles.subTitle}>Issues ({issues.length})</h3>
        <label className={styles.inline}>
          Show
          <select className={styles.select} value={level} onChange={(e) => setLevel(e.target.value as IssueLevel | 'ALL')}>
            <option value="ALL">all</option>
            <option value="ERROR">errors</option>
            <option value="WARNING">warnings</option>
            <option value="INFO">info</option>
          </select>
        </label>
      </div>
      {grouped.length === 0 && <p className={styles.muted}>Nothing to show.</p>}
      {grouped.map(([category, list]) => (
        <details key={category} className={styles.details}>
          <summary>
            <span className={`${styles.status} ${styles[`lv_${list[0]?.level ?? 'INFO'}`]}`}>{list[0]?.level.toLowerCase()}</span>{' '}
            {category} ({list.length})
          </summary>
          <ul className={styles.plainList}>
            {list.slice(0, 500).map((i, n) => (
              <li key={n}>
                {i.message}
                {i.faction && <span className={styles.key}> [{i.faction}]</span>}
              </li>
            ))}
            {list.length > 500 && <li className={styles.muted}>... and {list.length - 500} more</li>}
          </ul>
        </details>
      ))}
    </>
  );
}
