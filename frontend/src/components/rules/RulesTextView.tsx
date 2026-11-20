import type { RulesText, Token } from '../../api/gameTypes';
import { KeywordRefButton } from './KeywordRefButton';
import styles from './rules.module.css';

/** Renders linked rules text from tokens (never raw HTML). Line breaks in the text are kept. */
export function RulesTextView({ text, className }: { text: RulesText; className?: string }) {
  const tokens: Token[] = text.tokens.length > 0 ? text.tokens : text.plain ? [{ type: 'text', value: text.plain }] : [];
  if (tokens.length === 0) return null;
  return (
    <p className={`${styles.rules} ${className ?? ''}`}>
      {tokens.map((t, i) =>
        t.type === 'text' ? <span key={i}>{t.value}</span> : <KeywordRefButton key={i} glossaryId={t.glossaryId} label={t.label} inline />,
      )}
    </p>
  );
}
