import { describe, expect, it } from 'vitest';
import { readRoster } from './importRoster.js';
import { assignDatasheet, dropUnresolved, factionsToLoad, resolveRoster } from './resolve.js';
import { fixtureLookup, rosterFile } from './testing.js';
import type { ResolvedArmy } from './types.js';

const lookup = fixtureLookup();
const load = (name: string): ResolvedArmy =>
  resolveRoster(readRoster(name, rosterFile(name)), lookup);

function expectFullRustPilgrims(army: ResolvedArmy) {
  expect(army.unresolved).toEqual([]);
  expect(army.factionId).toBe('RP');
  expect(army.detachmentIds).toEqual(['900000801']);
  expect(army.battleSize).toBe('incursion');
  expect(army.units.map((u) => u.datasheetName)).toEqual([
    'Pilgrim Scrapwarden',
    'Rustbound Devotees',
    'Cinder Lancers',
    'Furnace Walker',
    'Gutter Marksman',
  ]);
  const warden = army.units[0]!;
  expect(warden.isWarlord).toBe(true);
  expect(warden.enhancementIds).toEqual(['900000501']);
  expect(warden.weapons.map((w) => w.name).sort()).toEqual(['Rivet pistol', 'Scrap maul']);
  const devotees = army.units[1]!;
  expect(devotees.modelCount).toBe(10);
  expect(devotees.weapons).toEqual(
    expect.arrayContaining([
      { name: 'Nail caster', count: 8 },
      { name: 'Corroded blade', count: 10 },
    ]),
  );
  const walker = army.units[3]!;
  expect(walker.modelCount).toBe(1);
  expect(walker.weapons.map((w) => w.name).sort()).toEqual([
    'Crushing claws',
    'Melta spigot',
    'Slag cannon',
  ]);
}

describe('roster import (fixture rosters)', () => {
  it('.ros resolves fully', () => {
    const army = load('rust-pilgrims.ros');
    expectFullRustPilgrims(army);
    expect(army.format).toBe('ros');
    expect(army.points).toBe(455);
    expect(army.units.find((u) => u.rosterName === 'Gutter Marksmen')?.match.method).toBe('fuzzy');
    // No wargear listed: every datasheet weapon is assumed.
    expect(army.units[4]!.wargearDefaulted).toBe(true);
  });

  it('.rosz resolves the same army', () => {
    const army = load('rust-pilgrims.rosz');
    expect(army.format).toBe('rosz');
    expectFullRustPilgrims(army);
  });

  it('official app text export resolves fully', () => {
    const army = load('rust-pilgrims-app.txt');
    expect(army.format).toBe('text');
    expect(army.name).toBe('Rust Pilgrims Test List');
    expectFullRustPilgrims(army);
    expect(army.units[2]!.match.method).toBe('normalized'); // "Cinder Lancer's"
  });

  it('New Recruit text export resolves fully', () => {
    const army = load('rust-pilgrims-newrecruit.txt');
    expectFullRustPilgrims(army);
    expect(army.points).toBe(415); // sum of unit lines, the total header is not a unit line
  });

  it('a second faction resolves with its own detachment', () => {
    const army = load('glass-choir.ros');
    expect(army.unresolved).toEqual([]);
    expect(army.factionId).toBe('GC');
    expect(army.detachmentIds).toEqual(['900000802']);
    expect(army.units.find((u) => u.datasheetName === 'Echo Skimmers')?.modelCount).toBe(3);
  });

  it('broken rosters never throw: unknown units become fix-me entries', () => {
    const army = load('broken.txt');
    expect(army.units.map((u) => u.datasheetName)).toEqual([
      'Pilgrim Scrapwarden',
      'Rustbound Devotees',
    ]);
    expect(army.unresolved).toHaveLength(1);
    expect(army.unresolved[0]!.draft.name).toBe('Totally Unknown Battle Robot');
    expect(army.warnings.join('\n')).toContain('Crown of Nothing');

    const fixed = assignDatasheet(army, army.unresolved[0]!.key, '900000004', lookup);
    expect(fixed.unresolved).toEqual([]);
    expect(fixed.units.map((u) => u.datasheetName)).toEqual([
      'Pilgrim Scrapwarden',
      'Furnace Walker',
      'Rustbound Devotees',
    ]);
    expect(fixed.units[1]!.match.method).toBe('manual');
    expect(dropUnresolved(army, army.unresolved[0]!.key).unresolved).toEqual([]);
  });

  it('garbage in, empty army out', () => {
    for (const [name, content] of [
      ['x.ros', '<roster><broken'],
      ['x.rosz', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])],
      ['x.txt', ''],
      ['x.txt', '\u0000\u0001 binary junk'],
      ['x.ros', '<?xml version="1.0"?><notaroster/>'],
    ] as const) {
      const army = resolveRoster(readRoster(name, content), lookup);
      expect(army.units).toEqual([]);
      expect(army.warnings.length).toBeGreaterThan(0);
    }
  });

  it('tells the browser which faction files to load', () => {
    const draft = readRoster('glass-choir.ros', rosterFile('glass-choir.ros'));
    expect(factionsToLoad(draft, lookup)).toEqual(['GC']);
  });
});
