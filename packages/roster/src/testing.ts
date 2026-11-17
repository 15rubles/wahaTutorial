import type { CatalogEntry, Datasheet, Detachment, Enhancement, Faction } from '@battle-drill/data';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RosterLookup } from './resolve.js';

export const FIXTURES = resolve(import.meta.dirname, '../../../fixtures');

const read = <T>(p: string): T =>
  JSON.parse(readFileSync(resolve(FIXTURES, 'normalized', p), 'utf8')) as T;

/** Lookup over the invented fixture data (fixtures/normalized). */
export function fixtureLookup(): RosterLookup {
  const datasheets = [
    ...read<Datasheet[]>('datasheets/RP.json'),
    ...read<Datasheet[]>('datasheets/GC.json'),
  ];
  const byId = new Map(datasheets.map((d) => [d.id, d]));
  return {
    factions: read<Faction[]>('factions.json'),
    catalog: read<CatalogEntry[]>('catalog.json'),
    detachments: read<Detachment[]>('detachments.json'),
    enhancements: read<Enhancement[]>('enhancements.json'),
    datasheet: (id) => byId.get(id),
  };
}

export function rosterFile(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(FIXTURES, 'rosters', name)));
}
