import { ApiError } from '../../api/client';
import { useHealth } from '../../api/health';
import styles from './AppShell.module.css';

/** Calm by default: only shows up when the server or database has a problem. */
export function StatusPill() {
  const health = useHealth();
  if (health.isPending || (health.isSuccess && health.data.status === 'UP')) return null;
  const dbDown = health.isError && health.error instanceof ApiError && health.error.status === 503;
  const label = health.isSuccess || dbDown ? 'Database offline' : 'Server unreachable';
  return (
    <span className={`${styles.pill} ${styles.warn}`} role="status" aria-live="polite">
      {label}
    </span>
  );
}
