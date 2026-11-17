import { useEffect, useRef } from 'react';
import { useData } from '../data/store.js';
import { useRulePopup } from '../game/rulePopup.js';
import { href } from '../router.js';
import { RuleHtml } from './RuleHtml.js';

/** Modal with one rule section from the local cache. */
export function RulePopup() {
  const { ruleId, open, close } = useRulePopup();
  const rules = useData((s) => s.rules);
  const ref = useRef<HTMLDialogElement>(null);
  const section = ruleId ? rules?.byId.get(ruleId) : undefined;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ruleId && !d.open) d.showModal?.();
    if (!ruleId && d.open) d.close?.();
  }, [ruleId]);

  return (
    <dialog
      ref={ref}
      className="rule-popup"
      onClose={close}
      aria-labelledby="rule-popup-title"
      data-testid="rule-popup"
    >
      {section ? (
        <>
          <header>
            <h2 id="rule-popup-title">
              {section.number && <span className="rule-number">{section.number}</span>}{' '}
              {section.title}
            </h2>
            <button type="button" onClick={close} aria-label="Close">
              Close
            </button>
          </header>
          <RuleHtml html={section.html} onRuleLink={open} />
          <p className="small muted">
            <a href={href('rules', section.id)} onClick={close}>
              Open in rules browser
            </a>
          </p>
        </>
      ) : (
        ruleId && <p>Rule {ruleId} is not in your local cache.</p>
      )}
    </dialog>
  );
}

/** A keyword chip that opens its rule when one is known. */
export function KeywordChip({ label, ruleId }: { label: string; ruleId?: string | undefined }) {
  const open = useRulePopup((s) => s.open);
  if (!ruleId) return <span className="chip muted">{label}</span>;
  return (
    <button type="button" className="chip" onClick={() => open(ruleId)} title="Show rule">
      {label}
    </button>
  );
}
