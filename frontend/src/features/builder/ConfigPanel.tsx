import { useState, type ReactNode } from 'react';
import type { BattleSize, DetachmentDetail, FactionConfig, ForceDisposition } from '../../api/gameTypes';
import { Button } from '../../components/ui/Button';
import { RulesTextView } from '../../components/rules/RulesTextView';
import { MissingData, Notice, errorMessage } from '../../components/ui/States';
import { useRosterMutations, type RosterFlags, type RosterView } from '../rosters/api';
import styles from './builder.module.css';

type Props = {
  roster: RosterView;
  battleSizes: BattleSize[];
  config: FactionConfig | undefined;
  detachments: DetachmentDetail[];
  dispositions: ForceDisposition[];
  defaultOpen: boolean;
};

/** Configuration panel at the top of the List pane (DESIGN.md 7.2), styled like the mockup. */
export function ConfigPanel({ roster, battleSizes, config, detachments, dispositions, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const m = useRosterMutations(roster.id);
  const size = battleSizes.find((b) => b.key === roster.battleSizeKey);
  const chosen = detachments.filter((d) => roster.detachments.includes(d.detachment.key));
  const offered = new Set(chosen.flatMap((d) => d.detachment.forceDispositions.map((n) => n.toLowerCase())));
  const fd = dispositions.find((f) => f.key === roster.forceDisposition);
  const remaining = roster.totals.dpBudget !== undefined ? roster.totals.dpBudget - roster.totals.dp : undefined;
  const error = [m.config, m.detachments].find((x) => x.isError)?.error;

  return (
    <section className={styles.config} aria-labelledby="config-h">
      <div className={styles.configBar}>
        <h2 id="config-h" className={styles.configTitle}>
          Configuration
        </h2>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? 'Collapse configuration' : 'Expand configuration'}
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </button>
      </div>
      {open && (
        <>
          {error && <Notice>{errorMessage(error)}</Notice>}
          <ConfigRow
            label="Battle Size"
            value={size ? `${size.name}${size.pointsLimit !== undefined ? ` (${size.pointsLimit} point limit)` : ''}` : <MissingData what="no battle size chosen" />}
            editor={(close) => (
              <ChoiceList
                name="battle-size"
                options={battleSizes.map((b) => ({ value: b.key, label: `${b.name}${b.pointsLimit !== undefined ? ` (${b.pointsLimit} points, ${b.dpBudget ?? '?'} DP)` : ''}` }))}
                value={roster.battleSizeKey}
                onPick={(v) => m.config.mutate({ battleSizeKey: v }, { onSuccess: close })}
              />
            )}
          />
          {config?.factionOptions.map((o) => (
            <ConfigRow
              key={o.key}
              label={o.name}
              value={roster.factionOptions[o.key] ?? <MissingData what="not chosen" />}
              editor={(close) => (
                <ChoiceList
                  name={o.key}
                  options={o.values.map((v) => ({ value: v.name, label: v.name, detail: <RulesTextView text={v.text} /> }))}
                  value={roster.factionOptions[o.key]}
                  onPick={(v) => m.config.mutate({ factionOptions: { [o.key]: v } }, { onSuccess: close })}
                />
              )}
            />
          ))}
          <ConfigRow
            label={roster.detachments.length === 1 ? 'Detachment' : 'Detachments'}
            badge={
              <span className={styles.dpBadge}>
                <span className="num">{roster.totals.dp}</span> Detachment Points
                {remaining !== undefined && (
                  <>
                    {' · '}
                    <span className="num">{remaining}</span> left
                  </>
                )}
              </span>
            }
            value={chosen.length > 0 ? chosen.map((d) => d.detachment.name).join(', ') : <MissingData what="no detachment chosen" />}
            editor={(close) => <DetachmentPicker roster={roster} detachments={detachments} onDone={close} />}
          />
          <ConfigRow
            label="Force Disposition"
            value={fd ? fd.name : <span className={styles.muted}>Not chosen</span>}
            editor={(close) => (
              <ChoiceList
                name="force-disposition"
                options={dispositions
                  .filter((f) => offered.has(f.name.toLowerCase()))
                  .map((f) => ({ value: f.key, label: f.name, detail: f.text.plain ? <RulesTextView text={f.text} /> : <MissingData what="rules text" /> }))}
                value={roster.forceDisposition}
                empty="Choose a detachment first: it decides which force dispositions are available."
                onPick={(v) => m.config.mutate({ forceDisposition: v }, { onSuccess: close })}
              />
            )}
          />
          <ConfigRow
            label="Show/Hide Options"
            value={flagsText(roster.flags)}
            editor={(close) => <FlagsEditor flags={roster.flags} onSave={(flags) => m.config.mutate({ flags }, { onSuccess: close })} />}
          />
        </>
      )}
    </section>
  );
}

function flagsText(f: RosterFlags): string {
  return [
    `Legends are ${f.legends ? 'visible' : 'hidden'}`,
    `Unaligned Forces are ${f.unalignedForces ? 'visible' : 'hidden'}`,
    `Unaligned Fortifications are ${f.unalignedFortifications ? 'visible' : 'hidden'}`,
  ].join(', ');
}

function GearIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </svg>
  );
}

function ConfigRow({
  label,
  value,
  badge,
  editor,
}: {
  label: string;
  value: ReactNode;
  badge?: ReactNode;
  editor: (close: () => void) => ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className={styles.configRow}>
      <div className={styles.configLabel}>
        <GearIcon />
        <span>{label}</span>
        {badge}
        <button type="button" className={styles.changeBtn} onClick={() => setEditing(!editing)} aria-expanded={editing} aria-label={`Change ${label}`}>
          {editing ? 'Close' : 'Change'}
        </button>
      </div>
      <div className={styles.configValue}>{editing ? editor(() => setEditing(false)) : value}</div>
    </div>
  );
}

function ChoiceList({
  name,
  options,
  value,
  onPick,
  empty,
}: {
  name: string;
  options: { value: string; label: string; detail?: ReactNode }[];
  value: string | undefined;
  onPick: (v: string) => void;
  empty?: string;
}) {
  if (options.length === 0) return <span className={styles.muted}>{empty ?? 'Nothing to choose from in the data.'}</span>;
  return (
    <fieldset className={styles.choices}>
      <legend className="sr-only">{name}</legend>
      {options.map((o) => (
        <label key={o.value} className={`${styles.choice} ${o.value === value ? styles.choiceOn : ''}`}>
          <input type="radio" name={name} checked={o.value === value} onChange={() => onPick(o.value)} />
          <span className={styles.choiceText}>
            <span>{o.label}</span>
            {o.detail}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function DetachmentPicker({ roster, detachments, onDone }: { roster: RosterView; detachments: DetachmentDetail[]; onDone: () => void }) {
  const m = useRosterMutations(roster.id);
  const [picked, setPicked] = useState<string[]>(roster.detachments);
  const dp = picked.reduce((sum, k) => sum + (detachments.find((d) => d.detachment.key === k)?.detachment.dpCost ?? 0), 0);
  if (detachments.length === 0) return <MissingData what="no detachments for this faction" />;
  return (
    <div className={styles.picker}>
      <fieldset className={styles.choices}>
        <legend className="sr-only">Detachments</legend>
        {detachments.map((d) => {
          const on = picked.includes(d.detachment.key);
          return (
            <label key={d.detachment.key} className={`${styles.choice} ${on ? styles.choiceOn : ''}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => setPicked(on ? picked.filter((k) => k !== d.detachment.key) : [...picked, d.detachment.key])}
              />
              <span className={styles.choiceText}>
                <span>
                  {d.detachment.name}{' '}
                  <span className={styles.dpBadge}>
                    {d.detachment.dpCost !== undefined ? <span className="num">{d.detachment.dpCost} DP</span> : 'DP missing'}
                  </span>
                </span>
                {d.detachment.ruleName && <span className={styles.muted}>{d.detachment.ruleName}</span>}
              </span>
            </label>
          );
        })}
      </fieldset>
      <div className={styles.pickerBar}>
        <span className={styles.muted}>
          Selected: <span className="num">{dp}</span> DP{roster.totals.dpBudget !== undefined && <> of <span className="num">{roster.totals.dpBudget}</span></>}
        </span>
        <Button size="s" variant="primary" onClick={() => m.detachments.mutate(picked, { onSuccess: onDone })} disabled={m.detachments.isPending}>
          Save detachments
        </Button>
      </div>
    </div>
  );
}

function FlagsEditor({ flags, onSave }: { flags: RosterFlags; onSave: (f: RosterFlags) => void }) {
  const [f, setF] = useState(flags);
  const row = (key: keyof RosterFlags, label: string) => (
    <label className={styles.checkRow}>
      <input type="checkbox" checked={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.checked })} /> {label}
    </label>
  );
  return (
    <div className={styles.picker}>
      {row('legends', 'Show Legends units')}
      {row('unalignedForces', 'Show Unaligned Forces')}
      {row('unalignedFortifications', 'Show Unaligned Fortifications')}
      <div>
        <Button size="s" variant="primary" onClick={() => onSave(f)}>
          Save
        </Button>
      </div>
    </div>
  );
}
