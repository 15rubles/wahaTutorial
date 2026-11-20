import { useId, type InputHTMLAttributes } from 'react';
import styles from './ui.module.css';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | undefined; hint?: string };

export function TextField({ label, error, hint, id, ...rest }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [error ? `${inputId}-err` : '', hint ? `${inputId}-hint` : ''].filter(Boolean).join(' ');
  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
      />
      {hint && !error && (
        <span id={`${inputId}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${inputId}-err`} className={styles.fieldError}>
          {error}
        </span>
      )}
    </div>
  );
}
