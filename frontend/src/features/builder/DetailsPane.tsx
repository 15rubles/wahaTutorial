import { useEffect, useState } from 'react';
import type { DatasheetDetail, DetachmentDetail, Enhancement, WargearOption } from '../../api/gameTypes';
import { DatasheetView } from '../../components/rules/DatasheetView';
import { RulesTextView } from '../../components/rules/RulesTextView';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState, MissingData, Notice, errorMessage } from '../../components/ui/States';
import { useDatasheet } from '../game/api';
import { useRosterMutations, type EntryView, type RosterView, type WargearChoice } from '../rosters/api';
import { ViolationList } from './RosterSections';
import { useBuilderUi } from './store';
import styles from './builder.module.css';

export function DetailsPane({ roster, detachments }: { roster: RosterView; detachments: DetachmentDetail[] }) {
  const selection = useBuilderUi((s) => s.selection);
  if (!selection) return <p className={styles.muted}>Select a unit to see its datasheet.</p>;
  if (selection.kind === 'datasheet') return <DatasheetPreview roster={roster} datasheetKey={selection.key} />;
  const entry = roster.entries.find((e) => e.id === selection.id);
  if (!entry) return <p className={styles.muted}>This unit is no longer in the list.</p>;
  return <EntryDetails roster={roster} entry={entry} detachments={detachments} />;
}

function DatasheetPreview({ roster, datasheetKey }: { roster: RosterView; datasheetKey: string }) {
  const detail = useDatasheet(datasheetKey, roster.version.rosterVersion);
  const m = useRosterMutations(roster.id);
  const select = useBuilderUi((s) => s.select);
  if (detail.isPending) return <LoadingState />;
  if (detail.isError) return <ErrorState error={detail.error} />;
  return (
    <div className={styles.details}>
      <div className={styles.detailsHead}>
        <h2 className={styles.detailsName}>{detail.data.datasheet.name}</h2>
        <Button
          variant="primary"
          size="s"
          disabled={m.addEntry.isPending}
          onClick={() =>
            m.addEntry.mutate(
              { datasheetKey },
              { onSuccess: (view) => select({ kind: 'entry', id: Math.max(...view.entries.map((e) => e.id)) }) },
            )
          }
        >
          Add to list
        </Button>
      </div>
      <DatasheetView detail={detail.data} />
    </div>
  );
}

function EntryDetails({ roster, entry, detachments }: { roster: RosterView; entry: EntryView; detachments: DetachmentDetail[] }) {
  const detail = useDatasheet(entry.datasheetKey, roster.version.rosterVersion);
  const m = useRosterMutations(roster.id);
  const select = useBuilderUi((s) => s.select);
  const patch = (p: Parameters<typeof m.updateEntry.mutate>[0]['patch']) => m.updateEntry.mutate({ entryId: entry.id, patch: p });
  const violations = roster.violations.filter((v) => v.entryIds.includes(entry.id));
  const error = [m.updateEntry, m.deleteEntry].find((x) => x.isError)?.error;

  return (
    <div className={styles.details}>
      <div className={styles.detailsHead}>
        <h2 className={styles.detailsName}>{entry.name}</h2>
        <span className={`${styles.detailsPts} num`}>{entry.points} pts</span>
      </div>
      {entry.missing && <Notice>This unit is not in the data version this list uses.</Notice>}
      <ViolationList violations={violations} />
      {error && <Notice>{errorMessage(error)}</Notice>}
      {detail.isPending && <LoadingState />}
      {detail.isError && <ErrorState error={detail.error} />}
      {detail.data && (
        <>
          <div className={styles.controls}>
            <SizePicker entry={entry} detail={detail.data} onPick={(sizeKey) => patch({ sizeKey })} />
            {isCharacter(detail.data) && <WarlordToggle value={entry.warlord} onChange={(warlord) => patch({ warlord })} />}
            <EnhancementPicker roster={roster} entry={entry} detail={detail.data} detachments={detachments} onPick={patch} />
            <AttachPicker roster={roster} entry={entry} detail={detail.data} detachments={detachments} onPick={patch} />
            {detail.data.wargear.map((o) => (
              <WargearPicker key={o.key} option={o} entry={entry} onChange={(wargear) => patch({ wargear })} />
            ))}
            <div>
              <Button
                size="s"
                variant="danger"
                onClick={() => m.deleteEntry.mutate(entry.id, { onSuccess: () => select(null) })}
                disabled={m.deleteEntry.isPending}
              >
                Remove from list
              </Button>
            </div>
          </div>
          <DatasheetView detail={detail.data} />
        </>
      )}
    </div>
  );
}

/** Flips at once; the server answer (and its violations) follows. */
function WarlordToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const [checked, setChecked] = useState(value);
  useEffect(() => setChecked(value), [value]);
  return (
    <label className={styles.checkRow}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          setChecked(e.target.checked);
          onChange(e.target.checked);
        }}
      />{' '}
      Warlord
    </label>
  );
}

function isCharacter(d: DatasheetDetail): boolean {
  return d.datasheet.keywords.some((k) => k.toLowerCase() === 'character') || (d.datasheet.role ?? '').toLowerCase().includes('character');
}

function SizePicker({ entry, detail, onPick }: { entry: EntryView; detail: DatasheetDetail; onPick: (k: string) => void }) {
  if (detail.sizes.length === 0) return <MissingData what="unit sizes" />;
  if (detail.sizes.length === 1) return null;
  return (
    <label className={styles.field}>
      Unit size
      <select className={styles.select} value={entry.sizeKey} onChange={(e) => onPick(e.target.value)}>
        {detail.sizes.map((s) => (
          <option key={s.key} value={s.key}>
            {s.name} ({s.points !== undefined ? `${s.points} pts` : 'points missing'})
          </option>
        ))}
      </select>
    </label>
  );
}

function eligible(e: Enhancement, d: DatasheetDetail): boolean {
  if (e.eligibleDatasheets.length > 0) return e.eligibleDatasheets.includes(d.datasheet.key);
  const kw = [...d.datasheet.keywords, ...d.datasheet.factionKeywords].map((k) => k.toLowerCase());
  if (e.requiredKeywords.some((k) => !kw.includes(k.toLowerCase()))) return false;
  if (e.forbiddenKeywords.some((k) => kw.includes(k.toLowerCase()))) return false;
  return e.upgrade || isCharacter(d);
}

function EnhancementPicker({
  roster,
  entry,
  detail,
  detachments,
  onPick,
}: {
  roster: RosterView;
  entry: EntryView;
  detail: DatasheetDetail;
  detachments: DetachmentDetail[];
  onPick: (p: { enhancementKey?: string; clearEnhancement?: boolean }) => void;
}) {
  const options = detachments
    .filter((d) => roster.detachments.includes(d.detachment.key))
    .flatMap((d) => d.enhancements)
    .filter((e) => eligible(e, detail) || e.key === entry.enhancementKey);
  if (options.length === 0 && !entry.enhancementKey) return null;
  const current = options.find((o) => o.key === entry.enhancementKey);
  return (
    <div className={styles.field}>
      <label className={styles.field}>
        Enhancement
        <select
          className={styles.select}
          value={entry.enhancementKey ?? ''}
          onChange={(e) => (e.target.value ? onPick({ enhancementKey: e.target.value }) : onPick({ clearEnhancement: true }))}
        >
          <option value="">None</option>
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.name}
              {o.upgrade ? ' (Upgrade)' : ''} ({o.points !== undefined ? `${o.points} pts` : 'points missing'})
            </option>
          ))}
        </select>
      </label>
      {current && <RulesTextView text={current.text} />}
    </div>
  );
}

function AttachPicker({
  roster,
  entry,
  detail,
  detachments,
  onPick,
}: {
  roster: RosterView;
  entry: EntryView;
  detail: DatasheetDetail;
  detachments: DetachmentDetail[];
  onPick: (p: { attachedTo?: number; detach?: boolean }) => void;
}) {
  const extra = detachments.flatMap((d) => d.enhancements).find((e) => e.key === entry.enhancementKey)?.grantsLeaderOf ?? [];
  const leads = new Set([...detail.leads.map((l) => l.key), ...extra]);
  const targets = roster.entries.filter((e) => e.id !== entry.id && leads.has(e.datasheetKey) && e.attachedTo === undefined);
  if (leads.size === 0) return null;
  return (
    <label className={styles.field}>
      {detail.datasheet.support ? 'Supporting' : 'Leading'}
      <select
        className={styles.select}
        value={entry.attachedTo ?? ''}
        onChange={(e) => (e.target.value ? onPick({ attachedTo: Number(e.target.value) }) : onPick({ detach: true }))}
      >
        <option value="">Not attached</option>
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function WargearPicker({ option, entry, onChange }: { option: WargearOption; entry: EntryView; onChange: (w: WargearChoice[]) => void }) {
  const [draft, setDraft] = useState<Record<string, number>>(() =>
    Object.fromEntries(entry.wargear.filter((w) => w.option === option.key).map((w) => [w.choice, w.count])),
  );
  const max = option.max !== undefined ? (option.perModels ? option.max * Math.max(1, Math.floor(entry.models / option.perModels)) : option.max) : undefined;
  function set(choice: string, count: number) {
    const next = { ...draft, [choice]: Math.max(0, count) };
    setDraft(next);
    const others = entry.wargear.filter((w) => w.option !== option.key);
    const mine = Object.entries(next).filter(([, c]) => c > 0).map(([c, n]) => ({ option: option.key, choice: c, count: n }));
    onChange([...others, ...mine]);
  }
  return (
    <fieldset className={styles.wargear}>
      <legend className={styles.wargearName}>{option.name}</legend>
      <p className={styles.wargearDesc}>{option.description}</p>
      {option.choices.length === 0 && <span className={styles.muted}>No choices listed in the data.</span>}
      {option.choices.map((c) => (
        <label key={c} className={styles.wargearRow}>
          <span>{c}</span>
          <input
            type="number"
            min={0}
            max={max ?? 99}
            className={`${styles.count} num`}
            value={draft[c] ?? 0}
            onChange={(e) => set(c, Number(e.target.value) || 0)}
            aria-label={`${c} count`}
          />
        </label>
      ))}
      {max !== undefined && <span className={styles.muted}>Up to {max} for this unit size</span>}
    </fieldset>
  );
}
