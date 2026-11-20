import { useState } from 'react';
import { ApiError } from '../../api/client';
import type { GlossaryKind } from '../../api/gameTypes';
import { keywordId } from '../../components/rules/DatasheetView';
import { KeywordRefButton } from '../../components/rules/KeywordRefButton';
import { RulesTextView } from '../../components/rules/RulesTextView';
import { Button } from '../../components/ui/Button';
import { LoadingState, Notice, errorMessage } from '../../components/ui/States';
import { useSaveOverrides } from '../admin/dataApi';
import { useMe } from '../auth/api';
import { useGlossary } from '../game/api';
import type { PopupEntry } from './stack';
import styles from './keywords.module.css';

const KIND: Record<GlossaryKind, string> = {
  CORE_ABILITY: 'Core ability',
  WEAPON_ABILITY: 'Weapon ability',
  UNIT_KEYWORD: 'Unit keyword',
  FACTION_KEYWORD: 'Faction keyword',
  RULE_TERM: 'Rule',
};

const TYPE_LABEL: Record<string, string> = {
  ABILITY: 'Abilities',
  ARMY_RULE: 'Army rules',
  ENHANCEMENT: 'Enhancements',
  STRATAGEM: 'Stratagems',
  DETACHMENT: 'Detachments',
  WEAPON: 'Weapons',
  GLOSSARY: 'Rules',
  DATASHEET: 'Datasheets',
};

export function KeywordPopup({
  entry,
  stack,
  version,
  onBack,
  onCrumb,
  onClose,
}: {
  entry: PopupEntry;
  stack: PopupEntry[];
  version: number | undefined;
  onBack: () => void;
  onCrumb: (i: number) => void;
  onClose: () => void;
}) {
  const g = useGlossary(entry.id, version);
  const missing = !entry.id || (g.isError && g.error instanceof ApiError && g.error.status === 404);

  return (
    <div className={styles.inner}>
      <div className={styles.bar}>
        {stack.length > 1 ? (
          <button type="button" className={styles.back} onClick={onBack}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Back
          </button>
        ) : (
          <span />
        )}
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close rules">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {stack.length > 1 && (
        <nav aria-label="Rules breadcrumb" className={styles.crumbs}>
          {stack.map((s, i) => (
            <span key={i} className={styles.crumbItem}>
              {i > 0 && <span aria-hidden="true"> &gt; </span>}
              {i < stack.length - 1 ? (
                <button type="button" className={styles.crumb} onClick={() => onCrumb(i)}>
                  {s.label}
                </button>
              ) : (
                <span aria-current="page">{s.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className={styles.body}>
        {g.isPending && entry.id && <LoadingState />}
        {missing && <Missing label={entry.label} id={entry.id} />}
        {g.isError && !missing && <Notice>{errorMessage(g.error)}</Notice>}
        {g.data && (
          <>
            <h2 className={styles.term}>{g.data.entry.term}</h2>
            <span className={styles.kind}>{KIND[g.data.entry.kind]}</span>
            {entry.label.toLowerCase() !== g.data.entry.term.toLowerCase() && <span className={styles.printed}>Printed as: {entry.label}</span>}
            {g.data.entry.text.plain ? (
              <RulesTextView text={g.data.entry.text} />
            ) : (
              <p className={styles.plainNote}>
                {g.data.entry.kind === 'UNIT_KEYWORD' || g.data.entry.kind === 'FACTION_KEYWORD'
                  ? `${KIND[g.data.entry.kind]}, no rules of its own.`
                  : 'No definition in the database yet.'}
              </p>
            )}
            {g.data.seeAlso.length > 0 && (
              <div className={styles.seeAlso}>
                <span className={styles.sectionLabel}>See also</span>
                <div className={styles.links}>
                  {g.data.seeAlso.map((s) => (
                    <KeywordRefButton key={s.key} glossaryId={s.key} label={s.name} />
                  ))}
                </div>
              </div>
            )}
            <References refs={g.data.entry.referencedBy} />
          </>
        )}
      </div>
    </div>
  );
}

function References({ refs }: { refs: { type: string; key: string; name: string }[] }) {
  const [all, setAll] = useState(false);
  if (refs.length === 0) return null;
  const groups = new Map<string, string[]>();
  for (const r of refs) {
    const list = groups.get(r.type) ?? [];
    if (!list.includes(r.name)) list.push(r.name);
    groups.set(r.type, list);
  }
  return (
    <div className={styles.refs}>
      <span className={styles.sectionLabel}>Used by rules in the data</span>
      {[...groups.entries()].map(([type, names]) => (
        <div key={type} className={styles.refGroup}>
          <span className={styles.refType}>{TYPE_LABEL[type] ?? type}</span>
          <span className={styles.refNames}>
            {(all ? names : names.slice(0, 12)).join(', ')}
            {!all && names.length > 12 && (
              <>
                {' '}
                <button type="button" className={styles.more} onClick={() => setAll(true)}>
                  and {names.length - 12} more
                </button>
              </>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Never generate text: say it is missing, and let an admin add it (stored as a manual override). */
function Missing({ label, id }: { label: string; id: string | undefined }) {
  const me = useMe();
  const save = useSaveOverrides();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const key = id ?? keywordId(label.replace(/:.*$/, '').replace(/\s+(\d+\+?|D\d+(\+\d+)?)$/i, ''));
  return (
    <>
      <h2 className={styles.term}>{label}</h2>
      <p className={styles.plainNote}>No definition in the database yet.</p>
      {me.data?.role === 'ADMIN' && !open && (
        <div>
          <Button size="s" onClick={() => setOpen(true)}>
            Add definition
          </Button>
        </div>
      )}
      {open && (
        <div className={styles.addForm}>
          <label className={styles.addLabel}>
            Rules text for {label}
            <textarea className={styles.textarea} rows={6} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          {save.isError && <Notice>{errorMessage(save.error)}</Notice>}
          {save.isSuccess && <Notice tone="ok">Saved. It appears after the next reload.</Notice>}
          <div className={styles.addActions}>
            <Button
              size="s"
              variant="primary"
              disabled={!text.trim() || save.isPending}
              onClick={() =>
                save.mutate([
                  {
                    type: 'GLOSSARY',
                    key,
                    field: '*',
                    value: { term: label.replace(/:.*$/, '').trim(), aliases: [], kind: 'RULE_TERM', text: { plain: text.trim() }, seeAlso: [] },
                    note: 'Added from a keyword popup',
                  },
                ])
              }
            >
              Save definition
            </Button>
            <Button size="s" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
