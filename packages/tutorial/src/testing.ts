import type { Datasheet } from '@battle-drill/data';
import { type UnitState, attachUnits, unitFromDatasheet } from '@battle-drill/engine';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const load = (f: string) =>
  JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, '../../../fixtures/normalized/datasheets', f),
      'utf8',
    ),
  ) as Datasheet[];

const abilities = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../../fixtures/normalized/abilities.json'), 'utf8'),
) as { id: string; name: string }[];

/** The invented Rust Pilgrims as engine units. */
export function fixtureArmy(): UnitState[] {
  return load('RP.json').map((ds, i) =>
    unitFromDatasheet(ds, {
      id: `u${i + 1}`,
      player: 'p1',
      modelCount: ds.name === 'Rustbound Devotees' ? 10 : ds.name === 'Cinder Lancers' ? 3 : 1,
      abilityName: (id) => abilities.find((a) => a.id === id)?.name,
    }),
  );
}

/** The fixture army with the Scrapwarden leading the Devotees. */
export function fixtureAttachedArmy(): UnitState[] {
  const army = fixtureArmy();
  const warden = army.find((u) => u.name === 'Pilgrim Scrapwarden')!;
  const devotees = army.find((u) => u.name === 'Rustbound Devotees')!;
  return [attachUnits(devotees, [warden]), ...army.filter((u) => u !== warden && u !== devotees)];
}
