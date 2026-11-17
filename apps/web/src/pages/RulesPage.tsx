import type { RuleSection } from '@battle-drill/data';
import { useDeferredValue, useMemo, useState } from 'react';
import { RuleHtml } from '../components/RuleHtml.js';
import { type RulesData, useData } from '../data/store.js';
import { href, navigate } from '../router.js';

function ancestors(rules: RulesData, id: string): string[] {
  const out: string[] = [];
  let cur = rules.parentOf.get(id);
  while (cur) {
    out.unshift(cur);
    cur = rules.parentOf.get(cur);
  }
  return out;
}

function TreeNode({
  node,
  selected,
  open,
}: {
  node: RuleSection;
  selected?: string;
  open: Set<string>;
}) {
  const isOpen = open.has(node.id);
  return (
    <li>
      <a
        href={href('rules', node.id)}
        className={node.id === selected ? 'selected' : undefined}
        aria-current={node.id === selected ? 'page' : undefined}
      >
        {node.number && <span className="rule-number">{node.number}</span>} {node.title}
      </a>
      {node.children.length > 0 && isOpen && (
        <ul>
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} selected={selected} open={open} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function search(rules: RulesData, query: string, limit = 50): RuleSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  const scored: { s: RuleSection; score: number }[] = [];
  for (const s of rules.byId.values()) {
    if (s.kind === 'group') continue;
    const title = s.title.toLowerCase();
    const text = s.text.toLowerCase();
    if (!terms.every((t) => title.includes(t) || text.includes(t) || s.number.startsWith(t)))
      continue;
    const score =
      (title === q ? 100 : 0) +
      (title.includes(q) ? 50 : 0) +
      terms.filter((t) => title.includes(t)).length * 10;
    scored.push({ s, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}

function snippet(text: string, query: string): string {
  const i = text.toLowerCase().indexOf(query.trim().toLowerCase().split(/\s+/)[0] ?? '');
  if (i < 0) return text.slice(0, 140);
  const start = Math.max(0, i - 50);
  return (start > 0 ? '...' : '') + text.slice(start, start + 160) + '...';
}

export function RulesPage({ selectedId }: { selectedId?: string }) {
  const rules = useData((s) => s.rules)!;
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const results = useMemo(() => search(rules, deferred), [rules, deferred]);
  const selected = selectedId ? rules.byId.get(selectedId) : undefined;
  const open = useMemo(() => {
    const set = new Set<string>(rules.roots.map((r) => r.id));
    if (selected) {
      for (const a of ancestors(rules, selected.id)) set.add(a);
      set.add(selected.id);
    }
    return set;
  }, [rules, selected]);

  return (
    <div className="rules-layout">
      <aside className="rules-nav" aria-label="Rules contents">
        <input
          type="search"
          placeholder="Search rules"
          aria-label="Search rules"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.trim() ? (
          <ul className="search-results" data-testid="rule-search-results">
            {results.length === 0 && <li className="muted">No matches</li>}
            {results.map((s) => (
              <li key={s.id}>
                <a href={href('rules', s.id)}>
                  {s.number && <span className="rule-number">{s.number}</span>} {s.title}
                </a>
                <div className="muted small">{snippet(s.text, deferred)}</div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="rule-tree">
            {rules.roots.map((r) => (
              <TreeNode key={r.id} node={r} selected={selectedId} open={open} />
            ))}
          </ul>
        )}
      </aside>
      <article className="rules-content" data-testid="rule-content">
        {selected ? (
          <RuleView rules={rules} section={selected} />
        ) : selectedId ? (
          <p>Unknown rule id: {selectedId}</p>
        ) : (
          <p className="muted">
            Pick a section on the left or search. Text comes from your local cache.
          </p>
        )}
      </article>
    </div>
  );
}

export function RuleView({ rules, section }: { rules: RulesData; section: RuleSection }) {
  const trail = ancestors(rules, section.id);
  return (
    <>
      <nav className="breadcrumbs muted small" aria-label="Breadcrumbs">
        {trail.map((id) => (
          <span key={id}>
            <a href={href('rules', id)}>{rules.byId.get(id)?.title}</a> /{' '}
          </span>
        ))}
      </nav>
      <h2>
        {section.number && <span className="rule-number">{section.number}</span>} {section.title}
      </h2>
      <p className="muted small">
        <code>{section.id}</code> -{' '}
        <a href={section.sourceUrl} target="_blank" rel="noreferrer">
          source
        </a>
      </p>
      <RuleHtml html={section.html} onRuleLink={(id) => navigate('rules', id)} />
      {section.children.length > 0 && (
        <ul className="child-list">
          {section.children.map((c) => (
            <li key={c.id}>
              <a href={href('rules', c.id)}>
                {c.number && <span className="rule-number">{c.number}</span>} {c.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
