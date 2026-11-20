import type { ButtonHTMLAttributes } from 'react';
import styles from './ui.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  size = 'm',
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 's' | 'm' }) {
  return (
    <button
      type={type}
      className={[styles.button, styles[variant], size === 's' ? styles.small : '', className ?? ''].join(' ')}
      {...rest}
    />
  );
}
