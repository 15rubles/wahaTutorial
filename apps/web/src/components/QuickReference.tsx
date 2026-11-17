import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../data/store.js';
import { RuleView, search } from '../pages/RulesPage.js';

/** Rules search available from every page, in a side drawer. */
export function QuickReference() {
  const rules = useData((s) => s.rules);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const deferred = useDeferredValue(query);
  const results = useMemo(() => (rules ? search(rules, deferred, 20) : []), [rules, deferred]);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close?.();
  }, [open]);
  if (!rules) return null;
  const section = selected ? rules.byId.get(selected) : undefined;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="quick-ref-open"
        aria-haspopup="dialog"
      >
        Quick rules
      </button>
      <dialog
        ref={ref}
        className="quick-ref"
        onClose={() => setOpen(false)}
        aria-label="Quick rules reference"
        data-testid="quick-ref"
      >
        <header>
          <input
            type="search"
            autoFocus
            placeholder="Search rules"
            aria-label="Search rules"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" onClick={() => setOpen(false)}>
            Close
          </button>
        </header>
        {section ? (
          <>
            <button type="button" className="link small" onClick={() => setSelected(null)}>
              Back to results
            </button>
            <RuleView rules={rules} section={section} />
          </>
        ) : (
          <ul className="search-results">
            {results.map((s) => (
              <li key={s.id}>
                <button type="button" className="link" onClick={() => setSelected(s.id)}>
                  {s.number && <span className="rule-number">{s.number}</span>} {s.title}
                </button>
              </li>
            ))}
            {query && results.length === 0 && <li className="muted">No matches</li>}
          </ul>
        )}
      </dialog>
    </>
  );
}
