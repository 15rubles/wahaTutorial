import { Outlet } from 'react-router-dom';
import { StatusPill } from './StatusPill';
import styles from './AppShell.module.css';

export function AppShell() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>Warhammer 40,000 - 11th Edition</span>
          <span className={styles.title}>Muster</span>
        </div>
        <StatusPill />
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
