import { ErrorState, LoadingState } from '../../components/ui/States';
import { useRosterList } from './api';
import styles from './RosterListPage.module.css';

export function RosterListPage() {
  const rosters = useRosterList();
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>My lists</h1>
      </div>
      {rosters.isPending && <LoadingState label="Loading your lists" />}
      {rosters.isError && <ErrorState error={rosters.error} />}
      {rosters.data && rosters.data.length === 0 && (
        <div className={styles.empty}>
          <p>You have no army lists yet.</p>
        </div>
      )}
      {rosters.data && rosters.data.length > 0 && (
        <ul className={styles.list}>
          {rosters.data.map((r) => (
            <li key={r.id} className={styles.row}>
              <span className={styles.name}>{r.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
