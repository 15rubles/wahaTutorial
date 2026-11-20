import type { Ability, Enhancement, GlossaryEntry, PhaseTags, RulesText, Stratagem, Token } from '../../api/gameTypes';
import type { EntryView } from '../rosters/api';
import type { ExportData, ExportSettings } from './types';

/** What goes into the PDF, derived from the export data and the settings. Pure, unit tested. */

export function stratagemsFor(data: ExportData, s: ExportSettings): Stratagem[] {
  const out: Stratagem[] = data.selectedDetachments.flatMap((d) => d.stratagems);
  if (s.includeOtherDetachments) out.push(...data.otherDetachments.flatMap((d) => d.stratagems));
  if (s.includeCoreStratagems) out.push(...data.coreStratagems);
  return out;
}

export const PHASE_ROWS = ['PRE_GAME', 'COMMAND', 'MOVEMENT', 'SHOOTING', 'CHARGE', 'FIGHT', 'ANY'] as const;
export type PhaseRow = (typeof PHASE_ROWS)[number];
export const PHASE_ROW_LABELS: Record<PhaseRow, string> = {
  PRE_GAME: 'Before the battle',
  COMMAND: 'Command',
  MOVEMENT: 'Movement',
  SHOOTING: 'Shooting',
  CHARGE: 'Charge',
  FIGHT: 'Fight',
  ANY: 'Any phase',
};

export type CheatItem = { name: string; source: string; kind: 'ability' | 'enhancement' | 'stratagem' | 'rule'; inferred: boolean; cp?: number };
export type CheatRow = { phase: PhaseRow; mine: CheatItem[]; theirs: CheatItem[] };

function place(rows: Map<PhaseRow, CheatRow>, tags: PhaseTags, item: CheatItem) {
  if (tags.phases.length === 0 && tags.timing !== 'PRE_GAME') return;
  const phases: PhaseRow[] = tags.timing === 'PRE_GAME' ? ['PRE_GAME'] : (tags.phases as PhaseRow[]);
  for (const p of phases) {
    const row = rows.get(p);
    if (!row) continue;
    const it = { ...item, inferred: tags.inferred && !tags.confirmed };
    if (tags.timing === 'PRE_GAME' || tags.timing === 'YOUR_TURN' || tags.timing === 'EITHER_TURN' || tags.timing === 'ANY') row.mine.push(it);
    if (tags.timing === 'OPPONENT_TURN' || tags.timing === 'EITHER_TURN' || tags.timing === 'ANY') row.theirs.push(it);
  }
}

/** Phase cheat sheet (DESIGN.md 9.2): every ability, enhancement and stratagem of this army that acts in a phase. */
export function cheatSheet(data: ExportData, s: ExportSettings): CheatRow[] {
  const rows = new Map<PhaseRow, CheatRow>(PHASE_ROWS.map((p) => [p, { phase: p, mine: [], theirs: [] }]));
  const seen = new Set<string>();
  for (const e of data.roster.entries) {
    const sheet = data.datasheets[e.datasheetKey];
    if (!sheet || seen.has(sheet.datasheet.key)) continue;
    seen.add(sheet.datasheet.key);
    for (const a of sheet.abilities) place(rows, a.tags, { name: a.name, source: sheet.datasheet.name, kind: 'ability', inferred: false });
  }
  for (const a of data.armyRuleAbilities) place(rows, a.tags, { name: a.name, source: 'Army rule', kind: 'rule', inferred: false });
  for (const d of data.selectedDetachments) {
    for (const a of d.rules) place(rows, a.tags, { name: a.name, source: d.detachment.name, kind: 'rule', inferred: false });
  }
  for (const { entry, enhancement } of takenEnhancements(data)) {
    place(rows, enhancement.tags, { name: enhancement.name, source: entry.name, kind: 'enhancement', inferred: false });
  }
  for (const st of stratagemsFor(data, s)) {
    place(rows, st.tags, {
      name: st.name,
      source: 'Stratagem',
      kind: 'stratagem',
      inferred: false,
      ...(st.cpCost !== undefined ? { cp: st.cpCost } : {}),
    });
  }
  return [...rows.values()].filter((r) => r.mine.length > 0 || r.theirs.length > 0);
}

export function takenEnhancements(data: ExportData): { entry: EntryView; enhancement: Enhancement }[] {
  const all = [...data.selectedDetachments, ...data.otherDetachments].flatMap((d) => d.enhancements);
  const out: { entry: EntryView; enhancement: Enhancement }[] = [];
  for (const e of data.roster.entries) {
    const en = all.find((x) => x.key === e.enhancementKey);
    if (en) out.push({ entry: e, enhancement: en });
  }
  return out;
}

function refsIn(text: RulesText | undefined, out: Set<string>) {
  for (const t of text?.tokens ?? []) if ((t as Token).type === 'ref') out.add((t as Extract<Token, { type: 'ref' }>).glossaryId);
}

function abilityRefs(a: Ability, out: Set<string>) {
  if (a.glossaryId) out.add(a.glossaryId);
  refsIn(a.text, out);
}

/**
 * Glossary (DESIGN.md 9.2): terms used by this army's units, abilities and included stratagems, plus
 * the terms their definitions reference (one level deep), alphabetical. Entries without text are left out.
 */
export function glossaryFor(data: ExportData, s: ExportSettings): GlossaryEntry[] {
  const ids = new Set<string>();
  for (const e of data.roster.entries) {
    const sheet = data.datasheets[e.datasheetKey];
    if (!sheet) continue;
    sheet.abilities.forEach((a) => abilityRefs(a, ids));
    sheet.weapons.forEach((w) => w.abilities.forEach((k) => k.glossaryId && ids.add(k.glossaryId)));
  }
  data.armyRuleAbilities.forEach((a) => abilityRefs(a, ids));
  data.selectedDetachments.forEach((d) => d.rules.forEach((a) => abilityRefs(a, ids)));
  takenEnhancements(data).forEach(({ enhancement }) => refsIn(enhancement.text, ids));
  for (const st of stratagemsFor(data, s)) [st.when, st.target, st.effect, st.restrictions, st.fullText].forEach((t) => refsIn(t, ids));
  const first = [...ids];
  for (const id of first) refsIn(data.glossary[id]?.text, ids);
  return [...ids]
    .map((id) => data.glossary[id])
    .filter((g): g is GlossaryEntry => !!g && !!g.text.plain.trim())
    .sort((a, b) => a.term.localeCompare(b.term));
}

/** Unit card order: roster order, optionally with each leader right before the unit it leads. */
export function unitOrder(entries: EntryView[], leadersBeforeUnit: boolean): EntryView[] {
  if (!leadersBeforeUnit) return entries;
  const attached = new Map<number, EntryView[]>();
  for (const e of entries) if (e.attachedTo !== undefined) attached.set(e.attachedTo, [...(attached.get(e.attachedTo) ?? []), e]);
  const out: EntryView[] = [];
  for (const e of entries) {
    if (e.attachedTo !== undefined && entries.some((x) => x.id === e.attachedTo)) continue;
    out.push(...(attached.get(e.id) ?? []), e);
  }
  return out;
}

/** Rough page estimate for the dialog: every section starts on a new page. */
export function estimatePages(data: ExportData, s: ExportSettings): number {
  const scale = s.textSize === 'large' ? 1.3 : 1;
  const perPage = (s.paper === 'A4' ? 62 : 58) / scale;
  let pages = 0;
  for (const sec of s.sections) {
    if (!sec.on) continue;
    let lines = 0;
    switch (sec.id) {
      case 'summary':
        lines = 18 + data.roster.entries.length;
        break;
      case 'rules':
        lines = [...data.armyRules.map((r) => r.text.plain), ...data.selectedDetachments.map((d) => d.detachment.ruleText.plain)]
          .reduce((n, t) => n + 3 + Math.ceil(t.length / 95), 0);
        break;
      case 'units':
        lines = data.roster.entries.reduce((n, e) => {
          const d = data.datasheets[e.datasheetKey];
          const text = d ? d.abilities.reduce((m, a) => m + a.text.plain.length, 0) : 0;
          return n + 10 + (d?.weapons.length ?? 0) + Math.ceil(text / 95);
        }, 0);
        break;
      case 'enhancements':
        lines = takenEnhancements(data).reduce((n, x) => n + 3 + Math.ceil(x.enhancement.text.plain.length / 95), 0);
        break;
      case 'stratagems':
        lines = stratagemsFor(data, s).reduce((n, x) => n + 5 + Math.ceil(x.fullText.plain.length / 110), 0);
        break;
      case 'cheatsheet':
        lines = cheatSheet(data, s).reduce((n, r) => n + 2 + Math.max(r.mine.length, r.theirs.length), 0);
        break;
      case 'glossary':
        lines = glossaryFor(data, s).reduce((n, g) => n + 2 + Math.ceil(g.text.plain.length / 95), 0);
        break;
    }
    pages += Math.max(1, Math.ceil((lines * scale) / perPage));
  }
  return pages;
}

export function fileName(name: string): string {
  const slug = name.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
  return `${slug || 'army-list'}.pdf`;
}
