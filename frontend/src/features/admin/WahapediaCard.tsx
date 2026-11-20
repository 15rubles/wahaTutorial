import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Notice, errorMessage } from '../../components/ui/States';
import { useFetchWahapedia } from './dataApi';
import { ImportCard } from './ImportCard';
import styles from './Admin.module.css';

export function WahapediaCard() {
  const fetchRun = useFetchWahapedia();
  const [refresh, setRefresh] = useState(false);
  const downloaded = fetchRun.data?.files.filter((f) => f.downloaded).length ?? 0;

  return (
    <>
      <section className={styles.card} aria-labelledby="waha-fetch-h">
        <h3 id="waha-fetch-h" className={styles.cardTitle}>
          Wahapedia (fetch)
        </h3>
        <p className={styles.muted}>
          Downloads the data export and the core rules page into the local cache, one request per second. Cached files are
          reused unless you ask for a refresh.
        </p>
        <label className={styles.inline}>
          <input type="checkbox" checked={refresh} onChange={(e) => setRefresh(e.target.checked)} /> Check Wahapedia for
          newer files
        </label>
        <div className={styles.toolbar}>
          <Button variant="primary" onClick={() => fetchRun.mutate(refresh)} disabled={fetchRun.isPending}>
            {fetchRun.isPending ? 'Fetching (this takes a while)' : 'Fetch and import'}
          </Button>
        </div>
        {fetchRun.isError && <Notice>{errorMessage(fetchRun.error)}</Notice>}
        {fetchRun.data && (
          <Notice tone="ok">
            <span>
              {downloaded} files downloaded, {fetchRun.data.files.length - downloaded} from the cache. Draft version{' '}
              <Link to={`/admin/data/versions/${fetchRun.data.imported.versionId}`}>
                #{fetchRun.data.imported.versionId}
              </Link>{' '}
              built.
            </span>
          </Notice>
        )}
      </section>
      <ImportCard
        source="wahapedia"
        title="Wahapedia (upload)"
        accept=".zip"
        help="A .zip with the Wahapedia CSV files, optionally with core-rules.html for weapon abilities, rule terms and battle sizes."
      />
    </>
  );
}
