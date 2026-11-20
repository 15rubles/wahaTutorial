import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState, Notice, errorMessage } from '../../components/ui/States';
import { formatDateTime } from '../../lib/format';
import { useActivateVersion, useDataVersions, useRebuildDraft } from './dataApi';
import { ImportCard } from './ImportCard';
import styles from './Admin.module.css';

export function DataPage() {
  const versions = useDataVersions();
  const activate = useActivateVersion();
  const rebuild = useRebuildDraft();

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Import game data</h2>
      <p className={styles.muted}>
        Every import builds a draft version from the newest file of each source. Review its report, then activate it.
      </p>
      <div className={styles.cards}>
        <ImportCard
          source="battlescribe"
          title="BattleScribe"
          accept=".zip"
          help="A .zip with one .gst and the .cat files (plain or zipped)."
        />
      </div>

      <div className={styles.headRow}>
        <h2 className={styles.sectionTitle}>Data versions</h2>
        <Button size="s" onClick={() => rebuild.mutate()} disabled={rebuild.isPending}>
          Rebuild draft from latest imports
        </Button>
      </div>
      {rebuild.isError && <Notice>{errorMessage(rebuild.error)}</Notice>}
      {activate.isError && <Notice>{errorMessage(activate.error)}</Notice>}
      {versions.isPending && <LoadingState />}
      {versions.isError && <ErrorState error={versions.error} />}
      {versions.data && versions.data.length === 0 && <p className={styles.muted}>No data imported yet.</p>}
      {versions.data && versions.data.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Version</th>
                <th>Status</th>
                <th>Created</th>
                <th>Files</th>
                <th>Entities</th>
                <th>Errors</th>
                <th>Warnings</th>
                <th>Phase tags to review</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {versions.data.map((v) => (
                <tr key={v.version.id}>
                  <td className="num">
                    <Link to={`/admin/data/versions/${v.version.id}`}>#{v.version.id}</Link>
                  </td>
                  <td>
                    <span className={`${styles.status} ${styles[`vs_${v.version.status}`]}`}>
                      {v.version.status.toLowerCase()}
                    </span>
                  </td>
                  <td>
                    {formatDateTime(v.version.createdAt)}
                    {v.version.createdBy && <span className={styles.muted}> by {v.version.createdBy}</span>}
                  </td>
                  <td className={styles.files}>{v.version.sourceFiles.join(', ')}</td>
                  <td className="num">{v.entities}</td>
                  <td className="num">{v.errors}</td>
                  <td className="num">{v.warnings}</td>
                  <td className="num">{v.phaseTagsToReview}</td>
                  <td>
                    {v.version.status === 'DRAFT' && (
                      <Button size="s" variant="primary" onClick={() => activate.mutate(v.version.id)} disabled={activate.isPending}>
                        Activate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
