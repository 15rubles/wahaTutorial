import type { Ability, GlossaryEntry, PhaseTags, Stratagem } from '../../api/gameTypes';
import type { EntryView } from '../rosters/api';
import { cheatSheet, estimatePages, fileName, glossaryFor, stratagemsFor, unitOrder } from './content';
import { DEFAULT_SETTINGS, moveSection, normalize } from './settings';
import type { ExportData } from './types';

const tags = (phases: string[], timing: string, inferred = false): PhaseTags =>
  ({ phases, timing, inferred, confirmed: false }) as PhaseTags;
const text = (plain: string, refs: string[] = []) => ({
  plain,
  tokens: [{ type: 'text' as const, value: plain }, ...refs.map((r) => ({ type: 'ref' as const, glossaryId: r, label: r }))],
});
const ability = (name: string, t: PhaseTags, refs: string[] = []): Ability => ({
  key: name, owner: 'DATASHEET', ownerKey: 'x', name, text: text('t', refs), tags: t,
});
const strat = (name: string, det: string | undefined, t: PhaseTags, refs: string[] = []): Stratagem => ({
  key: name, ...(det ? { detachment: det } : {}), name, cpCost: 1, tags: t,
  when: text(''), target: text(''), effect: text('e', refs), restrictions: text(''), fullText: text('f'),
});
const entry = (id: number, name: string, extra: Partial<EntryView> = {}): EntryView => ({
  id, datasheetKey: `rp:${name}`, name, sizeKey: 's', models: 1, wargear: [], warlord: false, sortOrder: id, points: 10, pointsComplete: true, missing: false, ...extra,
});
const gloss = (key: string, plain: string, refs: string[] = []): GlossaryEntry => ({
  key, term: key.replace('g:', ''), aliases: [], kind: 'RULE_TERM', text: text(plain, refs), seeAlso: [], referencedBy: [],
});

function data(): ExportData {
  const prophet = entry(1, 'prophet', { enhancementKey: 'enh', attachedTo: 2 });
  const warband = entry(2, 'warband');
  return {
    roster: { entries: [prophet, warband] } as ExportData['roster'],
    faction: { key: 'rp', name: 'Rust Pilgrims' },
    factionOptions: [],
    armyRules: [],
    armyRuleAbilities: [ability('Faith', tags(['COMMAND'], 'YOUR_TURN'))],
    selectedDetachments: [
      {
        detachment: { key: 'det', faction: 'rp', name: 'Iron', uniqueTags: [], ruleText: text(''), forceDispositions: [], dpByKeyword: {} },
        rules: [ability('Iron Faith', tags(['SHOOTING'], 'YOUR_TURN', true))],
        enhancements: [{ key: 'enh', detachment: 'det', faction: 'rp', name: 'Relic', requiredKeywords: [], forbiddenKeywords: [], text: text('r', ['g:c']), tags: tags(['FIGHT'], 'EITHER_TURN'), upgrade: false, eligibleDatasheets: [], grantsLeaderOf: [] }],
        stratagems: [strat('Iron Will', 'det', tags(['FIGHT'], 'OPPONENT_TURN'), ['g:d'])],
      },
    ],
    otherDetachments: [
      { detachment: { key: 'o', faction: 'rp', name: 'Other', uniqueTags: [], ruleText: text(''), forceDispositions: [], dpByKeyword: {} }, rules: [], enhancements: [], stratagems: [strat('Other Strat', 'o', tags(['MOVEMENT'], 'YOUR_TURN'))] },
    ],
    coreStratagems: [strat('Reroll', undefined, tags(['ANY'], 'EITHER_TURN'))],
    datasheets: {
      'rp:prophet': { versionId: 1, datasheet: { key: 'rp:prophet', name: 'Prophet' } as never, sizes: [], weapons: [{ key: 'w', datasheet: 'rp:prophet', name: 'Maul', weaponType: 'MELEE', range: 'Melee', a: '1', skill: '2+', s: '4', ap: '0', d: '1', abilities: [{ label: 'Rend 1', glossaryId: 'g:a' }] }], abilities: [ability('Deep', tags([], 'PRE_GAME'), ['g:b'])], wargear: [], leads: [], ledBy: [] },
      'rp:warband': { versionId: 1, datasheet: { key: 'rp:warband', name: 'Warband' } as never, sizes: [], weapons: [], abilities: [ability('Passive', tags([], 'ANY'))], wargear: [], leads: [], ledBy: [] },
    },
    glossary: { 'g:a': gloss('g:a', 'A text', ['g:e']), 'g:b': gloss('g:b', 'B text'), 'g:c': gloss('g:c', 'C text'), 'g:d': gloss('g:d', 'D text'), 'g:e': gloss('g:e', 'E text', ['g:f']), 'g:f': gloss('g:f', 'F text'), 'g:empty': gloss('g:empty', '') },
    dataVersion: { id: 3, createdAt: '2026-01-01T00:00:00Z' },
  };
}

describe('export content', () => {
  it('stratagems follow the options', () => {
    expect(stratagemsFor(data(), DEFAULT_SETTINGS).map((s) => s.name)).toEqual(['Iron Will', 'Reroll']);
    expect(stratagemsFor(data(), { ...DEFAULT_SETTINGS, includeCoreStratagems: false, includeOtherDetachments: true }).map((s) => s.name)).toEqual(['Iron Will', 'Other Strat']);
  });

  it('builds the phase cheat sheet from tags, with turn columns and inferred marks', () => {
    const rows = cheatSheet(data(), DEFAULT_SETTINGS);
    const by = Object.fromEntries(rows.map((r) => [r.phase, r]));
    expect(by.PRE_GAME?.mine.map((i) => i.name)).toEqual(['Deep']);
    expect(by.COMMAND?.mine.map((i) => i.name)).toEqual(['Faith']);
    expect(by.SHOOTING?.mine[0]).toMatchObject({ name: 'Iron Faith', inferred: true });
    expect(by.FIGHT?.mine.map((i) => i.name)).toEqual(['Relic']);
    expect(by.FIGHT?.theirs.map((i) => i.name)).toEqual(['Relic', 'Iron Will']);
    expect(by.FIGHT?.mine[0]?.source).toBe('prophet');
    expect(by.ANY?.mine.map((i) => i.name)).toEqual(['Reroll']);
    expect(by.MOVEMENT).toBeUndefined();
  });

  it('glossary: used terms plus one level of references, alphabetical, no empty entries', () => {
    const terms = glossaryFor(data(), DEFAULT_SETTINGS).map((g) => g.key);
    expect(terms).toEqual(['g:a', 'g:b', 'g:c', 'g:d', 'g:e']);
    expect(terms).not.toContain('g:f');
    expect(glossaryFor(data(), { ...DEFAULT_SETTINGS, includeCoreStratagems: false }).map((g) => g.key)).toContain('g:d');
  });

  it('puts leaders before the unit they lead', () => {
    const d = data();
    expect(unitOrder(d.roster.entries, true).map((e) => e.name)).toEqual(['prophet', 'warband']);
    const swapped = [d.roster.entries[1]!, d.roster.entries[0]!];
    expect(unitOrder(swapped, true).map((e) => e.name)).toEqual(['prophet', 'warband']);
    expect(unitOrder(swapped, false).map((e) => e.name)).toEqual(['warband', 'prophet']);
  });

  it('estimates pages: one per section at least, fewer when sections are off', () => {
    const all = estimatePages(data(), DEFAULT_SETTINGS);
    expect(all).toBeGreaterThanOrEqual(7);
    const two = estimatePages(data(), { ...DEFAULT_SETTINGS, sections: DEFAULT_SETTINGS.sections.map((s) => ({ ...s, on: s.id === 'summary' || s.id === 'units' })) });
    expect(two).toBe(2);
  });

  it('settings normalize, reorder and file names', () => {
    expect(normalize({ paper: 'LETTER', sections: [{ id: 'glossary', on: false }, { id: 'nope', on: true }] }).sections[0]).toEqual({ id: 'glossary', on: false });
    expect(normalize(undefined)).toEqual(DEFAULT_SETTINGS);
    const moved = moveSection(DEFAULT_SETTINGS, 0, 2);
    expect(moved.sections.map((s) => s.id).slice(0, 3)).toEqual(['rules', 'units', 'summary']);
    expect(moveSection(DEFAULT_SETTINGS, 0, -1)).toBe(DEFAULT_SETTINGS);
    expect(fileName('Plague Host: Ölfest!')).toBe('plague-host-olfest.pdf');
  });
});
