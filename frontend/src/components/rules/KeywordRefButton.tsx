import { useOpenKeyword } from './KeywordContext';
import styles from './rules.module.css';

/** A clickable keyword: inline inside rules text, or as a chip. */
export function KeywordRefButton({
  glossaryId,
  label,
  inline = false,
  tone = 'lilac',
}: {
  glossaryId: string | undefined;
  label: string;
  inline?: boolean;
  tone?: 'lilac' | 'plain';
}) {
  const open = useOpenKeyword();
  const cls = inline ? styles.inlineRef : `${styles.chip} ${tone === 'plain' ? styles.chipPlain : ''}`;
  if (!open) return <span className={cls}>{label}</span>;
  return (
    <button
      type="button"
      className={`${cls} ${styles.clickable}`}
      onClick={(e) => open(glossaryId, label, e.currentTarget)}
      aria-haspopup="dialog"
    >
      {label}
    </button>
  );
}
