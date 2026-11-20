import { useState } from 'react';
import type { EntityType, PhaseTags } from '../../api/gameTypes';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState, Notice, errorMessage } from '../../components/ui/States';
import { useFactions } from '../game/api';
import { useDeleteOverride, useEntity, useEntityList, useSaveOverrides } from './dataApi';
import { PhaseTagEditor, label } from './PhaseTagEditor';
import styles from './Admin.module.css';

const TYPES: EntityType[] = [
  'DATASHEET',
  'UNIT_SIZE',
  'WEAPON',
  'WARGEAR_OPTION',
  'ABILITY',
  'DETACHMENT',
  'ENHANCEMENT',
  'STRATAGEM',
  'ARMY_RULE',
  'FACTION_OPTION',
  'FACTION',
  'BATTLE_SIZE',
  'FORCE_DISPOSITION',
  'GLOSSARY',
];

export function EditorPage() {
  const factions = useFactions();
  const [type, setType] = useState<EntityType>('DATASHEET');
  const [faction, setFaction] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<{ type: EntityType; key: string } | null>(null);
  const list = useEntityList({ type, ...(faction ? { faction } : {}), ...(q ? { q } : {}) });

  return (
    <section className={styles.section} aria-labelledby="editor-h">
      <h2 id="editor-h" className={styles.sectionTitle}>
        Data editor
      </h2>
      <p className={styles.muted}>Every edit is stored as an override with a note and applied on top of every import.</p>
      <div className={styles.toolbar}>
        <label className={styles.inline}>
          Type
          <select className={styles.select} value={type} onChange={(e) => setType(e.target.value as EntityType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.inline}>
          Faction
          <select className={styles.select} value={faction} onChange={(e) => setFaction(e.target.value)}>
            <option value="">all</option>
            {factions.data?.map((f) => (
              <option key={f.key} value={f.key}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.inline}>
          Search
          <input className={styles.select} value={q} onChange={(e) => setQ(e.target.value)} placeholder="name or key" />
        </label>
        <NewEntity type={type} onCreated={(key) => setSelected({ type, key })} />
      </div>
      <div className={styles.split}>
        <div className={styles.listCol}>
          {list.isPending && <LoadingState />}
          {list.isError && <ErrorState error={list.error} />}
          {list.data && list.data.length === 0 && <p className={styles.muted}>Nothing found.</p>}
          <ul className={styles.pickList}>
            {list.data?.map((e) => (
              <li key={e.key}>
                <button
                  type="button"
                  className={`${styles.pick} ${selected?.key === e.key ? styles.pickOn : ''}`}
                  onClick={() => setSelected({ type: e.type, key: e.key })}
                >
                  <span>{e.name}</span>
                  <span className={styles.key}>{e.key}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.detailCol}>
          {selected ? <EntityEditor type={selected.type} entityKey={selected.key} /> : <p className={styles.muted}>Select an entry.</p>}
        </div>
      </div>
    </section>
  );
}

const WHOLE_TYPES: EntityType[] = ['BATTLE_SIZE', 'FORCE_DISPOSITION', 'GLOSSARY'];

function NewEntity({ type, onCreated }: { type: EntityType; onCreated: (key: string) => void }) {
  const save = useSaveOverrides();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [json, setJson] = useState('');
  const [note, setNote] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  if (!WHOLE_TYPES.includes(type)) return null;
  const template =
    type === 'BATTLE_SIZE'
      ? { name: '', pointsLimit: 0, dpBudget: 0, limits: {} }
      : type === 'FORCE_DISPOSITION'
        ? { name: '', text: { plain: '' } }
        : { term: '', aliases: [], kind: 'RULE_TERM', text: { plain: '' }, seeAlso: [] };
  if (!open) {
    return (
      <Button
        size="s"
        onClick={() => {
          setOpen(true);
          setJson(JSON.stringify(template, null, 2));
        }}
      >
        New {label(type).toLowerCase()}
      </Button>
    );
  }
  return (
    <div className={styles.card}>
      <label className={styles.inline}>
        Key
        <input className={styles.select} value={key} onChange={(e) => setKey(e.target.value)} placeholder="battle-size:my-size" />
      </label>
      <label className={styles.stack}>
        Data (JSON)
        <textarea className={styles.textarea} rows={8} value={json} onChange={(e) => setJson(e.target.value)} />
      </label>
      <label className={styles.inline}>
        Note
        <input className={styles.select} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {parseError && <Notice>{parseError}</Notice>}
      {save.isError && <Notice>{errorMessage(save.error)}</Notice>}
      <div className={styles.toolbar}>
        <Button
          variant="primary"
          size="s"
          disabled={!key.trim() || save.isPending}
          onClick={() => {
            try {
              const value: unknown = JSON.parse(json);
              setParseError(null);
              save.mutate([{ type, key: key.trim(), field: '*', value, note }], {
                onSuccess: () => {
                  setOpen(false);
                  onCreated(key.trim());
                },
              });
            } catch {
              setParseError('The data is not valid JSON');
            }
          }}
        >
          Create
        </Button>
        <Button size="s" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

type FieldKind = 'text' | 'number' | 'boolean' | 'list' | 'rules' | 'tags' | 'json';

function kindOf(value: unknown): FieldKind {
  if (typeof value === 'string') return 'text';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return 'list';
  if (value && typeof value === 'object' && 'plain' in value) return 'rules';
  if (value && typeof value === 'object' && 'phases' in value && 'timing' in value) return 'tags';
  return 'json';
}

function EntityEditor({ type, entityKey }: { type: EntityType; entityKey: string }) {
  const entity = useEntity(type, entityKey);
  const remove = useDeleteOverride();
  if (entity.isPending) return <LoadingState />;
  if (entity.isError) return <ErrorState error={entity.error} />;
  const { stored, overrides } = entity.data;
  const fields = Object.entries(stored.entity).filter(([k]) => k !== 'key' && k !== 'referencedBy');
  return (
    <div className={styles.section}>
      <div>
        <h3 className={styles.subTitle}>{String(stored.entity.name ?? stored.entity.term ?? entityKey)}</h3>
        <span className={styles.key}>{entityKey}</span>
        <p className={styles.muted}>
          Main source: {stored.source.toLowerCase()}
          {Object.entries(stored.externalIds).map(([s, id]) => ` · ${s.toLowerCase()} id ${id}`)}
        </p>
      </div>
      {overrides.length > 0 && (
        <div className={styles.card}>
          <h4 className={styles.cardTitle}>Overrides</h4>
          <ul className={styles.plainList}>
            {overrides.map((o) => (
              <li key={o.id}>
                <span className={styles.key}>{o.field}</span> {o.note && `- ${o.note}`}{' '}
                <Button size="s" variant="danger" onClick={() => remove.mutate(o.id)} disabled={remove.isPending}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {fields.map(([field, value]) => (
        <FieldEditor
          key={`${entityKey}-${field}`}
          type={type}
          entityKey={entityKey}
          field={field}
          value={value}
          source={stored.provenance[field]}
        />
      ))}
    </div>
  );
}

function FieldEditor({
  type,
  entityKey,
  field,
  value,
  source,
}: {
  type: EntityType;
  entityKey: string;
  field: string;
  value: unknown;
  source: string | undefined;
}) {
  const kind = kindOf(value);
  const save = useSaveOverrides();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<unknown>(value);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const id = `f-${entityKey}-${field}`;

  function start() {
    setDraft(value);
    setText(
      kind === 'list'
        ? (value as string[]).join('\n')
        : kind === 'rules'
          ? (value as { plain: string }).plain
          : kind === 'json'
            ? JSON.stringify(value, null, 2)
            : String(value ?? ''),
    );
    setEditing(true);
    setErr(null);
  }

  function submit() {
    let out: unknown;
    let path = field;
    try {
      switch (kind) {
        case 'text':
          out = text;
          break;
        case 'number':
          if (!/^-?\d+$/.test(text.trim())) throw new Error('Enter a whole number');
          out = Number(text);
          break;
        case 'boolean':
          out = draft;
          break;
        case 'list':
          out = text.split('\n').map((s) => s.trim()).filter(Boolean);
          break;
        case 'rules':
          out = text;
          path = `${field}.plain`;
          break;
        case 'tags':
          out = { ...(draft as PhaseTags), confirmed: true };
          break;
        default:
          out = JSON.parse(text);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Invalid value');
      return;
    }
    save.mutate([{ type, key: entityKey, field: path, value: out, note }], { onSuccess: () => setEditing(false) });
  }

  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldHead}>
        <span className={styles.fieldName}>{field}</span>
        {source && <span className={`${styles.status} ${styles[`src_${source}`] ?? ''}`}>{source.toLowerCase()}</span>}
        {!editing && (
          <Button size="s" onClick={start}>
            Edit
          </Button>
        )}
      </div>
      {!editing && <pre className={styles.value}>{display(value, kind)}</pre>}
      {editing && (
        <div className={styles.stack}>
          {kind === 'boolean' && (
            <label className={styles.inline}>
              <input type="checkbox" checked={draft === true} onChange={(e) => setDraft(e.target.checked)} /> {field}
            </label>
          )}
          {kind === 'tags' && <PhaseTagEditor idPrefix={id} value={draft as PhaseTags} onChange={setDraft} />}
          {(kind === 'text' || kind === 'number') && (
            <input id={id} aria-label={field} className={styles.select} value={text} onChange={(e) => setText(e.target.value)} />
          )}
          {(kind === 'list' || kind === 'rules' || kind === 'json') && (
            <textarea
              id={id}
              aria-label={field}
              className={styles.textarea}
              rows={kind === 'rules' ? 8 : 5}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
          <label className={styles.inline}>
            Note
            <input className={styles.select} value={note} onChange={(e) => setNote(e.target.value)} placeholder="why this change" />
          </label>
          {err && <Notice>{err}</Notice>}
          {save.isError && <Notice>{errorMessage(save.error)}</Notice>}
          <div className={styles.toolbar}>
            <Button size="s" variant="primary" onClick={submit} disabled={save.isPending}>
              Save
            </Button>
            <Button size="s" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function display(value: unknown, kind: FieldKind): string {
  if (kind === 'rules') return (value as { plain: string }).plain || '(empty)';
  if (kind === 'list') return (value as string[]).join(', ') || '(none)';
  if (kind === 'tags') {
    const t = value as PhaseTags;
    return `${t.phases.map(label).join(', ') || '(no phase)'} · ${label(t.timing)}${t.inferred ? ' · inferred' : ''}${t.confirmed ? ' · confirmed' : ''}`;
  }
  if (typeof value === 'string') return value || '(empty)';
  return JSON.stringify(value, null, 2);
}
