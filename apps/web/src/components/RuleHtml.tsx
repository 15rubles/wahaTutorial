import { type MouseEvent, useCallback } from 'react';

interface Props {
  html: string;
  onRuleLink: (ruleId: string) => void;
  className?: string;
}

/**
 * Renders a rule section body from the local cache. The HTML was sanitized by the data build
 * (no scripts, no inline styles, only http(s) and #rule: links).
 */
export function RuleHtml({ html, onRuleLink, className }: Props) {
  const onClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const a = (e.target as HTMLElement).closest('a');
      const target = a?.getAttribute('href');
      if (target?.startsWith('#rule:')) {
        e.preventDefault();
        onRuleLink(target.slice('#rule:'.length));
      }
    },
    [onRuleLink],
  );
  return (
    <div
      className={`rule-html ${className ?? ''}`}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
