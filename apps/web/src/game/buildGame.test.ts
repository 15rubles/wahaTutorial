import type { Datasheet } from '@battle-drill/data';
import { aliveModels } from '@battle-drill/engine';
import { readRoster, resolveRoster } from '@battle-drill/roster';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { armyUnits, sandboxGame } from './buildGame.js';

const root = resolve(import.meta.dirname, '../../../../fixtures');
const json = <T>(p: string) =>
  JSON.parse(readFileSync(resolve(root, 'normalized', p), 'utf8')) as T;

describe('sandbox game', () => {
  it('builds the imported army plus practice dummies, deployed, in round 1', () => {
    const datasheets = new Map(
      [...json<Datasheet[]>('datasheets/RP.json'), ...json<Datasheet[]>('datasheets/GC.json')].map(
        (d) => [d.id, d],
      ),
    );
    const lookup = {
      factions: json<never[]>('factions.json'),
      catalog: json<never[]>('catalog.json'),
      detachments: json<never[]>('detachments.json'),
      enhancements: json<never[]>('enhancements.json'),
      datasheet: (id: string) => datasheets.get(id),
    };
    const army = resolveRoster(
      readRoster('x.ros', new Uint8Array(readFileSync(resolve(root, 'rosters/rust-pilgrims.ros')))),
      lookup,
    );
    const units = armyUnits(
      army,
      (id) => datasheets.get(id),
      () => undefined,
    );
    expect(units.map((u) => u.name)).toEqual([
      'Pilgrim Scrapwarden',
      'Rustbound Devotees',
      'Cinder Lancers',
      'Furnace Walker',
      'Gutter Marksman',
    ]);
    const game = sandboxGame(units, 1);
    expect([game.phase, game.battleRound, game.activePlayer]).toEqual(['command', 1, 'p1']);
    expect(Object.values(game.units).every((u) => aliveModels(u).every((m) => m.position))).toBe(
      true,
    );
    expect(game.units['dummy']?.player).toBe('p2');
  });
});
