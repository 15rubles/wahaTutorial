/** Test helpers: invented units built directly in engine shapes. */
import { flat } from './dice/diceExpr.js';
import type { ModelState, PlayerId, UnitState, Weapon, WeaponKeyword } from './types.js';

export function weapon(partial: Partial<Weapon> & { keywords?: WeaponKeyword[] } = {}): Weapon {
  return {
    name: 'Test gun',
    type: 'ranged',
    range: 24,
    attacks: flat(1),
    skill: 3,
    strength: flat(4),
    ap: 0,
    damage: flat(1),
    keywords: [],
    ...partial,
  };
}

export function model(id: string, partial: Partial<ModelState> = {}): ModelState {
  return {
    id,
    name: 'Trooper',
    toughness: 4,
    save: 4,
    invuln: null,
    wounds: 1,
    woundsLeft: partial.wounds ?? 1,
    leadership: 7,
    objectiveControl: 1,
    movement: 6,
    isCharacter: false,
    feelNoPain: null,
    weapons: [],
    baseRadius: 0.6,
    position: null,
    destroyed: false,
    ...partial,
  };
}

export function unit(
  id: string,
  count: number,
  partial: Partial<UnitState> = {},
  modelPartial: Partial<ModelState> = {},
  player: PlayerId = 'p2',
): UnitState {
  const models = Array.from({ length: count }, (_, i) => model(`${id}-m${i + 1}`, modelPartial));
  return {
    id,
    name: id,
    player,
    datasheetId: id,
    keywords: ['INFANTRY'],
    weapons: [],
    models,
    startingStrength: count,
    ...partial,
  };
}
