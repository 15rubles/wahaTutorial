import type { Datasheet } from '@battle-drill/data';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultContext } from '../attack/context.js';
import { resolveAttacks } from '../attack/resolveAttacks.js';
import { createRng } from '../dice/rng.js';
import { seededRoller } from '../dice/roller.js';
import { baseRadius, unitFromDatasheet } from './fromData.js';

const load = (f: string) =>
  JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, '../../../../fixtures/normalized/datasheets', f),
      'utf8',
    ),
  ) as Datasheet[];
const rp = load('RP.json');
const gc = load('GC.json');
const ds = (list: Datasheet[], name: string) => list.find((d) => d.name === name)!;

describe('unitFromDatasheet (fixture datasheets)', () => {
  it('builds models, keywords and loadout', () => {
    const u = unitFromDatasheet(ds(rp, 'Rustbound Devotees'), {
      id: 'dev',
      player: 'p1',
      modelCount: 10,
      weapons: [
        { name: 'Nail caster', count: 8 },
        { name: 'Corroded blade', count: 10 },
      ],
    });
    expect(u.models).toHaveLength(10);
    expect(u.keywords).toEqual(expect.arrayContaining(['INFANTRY', 'BATTLELINE', 'RUST PILGRIMS']));
    expect(u.models[0]!.weapons).toEqual(['Nail caster', 'Corroded blade']);
    expect(u.models[9]!.weapons).toEqual(['Corroded blade']);
    expect(u.models[0]).toMatchObject({ toughness: 3, save: 5, wounds: 1, isCharacter: false });
  });

  it('marks characters and converts base sizes', () => {
    const w = unitFromDatasheet(ds(rp, 'Pilgrim Scrapwarden'), { id: 'w', player: 'p1' });
    expect(w.models[0]!.isCharacter).toBe(true);
    expect(baseRadius('32mm', [])).toBeCloseTo(0.63, 2);
    expect(baseRadius('Use model', ['VEHICLE'])).toBe(2);
  });

  it('fights a full fixture attack sequence deterministically', () => {
    const wardens = unitFromDatasheet(ds(gc, 'Glass Wardens'), {
      id: 'gw',
      player: 'p2',
      modelCount: 5,
    });
    const devotees = unitFromDatasheet(ds(rp, 'Rustbound Devotees'), {
      id: 'dev',
      player: 'p1',
      modelCount: 10,
    });
    const repeater = wardens.weapons.find((w) => w.name === 'Splinter repeater')!;
    const go = () =>
      resolveAttacks(
        defaultContext(wardens, devotees, 'shooting'),
        [{ weapon: repeater, count: 5 }],
        seededRoller(createRng(2026)),
      );
    const a = go();
    expect(a.events).toEqual(go().events);
    expect(a.events.at(-1)!.type).toBe('AttacksResolved');
  });
});
