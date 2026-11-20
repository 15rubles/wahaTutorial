import { ApiError } from '../../api/client';
import { useHealth } from '../../api/health';
import styles from './AppShell.module.css';

type PillState = { tone: 'ok' | 'warn' | 'idle'; label: string };

function usePillState(): PillState {
  const health = useHealth();
  if (health.isPending) return { tone: 'idle', label: 'Connecting' };
  if (health.isError) {
    // The backend answers 503 when it is running but cannot reach the database.
    const dbDown = health.error instanceof ApiError && health.error.status === 503;
    return { tone: 'warn', label: dbDown ? 'Database offline' : 'Server unreachable' };
  }
  if (health.data.status === 'UP') return { tone: 'ok', label: 'Server online' };
  return { tone: 'warn', label: 'Database offline' };
}

export function StatusPill() {
  const { tone, label } = usePillState();
  return (
    <span className={`${styles.pill} ${styles[tone]}`} role="status" aria-live="polite">
      {label}
    </span>
  );
}
