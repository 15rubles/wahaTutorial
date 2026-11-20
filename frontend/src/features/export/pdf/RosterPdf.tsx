import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Ability, DatasheetDetail, RulesText, Stratagem, Weapon } from '../../../api/gameTypes';
import type { EntryView } from '../../rosters/api';
import { PHASE_ROW_LABELS, cheatSheet, glossaryFor, stratagemsFor, takenEnhancements, unitOrder, type CheatItem } from '../content';
import { SECTION_LABELS } from '../settings';
import type { ExportData, ExportSettings, SectionId } from '../types';

/** Light, print-friendly version of the pastel palette (DESIGN.md 9). */
const C = {
  ink: '#1f1f1f',
  muted: '#5f5b55',
  line: '#d9d6d0',
  soft: '#f4f2ee',
  lilac: '#e6dff5',
  lilacInk: '#3b3159',
  sage: '#dde9d7',
  sageInk: '#24361f',
  peach: '#f7e3d6',
  peachInk: '#5a3825',
  butter: '#f3e3a6',
  butterInk: '#3d3210',
};

function makeStyles(large: boolean) {
  const f = large ? 1.2 : 1;
  return StyleSheet.create({
    page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontFamily: 'Atkinson', fontSize: 9.5 * f, color: C.ink },
    h1: { fontSize: 18 * f, fontWeight: 700, marginBottom: 4 },
    h2: { fontSize: 13 * f, fontWeight: 700, marginBottom: 8 },
    h3: { fontSize: 11 * f, fontWeight: 700, marginBottom: 4 },
    muted: { color: C.muted },
    num: { fontFamily: 'PlexMono' },
    band: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, marginBottom: 6 },
    row: { flexDirection: 'row' },
    kv: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: C.line },
    kvKey: { width: 130 * f, color: C.muted },
    kvVal: { flex: 1 },
    card: { borderWidth: 0.75, borderColor: C.line, borderRadius: 6, marginBottom: 10, overflow: 'hidden' },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 8 },
    cardBody: { padding: 8, gap: 5 },
    stats: { flexDirection: 'row', gap: 4 },
    stat: { width: 40 * f, borderWidth: 0.5, borderColor: C.line, borderRadius: 3, alignItems: 'center', paddingVertical: 2, backgroundColor: C.soft },
    statLabel: { fontSize: 7 * f, color: C.muted },
    table: { borderWidth: 0.5, borderColor: C.line, borderRadius: 3 },
    th: { flexDirection: 'row', backgroundColor: C.soft, paddingVertical: 2, paddingHorizontal: 4, fontSize: 8 * f, color: C.muted },
    tr: { flexDirection: 'row', paddingVertical: 2, paddingHorizontal: 4, borderTopWidth: 0.5, borderTopColor: C.line },
    chip: { fontSize: 7.5 * f, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, backgroundColor: C.lilac, color: C.lilacInk, marginRight: 3, marginBottom: 2 },
    tag: { fontSize: 7.5 * f, paddingHorizontal: 4, borderRadius: 3, backgroundColor: C.sage, color: C.sageInk },
    para: { marginBottom: 4 },
    footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontFamily: 'Atkinson', fontSize: 7.5, color: C.muted, textAlign: 'center' },
    col: { flex: 1, paddingRight: 6 },
    dot: { color: '#b08a00' },
  });
}

type S = ReturnType<typeof makeStyles>;

function Rules({ text, s }: { text: RulesText; s: S }) {
  if (!text.plain.trim()) return null;
  return (
    <View>
      {text.plain.split('\n').filter((l) => l.trim()).map((line, i) => (
        <Text key={i} style={s.para}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function phaseText(a: { tags: Ability['tags'] }): string | null {
  const t = a.tags;
  if (t.timing === 'PRE_GAME') return 'Before the battle';
  if (t.phases.length === 0) return null;
  const phases = t.phases.map((p) => (p === 'ANY' ? 'Any phase' : p.charAt(0) + p.slice(1).toLowerCase())).join(' / ');
  const timing = { YOUR_TURN: 'your turn', OPPONENT_TURN: "opponent's turn", EITHER_TURN: 'either turn', ANY: '', PRE_GAME: '' }[t.timing];
  return [phases, timing].filter(Boolean).join(' · ') + (t.inferred && !t.confirmed ? ' •' : '');
}

/**
 * One absolutely positioned line. (A flex row with a page-number render prop makes react-pdf's
 * layout fail on long sections.)
 */
function Footer({ data, s }: { data: ExportData; s: S }) {
  const date = new Date(data.dataVersion.activatedAt ?? data.dataVersion.createdAt).toISOString().slice(0, 10);
  const left = `${data.roster.name}   ·   Data version ${data.dataVersion.id} (${date})`;
  return <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${left}   ·   Page ${pageNumber} of ${totalPages}`} />;
}

function SectionPage({ title, data, settings, s, children }: { title: string; data: ExportData; settings: ExportSettings; s: S; children: React.ReactNode }) {
  return (
    <Page size={settings.paper} style={s.page} wrap>
      <Text style={s.h2}>{title}</Text>
      {children}
      <Footer data={data} s={s} />
    </Page>
  );
}

// ---- sections ---------------------------------------------------------------------------------

function Summary({ data, settings, s }: { data: ExportData; settings: ExportSettings; s: S }) {
  const r = data.roster;
  const warlord = r.entries.find((e) => e.warlord);
  const enh = takenEnhancements(data);
  const rows: [string, string][] = [
    ['Faction', data.faction.name],
    ['Battle size', data.battleSize ? `${data.battleSize.name}${data.battleSize.pointsLimit !== undefined ? ` (${data.battleSize.pointsLimit} points)` : ''}` : 'Not chosen'],
    ...(settings.includePoints ? ([['Points', `${r.totals.points}${r.totals.pointsLimit !== undefined ? ` / ${r.totals.pointsLimit}` : ''}`]] as [string, string][]) : []),
    ['Detachment points', `${r.totals.dp}${r.totals.dpBudget !== undefined ? ` / ${r.totals.dpBudget}` : ''}`],
    ['Detachments', data.selectedDetachments.map((d) => d.detachment.name).join(', ') || 'None'],
    ...data.factionOptions.map((o) => [o.name, r.factionOptions[o.key] ?? 'Not chosen'] as [string, string]),
    ['Force disposition', data.forceDisposition?.name ?? 'Not chosen'],
    ['Warlord', warlord?.name ?? 'Not chosen'],
    ['Enhancements', enh.map((x) => `${x.enhancement.name} (${x.entry.name})`).join(', ') || 'None'],
  ];
  return (
    <>
      <Text style={s.h1}>{r.name}</Text>
      <View style={{ marginBottom: 12 }}>
        {rows.map(([k, v]) => (
          <View key={k} style={s.kv}>
            <Text style={s.kvKey}>{k}</Text>
            <Text style={s.kvVal}>{v}</Text>
          </View>
        ))}
      </View>
      <Text style={s.h3}>Units</Text>
      {r.entries.map((e) => (
        <View key={e.id} style={s.kv} wrap={false}>
          <Text style={s.kvVal}>
            {e.name}
            {e.warlord ? '  (Warlord)' : ''}
            {e.sizeName && e.models > 1 ? `  ·  ${e.sizeName}` : ''}
            {e.enhancementName ? `  ·  ${e.enhancementName}` : ''}
          </Text>
          {settings.includePoints && <Text style={s.num}>{e.points}</Text>}
        </View>
      ))}
    </>
  );
}

function RulesSection({ data, s }: { data: ExportData; s: S }) {
  return (
    <>
      {data.armyRules.map((r) => (
        <View key={r.key} style={{ marginBottom: 10 }}>
          <Text style={[s.band, { backgroundColor: C.lilac, color: C.lilacInk, fontWeight: 700 }]}>{r.name}</Text>
          <Rules text={r.text} s={s} />
        </View>
      ))}
      {data.selectedDetachments.map((d) => (
        <View key={d.detachment.key} style={{ marginBottom: 10 }}>
          <Text style={[s.band, { backgroundColor: C.sage, color: C.sageInk, fontWeight: 700 }]}>
            {d.detachment.name}
            {d.detachment.ruleName ? `: ${d.detachment.ruleName}` : ''}
          </Text>
          <Rules text={d.detachment.ruleText} s={s} />
        </View>
      ))}
      {data.forceDisposition && data.forceDisposition.text.plain && (
        <View style={{ marginBottom: 10 }}>
          <Text style={[s.band, { backgroundColor: C.peach, color: C.peachInk, fontWeight: 700 }]}>{data.forceDisposition.name}</Text>
          <Rules text={data.forceDisposition.text} s={s} />
        </View>
      )}
    </>
  );
}

const STATS = [
  ['m', 'M'],
  ['t', 'T'],
  ['sv', 'SV'],
  ['w', 'W'],
  ['ld', 'LD'],
  ['oc', 'OC'],
] as const;

function WeaponRows({ weapons, s }: { weapons: Weapon[]; s: S }) {
  const cols = [3.2, 0.9, 0.7, 0.8, 0.6, 0.6, 0.6];
  return (
    <View style={s.table}>
      <View style={s.th}>
        {['Weapon', 'Range', 'A', 'BS/WS', 'S', 'AP', 'D'].map((h, i) => (
          <Text key={h} style={{ flex: cols[i] ?? 1 }}>
            {h}
          </Text>
        ))}
      </View>
      {weapons.map((w) => (
        <View key={w.key} style={s.tr} wrap={false}>
          <View style={{ flex: cols[0] ?? 1 }}>
            <Text>{w.name}</Text>
            {w.abilities.length > 0 && <Text style={[s.muted, { fontSize: 7.5 }]}>{w.abilities.map((a) => a.label).join(', ')}</Text>}
          </View>
          {[w.range, w.a, w.skill, w.s, w.ap, w.d].map((v, i) => (
            <Text key={i} style={[s.num, { flex: cols[i + 1] ?? 1 }]}>
              {v || '-'}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function UnitCard({ e, d, data, settings, s }: { e: EntryView; d: DatasheetDetail | undefined; data: ExportData; settings: ExportSettings; s: S }) {
  const tone = e.warlord ? C.butter : (e.role ?? '').toLowerCase().includes('character') ? C.lilac : (e.role ?? '').toLowerCase().includes('battleline') ? C.sage : C.peach;
  const leading = e.attachedTo !== undefined ? data.roster.entries.find((x) => x.id === e.attachedTo)?.name : undefined;
  const enh = takenEnhancements(data).find((x) => x.entry.id === e.id)?.enhancement;
  const taken = new Set(e.wargear.map((w) => w.choice.toLowerCase()));
  const size = d ? d.abilities.reduce((n, a) => n + a.text.plain.length + 80, 0) + d.weapons.length * 120 + (enh?.text.plain.length ?? 0) : 0;
  return (
    <View style={s.card} wrap={!fitsOnePage(size, settings)} minPresenceAhead={80}>
      <View style={[s.cardHead, { backgroundColor: tone }]}>
        <Text style={{ fontWeight: 700 }}>
          {e.name}
          {e.warlord ? '  WARLORD' : ''}
        </Text>
        {settings.includePoints && <Text style={s.num}>{e.points} pts</Text>}
      </View>
      <View style={s.cardBody}>
        {!d && <Text style={s.muted}>Missing data: this unit is not in the data version.</Text>}
        {d && (
          <>
            <Text style={s.muted}>
              {[e.sizeName, leading ? `Leading ${leading}` : null].filter(Boolean).join('  ·  ')}
            </Text>
            {d.datasheet.profiles.map((p) => (
              <View key={p.name} style={s.row}>
                {d.datasheet.profiles.length > 1 && <Text style={{ width: 90 }}>{p.name}</Text>}
                <View style={s.stats}>
                  {STATS.map(([k, label]) => (
                    <View key={k} style={s.stat}>
                      <Text style={s.statLabel}>{label}</Text>
                      <Text style={s.num}>{String(p[k] ?? '') || '-'}</Text>
                    </View>
                  ))}
                  {p.invuln && (
                    <View style={s.stat}>
                      <Text style={s.statLabel}>INV</Text>
                      <Text style={s.num}>{p.invuln}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
            {d.weapons.length > 0 && <WeaponRows weapons={d.weapons} s={s} />}
            {d.abilities.map((a) => (
              <View key={a.key}>
                <Text>
                  <Text style={{ fontWeight: 700 }}>{a.name}</Text>
                  {phaseText(a) ? <Text style={s.muted}>{`  [${phaseText(a)}]`}</Text> : null}
                </Text>
                <Rules text={a.text} s={s} />
              </View>
            ))}
            {d.wargear.length > 0 && (
              <View>
                <Text style={{ fontWeight: 700 }}>Wargear</Text>
                {e.wargear.length > 0 && <Text>Taken: {e.wargear.map((w) => `${w.count}x ${w.choice}`).join(', ')}</Text>}
                {!settings.hideUntakenWargear &&
                  d.wargear.map((o) => (
                    <Text key={o.key} style={s.muted}>
                      {o.description || o.choices.filter((c) => !taken.has(c.toLowerCase())).join(', ')}
                    </Text>
                  ))}
              </View>
            )}
            {enh && (
              <View>
                <Text style={{ fontWeight: 700 }}>Enhancement: {enh.name}</Text>
                <Rules text={enh.text} s={s} />
              </View>
            )}
            <View style={[s.row, { flexWrap: 'wrap', marginTop: 2 }]}>
              {[...d.datasheet.keywords, ...d.datasheet.factionKeywords].map((k) => (
                <Text key={k} style={s.chip}>
                  {k.toUpperCase()}
                </Text>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

/** Cards never split across pages, unless one is taller than a page (react-pdf cannot place those). */
function fitsOnePage(chars: number, settings: ExportSettings): boolean {
  return chars * (settings.textSize === 'large' ? 1.45 : 1) < 3600;
}

function StratagemCard({ st, s, settings }: { st: Stratagem; s: S; settings: ExportSettings }) {
  const lines: [string, RulesText][] = [
    ['WHEN', st.when],
    ['TARGET', st.target],
    ['EFFECT', st.effect],
    ['RESTRICTIONS', st.restrictions],
  ];
  const structured = lines.some(([, t]) => t.plain.trim());
  const size = structured ? lines.reduce((n, [, t]) => n + t.plain.length, 0) : st.fullText.plain.length;
  return (
    <View style={s.card} wrap={!fitsOnePage(size, settings)} minPresenceAhead={60}>
      <View style={[s.cardHead, { backgroundColor: C.soft }]}>
        <Text style={{ fontWeight: 700 }}>
          {st.name}
          {st.category ? <Text style={s.muted}>{`  ${st.category}`}</Text> : null}
        </Text>
        <Text style={[s.num, s.tag]}>{st.cpCost !== undefined ? `${st.cpCost} CP` : 'CP ?'}</Text>
      </View>
      <View style={s.cardBody}>
        {structured
          ? lines
              .filter(([, t]) => t.plain.trim())
              .map(([label, t]) => (
                <Text key={label}>
                  <Text style={{ fontWeight: 700 }}>{label}: </Text>
                  {t.plain}
                </Text>
              ))
          : <Rules text={st.fullText} s={s} />}
      </View>
    </View>
  );
}

const PHASE_ORDER = ['PRE_GAME', 'COMMAND', 'MOVEMENT', 'SHOOTING', 'CHARGE', 'FIGHT', 'ANY'];

function Stratagems({ data, settings, s }: { data: ExportData; settings: ExportSettings; s: S }) {
  const list = stratagemsFor(data, settings);
  const groups = new Map<string, Stratagem[]>();
  for (const st of list) {
    const key = st.tags.timing === 'PRE_GAME' ? 'PRE_GAME' : (st.tags.phases[0] ?? 'ANY');
    groups.set(key, [...(groups.get(key) ?? []), st]);
  }
  return (
    <>
      {list.length === 0 && <Text style={s.muted}>No stratagems in the data for this selection.</Text>}
      {PHASE_ORDER.filter((p) => groups.has(p)).map((p) => (
        <View key={p}>
          <Text style={[s.h3, { marginTop: 4 }]}>{PHASE_ROW_LABELS[p as keyof typeof PHASE_ROW_LABELS]}</Text>
          {(groups.get(p) ?? []).map((st) => (
            <StratagemCard key={st.key} st={st} s={s} settings={settings} />
          ))}
        </View>
      ))}
    </>
  );
}

function CheatItems({ items, s }: { items: CheatItem[]; s: S }) {
  if (items.length === 0) return <Text style={s.muted}>-</Text>;
  return (
    <View>
      {items.map((i, n) => (
        <Text key={n} style={{ marginBottom: 2 }}>
          {i.inferred && <Text style={s.dot}>• </Text>}
          <Text style={{ fontWeight: 700 }}>{i.name}</Text>
          <Text style={s.muted}>{`  ${i.source}${i.cp !== undefined ? `, ${i.cp} CP` : ''}`}</Text>
        </Text>
      ))}
    </View>
  );
}

function CheatSheet({ data, settings, s }: { data: ExportData; settings: ExportSettings; s: S }) {
  const rows = cheatSheet(data, settings);
  return (
    <>
      <Text style={[s.muted, { marginBottom: 6 }]}>Built from the phase tags. A dot marks tags guessed from the rules text: double-check those.</Text>
      <View style={[s.row, s.th]}>
        <Text style={{ width: 90 }}>Phase</Text>
        <Text style={s.col}>My turn</Text>
        <Text style={s.col}>Opponent&apos;s turn</Text>
      </View>
      {rows.map((r) => (
        <View key={r.phase} style={[s.row, s.tr]} wrap={false}>
          <Text style={{ width: 90, fontWeight: 700 }}>{PHASE_ROW_LABELS[r.phase]}</Text>
          <View style={s.col}>
            <CheatItems items={r.mine} s={s} />
          </View>
          <View style={s.col}>
            <CheatItems items={r.theirs} s={s} />
          </View>
        </View>
      ))}
    </>
  );
}

function Glossary({ data, settings, s }: { data: ExportData; settings: ExportSettings; s: S }) {
  const entries = glossaryFor(data, settings);
  return (
    <>
      {entries.length === 0 && <Text style={s.muted}>No glossary terms for this list.</Text>}
      {entries.flatMap((g) => [
        <Text key={`${g.key}-t`} style={{ fontWeight: 700, marginTop: 6 }} minPresenceAhead={24}>
          {g.term}
        </Text>,
        ...g.text.plain
          .split('\n')
          .filter((l) => l.trim())
          .map((line, i) => (
            <Text key={`${g.key}-${i}`} style={s.para}>
              {line}
            </Text>
          )),
      ])}
    </>
  );
}

export function RosterPdf({ data, settings }: { data: ExportData; settings: ExportSettings }) {
  const s = makeStyles(settings.textSize === 'large');
  const sections: Record<SectionId, () => React.ReactNode> = {
    summary: () => <Summary data={data} settings={settings} s={s} />,
    rules: () => <RulesSection data={data} s={s} />,
    units: () =>
      unitOrder(data.roster.entries, settings.leadersBeforeUnit).map((e) => (
        <UnitCard key={e.id} e={e} d={data.datasheets[e.datasheetKey]} data={data} settings={settings} s={s} />
      )),
    enhancements: () => (
      <>
        {takenEnhancements(data).length === 0 && <Text style={s.muted}>No enhancements taken.</Text>}
        {takenEnhancements(data).map(({ entry, enhancement }) => (
          <View key={entry.id} style={s.card} wrap={!fitsOnePage(enhancement.text.plain.length, settings)} minPresenceAhead={60}>
            <View style={[s.cardHead, { backgroundColor: C.lilac }]}>
              <Text style={{ fontWeight: 700, color: C.lilacInk }}>
                {enhancement.name}
                {enhancement.upgrade ? '  (Upgrade)' : ''}
              </Text>
              {settings.includePoints && <Text style={s.num}>{enhancement.points !== undefined ? `${enhancement.points} pts` : 'pts ?'}</Text>}
            </View>
            <View style={s.cardBody}>
              <Text style={s.muted}>Taken by {entry.name}</Text>
              <Rules text={enhancement.text} s={s} />
            </View>
          </View>
        ))}
      </>
    ),
    stratagems: () => <Stratagems data={data} settings={settings} s={s} />,
    cheatsheet: () => <CheatSheet data={data} settings={settings} s={s} />,
    glossary: () => <Glossary data={data} settings={settings} s={s} />,
  };
  return (
    <Document title={data.roster.name} author="Muster" creator="Muster">
      {settings.sections
        .filter((sec) => sec.on)
        .map((sec) => (
          <SectionPage key={sec.id} title={SECTION_LABELS[sec.id]} data={data} settings={settings} s={s}>
            {sections[sec.id]()}
          </SectionPage>
        ))}
    </Document>
  );
}
