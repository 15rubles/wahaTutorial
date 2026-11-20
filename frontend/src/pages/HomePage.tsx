import styles from './HomePage.module.css';

/**
 * M0 placeholder: the three panes of the builder with empty states.
 * Real content (resizable panes, roster list) arrives in M5.
 */
export function HomePage() {
  return (
    <div className={styles.panes}>
      <section className={`${styles.pane} ${styles.side}`} aria-labelledby="pane-add">
        <h2 id="pane-add" className={styles.paneTitle}>
          Add units
        </h2>
        <p className={styles.empty}>No game data loaded yet.</p>
      </section>
      <section className={`${styles.pane} ${styles.center}`} aria-labelledby="pane-list">
        <div className={styles.card}>
          <h2 id="pane-list" className={styles.cardTitle}>
            Your lists
          </h2>
          <p className={styles.empty}>No army lists yet. Sign-in and list building come in later milestones.</p>
        </div>
      </section>
      <section className={`${styles.pane} ${styles.side} ${styles.right}`} aria-labelledby="pane-details">
        <h2 id="pane-details" className={styles.paneTitle}>
          Details
        </h2>
        <p className={styles.empty}>Select a unit to see its datasheet.</p>
      </section>
    </div>
  );
}
