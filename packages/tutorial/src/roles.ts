import {
  type UnitState,
  type Weapon,
  aliveModels,
  attachUnits,
  flat,
  hasDeepStrike,
  isTransport,
} from '@battle-drill/engine';
import type { Role } from './types.js';

const avg = (e: Weapon['attacks']) => e.dice * ((e.sides + 1) / 2) + e.plus;

function melee(u: UnitState): number {
  return aliveModels(u).reduce((n, m) => {
    const best = Math.max(
      0,
      ...u.weapons
        .filter((w) => w.type === 'melee' && m.weapons.includes(w.name))
        .map((w) => avg(w.attacks) * avg(w.strength) * avg(w.damage)),
    );
    return n + best;
  }, 0);
}

function shooting(u: UnitState): number {
  return aliveModels(u).reduce((n, m) => {
    const ws = u.weapons.filter((w) => w.type === 'ranged' && m.weapons.includes(w.name));
    return (
      n +
      ws.reduce(
        (s, w) =>
          s + avg(w.attacks) * avg(w.strength) * avg(w.damage) * Math.min(1, (w.range ?? 0) / 24),
        0,
      )
    );
  }, 0);
}

const isChar = (u: UnitState) => u.keywords.includes('CHARACTER');
const speed = (u: UnitState) => Math.min(...aliveModels(u).map((m) => m.movement ?? 0));
const fastKeyword = (u: UnitState) =>
  ['MOUNTED', 'FLY', 'BIKE', 'CAVALRY'].some((k) => u.keywords.includes(k));

/**
 * Picks a unit from the army for each player role. Different units are used where possible.
 * Missing roles fall back to an invented stand-in (see `standIn`).
 */
export function pickRoles(
  army: readonly UnitState[],
  roles: readonly Role[],
  /** The army with leaders attached to bodyguards (for the `leader` role). */
  attached: readonly UnitState[] = [],
): { picked: Partial<Record<Role, UnitState>>; fallbacks: Role[] } {
  const picked: Partial<Record<Role, UnitState>> = {};
  const used = new Set<string>();
  const fallbacks: Role[] = [];
  const choose = (role: Role, candidates: UnitState[], score: (u: UnitState) => number) => {
    const sorted = [...candidates].sort((a, b) => score(b) - score(a));
    const pick = sorted.find((u) => !used.has(u.id)) ?? sorted[0];
    if (pick) {
      picked[role] = pick;
      used.add(pick.id);
    } else fallbacks.push(role);
  };
  // Scarce roles first, so they are not taken by a role with more candidates.
  const order: Role[] = [
    'leader',
    'deepStriker',
    'transport',
    'passenger',
    'character',
    'fast',
    'shooter',
    'melee',
  ];
  for (const role of order.filter((r) => roles.includes(r))) {
    if (role === 'passenger')
      choose(
        role,
        army.filter((u) => u.keywords.includes('INFANTRY') && !isChar(u) && !isTransport(u)),
        // Biggest unit that fits the picked transport; units that do not fit come last.
        (u) =>
          u.models.length +
          (u.models.length <= (picked.transport?.transport?.capacity ?? 0) ? 1000 : 0),
      );
    if (role === 'transport')
      choose(role, army.filter(isTransport), (u) => u.transport?.capacity ?? 0);
    if (role === 'leader')
      choose(
        role,
        attached.filter((u) => (u.components?.length ?? 0) > 1),
        (u) => u.models.length,
      );
    if (role === 'deepStriker')
      choose(role, army.filter(hasDeepStrike), (u) => shooting(u) + melee(u));
    if (role === 'character') choose(role, army.filter(isChar), (u) => melee(u) + shooting(u));
    if (role === 'shooter')
      choose(
        role,
        army
          .filter((u) => shooting(u) > 0 && !isChar(u))
          .concat(army.filter((u) => shooting(u) > 0 && isChar(u))),
        shooting,
      );
    if (role === 'melee')
      choose(
        role,
        army
          .filter((u) => melee(u) > 0 && !isChar(u))
          .concat(army.filter((u) => melee(u) > 0 && isChar(u))),
        (u) => melee(u) - shooting(u) * 0.3,
      );
    if (role === 'fast')
      choose(
        role,
        army.filter((u) => fastKeyword(u) || speed(u) >= 10),
        speed,
      );
  }
  return { picked, fallbacks };
}

function standInModel(id: string, i: number, partial: Partial<UnitState['models'][number]>) {
  return {
    id: `${id}-m${i + 1}`,
    name: 'Stand-in',
    toughness: 4,
    save: 4,
    invuln: null,
    wounds: 1,
    leadership: 7,
    objectiveControl: 1,
    movement: 6,
    isCharacter: false,
    feelNoPain: null,
    weapons: [] as string[],
    baseRadius: 32 / 25.4 / 2,
    position: null,
    destroyed: false,
    ...partial,
    woundsLeft: partial.wounds ?? 1,
  };
}

/** Invented generic units used when the army has no unit for a role, and as enemies. */
export function standIn(role: Role, id: string): UnitState {
  if (role === 'leader') {
    const sergeant = standIn('character', `${id}-leader`);
    const brawlers = standIn('melee', `${id}-bodyguard`);
    return { ...attachUnits(brawlers, [sergeant]), id };
  }
  if (role === 'transport') {
    const hull = standIn('fast', id);
    return {
      ...hull,
      name: 'Drill Hauler (stand-in)',
      datasheetId: 'stand-in-transport',
      keywords: ['VEHICLE', 'TRANSPORT'],
      transport: { capacity: 20, text: 'Invented stand-in: carries 20 models.' },
      models: hull.models.slice(0, 1).map((m) => ({
        ...m,
        name: 'Drill Hauler',
        toughness: 9,
        save: 3,
        wounds: 10,
        woundsLeft: 10,
        movement: 10,
        baseRadius: 2,
      })),
      startingStrength: 1,
    };
  }
  if (role === 'passenger') return { ...standIn('shooter', id), datasheetId: 'stand-in-passenger' };
  if (role === 'deepStriker')
    return {
      ...standIn('shooter', id),
      name: 'Drill Drop Squad (stand-in)',
      datasheetId: 'stand-in-deepStriker',
      abilities: ['deep-strike'],
    };
  const gun: Weapon = {
    name: 'Drill carbine',
    type: 'ranged',
    range: 24,
    attacks: flat(2),
    skill: 4,
    strength: flat(4),
    ap: 0,
    damage: flat(1),
    keywords: [],
  };
  const blade: Weapon = {
    name: 'Drill blade',
    type: 'melee',
    range: null,
    attacks: flat(3),
    skill: 3,
    strength: flat(5),
    ap: -1,
    damage: flat(1),
    keywords: [],
  };
  const stave: Weapon = {
    name: 'Training stave',
    type: 'melee',
    range: null,
    attacks: flat(1),
    skill: 5,
    strength: flat(3),
    ap: 0,
    damage: flat(1),
    keywords: [],
  };
  const spec: Record<
    Exclude<Role, 'leader' | 'deepStriker' | 'transport' | 'passenger'>,
    {
      name: string;
      n: number;
      keywords: string[];
      weapons: Weapon[];
      model: Partial<UnitState['models'][number]>;
      player: 'p1' | 'p2';
    }
  > = {
    shooter: {
      name: 'Drill Squad (stand-in)',
      n: 5,
      keywords: ['INFANTRY'],
      weapons: [gun, stave],
      model: { name: 'Drill Trooper', weapons: ['Drill carbine', 'Training stave'] },
      player: 'p1',
    },
    melee: {
      name: 'Drill Brawlers (stand-in)',
      n: 5,
      keywords: ['INFANTRY'],
      weapons: [blade],
      model: { name: 'Drill Brawler', weapons: ['Drill blade'] },
      player: 'p1',
    },
    fast: {
      name: 'Drill Riders (stand-in)',
      n: 3,
      keywords: ['MOUNTED'],
      weapons: [gun, blade],
      model: {
        name: 'Drill Rider',
        movement: 12,
        wounds: 3,
        toughness: 5,
        baseRadius: 1.2,
        weapons: ['Drill carbine', 'Drill blade'],
      },
      player: 'p1',
    },
    character: {
      name: 'Drill Sergeant (stand-in)',
      n: 1,
      keywords: ['INFANTRY', 'CHARACTER'],
      weapons: [gun, blade],
      model: {
        name: 'Drill Sergeant',
        wounds: 4,
        save: 3,
        isCharacter: true,
        leadership: 6,
        weapons: ['Drill carbine', 'Drill blade'],
      },
      player: 'p1',
    },
    target: {
      name: 'Practice Dummies',
      n: 5,
      keywords: ['INFANTRY'],
      weapons: [stave],
      model: {
        name: 'Practice Dummy',
        wounds: 2,
        save: 5,
        movement: 5,
        weapons: ['Training stave'],
      },
      player: 'p2',
    },
    enemyMelee: {
      name: 'Sparring Partners',
      n: 5,
      keywords: ['INFANTRY'],
      weapons: [blade],
      model: { name: 'Sparring Partner', save: 4, weapons: ['Drill blade'] },
      player: 'p2',
    },
  };
  const s = spec[role as Exclude<Role, 'leader' | 'deepStriker' | 'transport' | 'passenger'>];
  return {
    id,
    name: s.name,
    player: s.player,
    datasheetId: `stand-in-${role}`,
    keywords: s.keywords,
    weapons: s.weapons,
    models: Array.from({ length: s.n }, (_, i) => standInModel(id, i, s.model)),
    startingStrength: s.n,
  };
}
