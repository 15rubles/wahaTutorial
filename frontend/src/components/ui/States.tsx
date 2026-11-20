import { ApiError } from '../../api/client';
import styles from './ui.module.css';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className={styles.state} role="status" aria-live="polite">
      {label}...
    </div>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div className={styles.state} role="alert">
      <span className={styles.errorText}>{errorMessage(error)}</span>
    </div>
  );
}

export function Notice({ tone = 'warn', children }: { tone?: 'warn' | 'info' | 'ok'; children: React.ReactNode }) {
  return (
    <div className={`${styles.notice} ${styles[`notice_${tone}`]}`} role={tone === 'warn' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/** "Missing data" state: game data is never guessed (DESIGN.md 0.1). */
export function MissingData({ what }: { what: string }) {
  return <span className={styles.missing}>Missing data: {what}</span>;
}
