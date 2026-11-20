import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState, Notice, errorMessage } from '../../components/ui/States';
import { estimatePages, fileName } from './content';
import {
  SECTION_LABELS,
  loadLast,
  moveSection,
  normalize,
  saveLast,
  useDeletePreset,
  useExportData,
  usePresets,
  useSavePreset,
} from './settings';
import type { ExportData, ExportSettings } from './types';
import styles from './export.module.css';

type Generate = (data: ExportData, settings: ExportSettings) => Promise<Blob>;

const defaultGenerate: Generate = async (data, settings) => {
  const mod = await import('./pdf/render');
  return mod.renderPdf(data, settings);
};

/** Export dialog (DESIGN.md 9.1): options on the left, page estimate and actions on the right. */
export function ExportDialog({ rosterId, onClose, generate = defaultGenerate }: { rosterId: number; onClose: () => void; generate?: Generate }) {
  const data = useExportData(rosterId, true);
  const [settings, setSettings] = useState<ExportSettings>(() => loadLast());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const update = (patch: Partial<ExportSettings>) => setSettings((s) => ({ ...s, ...patch }));
  const pages = useMemo(() => (data.data ? estimatePages(data.data, settings) : 0), [data.data, settings]);
  const anyOn = settings.sections.some((s) => s.on);

  async function exportPdf() {
    if (!data.data) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await generate(data.data, settings);
      saveLast(settings);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName(data.data.roster.name);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDone(a.download);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="export-h" tabIndex={-1}>
        <div className={styles.head}>
          <h2 id="export-h" className={styles.title}>
            Export PDF
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close export">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className={styles.body}>
          <div className={styles.options}>
            <fieldset className={styles.group}>
              <legend className={styles.legend}>Page</legend>
              <div className={styles.inline}>
                <Segmented
                  label="Paper size"
                  value={settings.paper}
                  options={[
                    ['A4', 'A4'],
                    ['LETTER', 'Letter'],
                  ]}
                  onChange={(paper) => update({ paper })}
                />
                <Segmented
                  label="Text size"
                  value={settings.textSize}
                  options={[
                    ['normal', 'Normal'],
                    ['large', 'Large'],
                  ]}
                  onChange={(textSize) => update({ textSize })}
                />
              </div>
              <Check label="Include points" checked={settings.includePoints} onChange={(includePoints) => update({ includePoints })} />
            </fieldset>

            <fieldset className={styles.group}>
              <legend className={styles.legend}>Sections (drag or use the arrows to reorder)</legend>
              <SectionList settings={settings} onChange={setSettings} />
            </fieldset>

            <fieldset className={styles.group}>
              <legend className={styles.legend}>Unit cards</legend>
              <Check label="Put leaders right before the unit they lead" checked={settings.leadersBeforeUnit} onChange={(leadersBeforeUnit) => update({ leadersBeforeUnit })} />
              <Check label="Hide wargear options not taken" checked={settings.hideUntakenWargear} onChange={(hideUntakenWargear) => update({ hideUntakenWargear })} />
            </fieldset>

            <fieldset className={styles.group}>
              <legend className={styles.legend}>Stratagems</legend>
              <Check label="Include core stratagems" checked={settings.includeCoreStratagems} onChange={(includeCoreStratagems) => update({ includeCoreStratagems })} />
              <Check
                label="Include stratagems of detachments not selected"
                checked={settings.includeOtherDetachments}
                onChange={(includeOtherDetachments) => update({ includeOtherDetachments })}
              />
            </fieldset>
          </div>

          <aside className={styles.side}>
            <div className={styles.estimate}>
              {data.isPending && <LoadingState label="Collecting the list" />}
              {data.isError && <ErrorState error={data.error} />}
              {data.data && (
                <>
                  <span className={styles.estimateLabel}>Estimated length</span>
                  <span className={`${styles.estimateValue} num`} data-testid="page-estimate">
                    {anyOn ? `about ${pages} ${pages === 1 ? 'page' : 'pages'}` : 'nothing selected'}
                  </span>
                </>
              )}
            </div>
            <Presets settings={settings} onLoad={(s) => setSettings(normalize(s))} />
            {error !== null && <Notice>{errorMessage(error)}</Notice>}
            {done && <Notice tone="ok">Downloaded {done}</Notice>}
            <Button variant="primary" onClick={() => void exportPdf()} disabled={!data.data || busy || !anyOn}>
              {busy ? 'Building PDF' : 'Download PDF'}
            </Button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.segmented}>
      <span className={styles.segLabel}>{label}</span>
      <div className={styles.segRow}>
        {options.map(([v, text]) => (
          <label key={v} className={`${styles.seg} ${v === value ? styles.segOn : ''}`}>
            <input type="radio" className="sr-only" name={label} checked={v === value} onChange={() => onChange(v)} />
            {text}
          </label>
        ))}
      </div>
    </div>
  );
}

function SectionList({ settings, onChange }: { settings: ExportSettings; onChange: (s: ExportSettings) => void }) {
  const [dragging, setDragging] = useState<number | null>(null);
  return (
    <ol className={styles.sections}>
      {settings.sections.map((sec, i) => (
        <li
          key={sec.id}
          className={`${styles.section} ${dragging === i ? styles.dragging : ''}`}
          draggable
          onDragStart={(e) => {
            setDragging(i);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragging !== null && dragging !== i) {
              onChange(moveSection(settings, dragging, i));
              setDragging(i);
            }
          }}
          onDragEnd={() => setDragging(null)}
        >
          <span className={styles.grip} aria-hidden="true">
            ⋮⋮
          </span>
          <label className={styles.sectionLabel}>
            <input
              type="checkbox"
              checked={sec.on}
              onChange={(e) => onChange({ ...settings, sections: settings.sections.map((x) => (x.id === sec.id ? { ...x, on: e.target.checked } : x)) })}
            />
            {SECTION_LABELS[sec.id]}
          </label>
          <button type="button" className={styles.arrow} onClick={() => onChange(moveSection(settings, i, i - 1))} disabled={i === 0} aria-label={`Move ${SECTION_LABELS[sec.id]} up`}>
            ↑
          </button>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => onChange(moveSection(settings, i, i + 1))}
            disabled={i === settings.sections.length - 1}
            aria-label={`Move ${SECTION_LABELS[sec.id]} down`}
          >
            ↓
          </button>
        </li>
      ))}
    </ol>
  );
}

function Presets({ settings, onLoad }: { settings: ExportSettings; onLoad: (s: unknown) => void }) {
  const presets = usePresets();
  const save = useSavePreset();
  const remove = useDeletePreset();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  return (
    <div className={styles.presets}>
      <span className={styles.estimateLabel}>Presets</span>
      {presets.data && presets.data.length > 0 && (
        <div className={styles.presetRow}>
          <label className="sr-only" htmlFor="preset-pick">
            Load a preset
          </label>
          <select
            id="preset-pick"
            className={styles.select}
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              const p = presets.data?.find((x) => String(x.id) === e.target.value);
              if (p) onLoad(p.settings);
            }}
          >
            <option value="">Load a preset</option>
            {presets.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {selected && (
            <Button size="s" variant="danger" onClick={() => remove.mutate(Number(selected), { onSuccess: () => setSelected('') })}>
              Delete
            </Button>
          )}
        </div>
      )}
      <div className={styles.presetRow}>
        <label className="sr-only" htmlFor="preset-name">
          Preset name
        </label>
        <input id="preset-name" className={styles.select} placeholder="Preset name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        <Button size="s" onClick={() => save.mutate({ name: name.trim(), settings }, { onSuccess: () => setName('') })} disabled={!name.trim() || save.isPending}>
          Save as preset
        </Button>
      </div>
      {save.isError && <Notice>{errorMessage(save.error)}</Notice>}
      {save.isSuccess && <span className={styles.saved}>Preset saved</span>}
    </div>
  );
}
