import { describe, expect, it } from 'vitest';
import { readFixtureFiles } from './fixtures.js';
import { normalize } from './normalize.js';
import { DatasheetSchema } from './schema.js';

describe('normalize (fixture export)', () => {
  const files = readFixtureFiles();
  const data = normalize(files, { now: '2026-01-01T00:00:00.000Z' });

  it('loads both factions with no errors', () => {
    expect(data.report.errors).toEqual([]);
    expect(data.factions.map((f) => [f.id, f.datasheetCount])).toEqual([
      ['RP', 5],
      ['GC', 4],
    ]);
  });

  it('builds full datasheets', () => {
    const warden = data.datasheets.find((d) => d.name === 'Pilgrim Scrapwarden')!;
    expect(DatasheetSchema.parse(warden)).toBeTruthy();
    expect(warden.models[0]).toMatchObject({
      movement: 6,
      toughness: 4,
      save: 3,
      invuln: 5,
      wounds: 5,
      leadership: 6,
      objectiveControl: 1,
    });
    expect(warden.weapons.map((w) => [w.name, w.type, w.range])).toEqual([
      ['Rivet pistol', 'ranged', 12],
      ['Scrap maul', 'melee', null],
    ]);
    expect(warden.canLead).toEqual(['900000002']);
    expect(warden.enhancementIds).toEqual(['900000501', '900000502']);
    expect(warden.costs.find((c) => c.points !== null)?.points).toBe(60);
  });

  it('parses weapon characteristics and keywords', () => {
    const walker = data.datasheets.find((d) => d.name === 'Furnace Walker')!;
    const flamer = walker.weapons.find((w) => w.name === 'Ember flamer')!;
    expect(flamer.skill).toBeNull();
    expect(flamer.attacks).toMatchObject({ dice: 1, sides: 6 });
    expect(flamer.keywords.map((k) => k.id)).toEqual(['torrent', 'ignores-cover']);
    const beam = data.datasheets.find((d) => d.name === 'Prism Engine')!.weapons[0]!;
    expect(beam.damage).toMatchObject({ dice: 1, sides: 6, plus: 1 });
    expect(beam.ap).toBe(-3);
  });

  it('links detachments to their stratagems, enhancements and abilities', () => {
    const det = data.detachments.find((d) => d.name === 'Scrap Procession')!;
    expect(det.forceDispositions).toEqual(['Take and Hold', 'Purge the Foe']);
    expect(det.detachmentPoints).toBe(1);
    expect(det.keywordPoints).toEqual([{ keyword: 'Cinder Lancers', points: 2 }]);
    expect(det.stratagemIds).toEqual(['900000602', '900000603']);
    expect(det.enhancementIds).toEqual(['900000501', '900000502']);
    expect(data.enhancements.find((e) => e.id === '900000502')?.weapons).toHaveLength(1);
  });

  it('merges a shared ability that appears once per faction', () => {
    expect(data.abilities.find((a) => a.id === '900000104')?.factionIds).toEqual(['RP', 'GC']);
  });

  it('collects the keyword vocabulary', () => {
    const ids = data.keywords.filter((k) => k.kind === 'weapon').map((k) => k.id);
    expect(ids).toEqual(
      expect.arrayContaining(['pistol', 'lethal-hits', 'anti', 'sustained-hits', 'torrent']),
    );
  });

  it('reports broken rows instead of crashing', () => {
    const broken = {
      ...files,
      'Datasheets_models.csv':
        files['Datasheets_models.csv']! + '999|1|Ghost|6"|x|3+|-||-|6+|1|32mm||\n',
      'Datasheets_wargear.csv':
        files['Datasheets_wargear.csv']! + '900000001|9|1||Odd|blast|12"|Ranged|2|3|4|?|1|extra|\n',
    };
    delete (broken as Record<string, string | undefined>)['Source.csv'];
    const result = normalize(broken);
    const cats = [...result.report.errors, ...result.report.warnings].map((i) => i.category);
    expect(cats).toEqual(
      expect.arrayContaining(['missing-file', 'malformed-record', 'orphan-reference']),
    );
    for (const c of cats) expect(result.report.explanations[c]).toBeTruthy();
    expect(result.datasheets).toHaveLength(9);
  });
});
