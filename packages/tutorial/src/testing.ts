import type { Datasheet } from '@battle-drill/data';
import { type UnitState, unitFromDatasheet } from '@battle-drill/engine';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const load = (f: string) =>
  JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, '../../../fixtures/normalized/datasheets', f),
      'utf8',
    ),
  ) as Datasheet[];

/** The invented Rust Pilgrims as engine units. */
export function fixtureArmy(): UnitState[] {
  return load('RP.json').map((ds, i) =>
    unitFromDatasheet(ds, {
      id: `u${i + 1}`,
      player: 'p1',
      modelCount: ds.name === 'Rustbound Devotees' ? 10 : ds.name === 'Cinder Lancers' ? 3 : 1,
    }),
  );
}
