import { describe, expect, it } from 'vitest';
import { defaultContext } from '../attack/context.js';
import type { AttackEvent } from '../attack/events.js';
import { resolveAttacks } from '../attack/resolveAttacks.js';
import { flat } from '../dice/diceExpr.js';
import { createRng } from '../dice/rng.js';
import { scriptedRoller } from '../dice/roller.js';
import { model, unit, weapon } from '../testing.js';
import type { UnitState, WeaponKeyword } from '../types.js';
import { implementedKeywords, unimplementedKeywords, weaponHasFlag } from './registry.js';

const rng = createRng(3);
const attacker = unit('a', 1, {}, {}, 'p1');
const run = (kw: WeaponKeyword[], target: UnitState, dice: number[], ctx = {}, w = {}) =>
  resolveAttacks(
    defaultContext(attacker, target, 'shooting', ctx),
    [{ weapon: weapon({ keywords: kw, ...w }), count: 1 }],
    scriptedRoller(dice, rng),
  );
const first = <T extends AttackEvent['type']>(events: readonly AttackEvent[], type: T) =>
  events.find((e) => e.type === type) as Extract<AttackEvent, { type: T }>;

/** One test per implemented keyword. The coverage test below fails if a keyword is missing here. */
const CASES: Record<string, () => void> = {
  anti() {
    const vehicle = unit('t', 1, { keywords: ['VEHICLE'] }, { toughness: 10 });
    const r = run([{ id: 'anti', target: 'vehicle', param: '4+' }], vehicle, [3, 4, 6]);
    expect(first(r.events, 'WoundRolled').rolls[0]!.outcome).toBe('critical');
    const infantry = unit('t', 1, {}, { toughness: 10 });
    expect(
      first(
        run([{ id: 'anti', target: 'vehicle', param: '4+' }], infantry, [3, 4]).events,
        'WoundRolled',
      ).rolls[0]!.outcome,
    ).toBe('fail');
  },
  blast() {
    const r = run([{ id: 'blast' }], unit('t', 11), [1, 1, 1]);
    expect(first(r.events, 'AttackDiceGathered')).toMatchObject({ base: 1, total: 3 });
    expect(
      first(
        run([{ id: 'blast', param: '2' }], unit('t', 5), [1, 1, 1]).events,
        'AttackDiceGathered',
      ).total,
    ).toBe(3);
  },
  cleave() {
    expect(
      first(
        run([{ id: 'cleave', param: '1' }], unit('t', 10), [1, 1, 1]).events,
        'AttackDiceGathered',
      ).total,
    ).toBe(3);
    expect(
      first(
        run([{ id: 'cleave', param: '1' }], unit('t', 10), [1], { singleTarget: false }).events,
        'AttackDiceGathered',
      ).total,
    ).toBe(1);
  },
  'rapid-fire'() {
    expect(
      first(
        run([{ id: 'rapid-fire', param: '1' }], unit('t', 5), [1, 1], { withinHalfRange: true })
          .events,
        'AttackDiceGathered',
      ).total,
    ).toBe(2);
    expect(
      first(run([{ id: 'rapid-fire', param: '1' }], unit('t', 5), [1]).events, 'AttackDiceGathered')
        .total,
    ).toBe(1);
  },
  torrent() {
    const r = run([{ id: 'torrent' }], unit('t', 5), [1, 1]);
    expect(first(r.events, 'HitRolled').rolls[0]).toEqual({ roll: null, outcome: 'auto' });
    expect(first(r.events, 'HitRolled').criticals).toBe(0);
  },
  heavy() {
    expect(
      first(
        run([{ id: 'heavy' }], unit('t', 5), [2, 1], { attackerBraced: true }).events,
        'HitRolled',
      ).rolls[0]!.outcome,
    ).toBe('hit');
    expect(
      first(run([{ id: 'heavy' }], unit('t', 5), [2]).events, 'HitRolled').rolls[0]!.outcome,
    ).toBe('fail');
  },
  'ignores-cover'() {
    expect(
      first(
        run([{ id: 'ignores-cover' }], unit('t', 5), [3, 1], { targetHasCover: true }).events,
        'HitRolled',
      ).target,
    ).toBe(3);
    expect(
      first(run([], unit('t', 5), [3], { targetHasCover: true }).events, 'HitRolled').target,
    ).toBe(4);
  },
  psychic() {
    expect(
      first(
        run([{ id: 'psychic' }], unit('t', 5), [3, 1], { targetHasCover: true, hitModifier: -1 })
          .events,
        'HitRolled',
      ).rolls[0]!.outcome,
    ).toBe('hit');
  },
  'sustained-hits'() {
    const r = run([{ id: 'sustained-hits', param: '2' }], unit('t', 5), [6, 1, 1, 1]);
    expect(first(r.events, 'HitRolled')).toMatchObject({ hits: 3, criticals: 1, extraHits: 2 });
  },
  'lethal-hits'() {
    const r = run([{ id: 'lethal-hits' }], unit('t', 5, {}, { toughness: 12 }), [6, 1]);
    expect(first(r.events, 'HitRolled').autoWounds).toBe(1);
    expect(first(r.events, 'WoundRolled').rolls[0]).toEqual({ roll: null, outcome: 'auto' });
  },
  lance() {
    expect(
      first(
        run([{ id: 'lance' }], unit('t', 1), [3, 3, 1], { attackerCharged: true }).events,
        'WoundRolled',
      ).modifier,
    ).toBe(1);
    expect(
      first(run([{ id: 'lance' }], unit('t', 1), [3, 3, 1]).events, 'WoundRolled').modifier,
    ).toBe(0);
  },
  'twin-linked'() {
    const r = run([{ id: 'twin-linked' }], unit('t', 1), [3, 2, 5, 1]);
    expect(first(r.events, 'WoundRolled').rolls[0]).toEqual({
      roll: 5,
      rerolledFrom: 2,
      outcome: 'wound',
    });
  },
  'devastating-wounds'() {
    const target = unit('t', 2, {}, { wounds: 2, save: 2, invuln: 2 });
    const r = run([{ id: 'devastating-wounds' }], target, [3, 6], {}, { damage: flat(3) });
    expect(first(r.events, 'WoundRolled').devastating).toBe(1);
    expect(r.events.some((e) => e.type === 'SaveRolled')).toBe(false);
    // 3 mortal wounds can only damage one model: one model destroyed, the rest is lost.
    expect(r.target.models.filter((m) => m.destroyed)).toHaveLength(1);
    expect(r.target.models[1]!.woundsLeft).toBe(2);
  },
  melta() {
    const target = unit('t', 1, {}, { wounds: 10 });
    const r = run(
      [{ id: 'melta', param: '2' }],
      target,
      [3, 4, 1],
      { withinHalfRange: true },
      { damage: flat(1) },
    );
    expect(first(r.events, 'DamageInflicted').damage).toBe(3);
  },
  hazardous() {
    const r = run([{ id: 'hazardous' }], unit('t', 1), [1, 1]);
    expect(first(r.events, 'HazardRolled')).toMatchObject({
      rolls: [1],
      failed: 1,
      mortalWounds: 1,
    });
    const tank = {
      ...attacker,
      keywords: ['VEHICLE'],
      models: [model('v', { wounds: 10, woundsLeft: 10 })],
    };
    const r2 = resolveAttacks(
      defaultContext(tank, unit('t', 1), 'shooting'),
      [{ weapon: weapon({ keywords: [{ id: 'hazardous' }] }), count: 1 }],
      scriptedRoller([1, 2], rng),
    );
    expect(first(r2.events, 'HazardRolled').mortalWounds).toBe(3);
    expect(r2.attacker.models[0]!.woundsLeft).toBe(7);
  },
  precision() {
    const target = {
      ...unit('t', 0),
      models: [
        model('char', { isCharacter: true, wounds: 3, woundsLeft: 3 }),
        model('b1'),
        model('b2'),
      ],
    };
    const r = run([{ id: 'precision' }], target, [3, 4, 1], { visibleCharacterIds: ['char'] });
    expect(first(r.events, 'SaveRolled').rolls[0]!.modelId).toBe('char');
    const r2 = run([], target, [3, 4, 1], { visibleCharacterIds: ['char'] });
    expect(first(r2.events, 'SaveRolled').rolls[0]!.modelId).toBe('b1');
  },
  assault: () =>
    expect(weaponHasFlag(weapon({ keywords: [{ id: 'assault' }] }), 'assault')).toBe(true),
  'close-quarters': () =>
    expect(weaponHasFlag(weapon({ keywords: [{ id: 'close-quarters' }] }), 'close-quarters')).toBe(
      true,
    ),
  pistol: () =>
    expect(weaponHasFlag(weapon({ keywords: [{ id: 'pistol' }] }), 'close-quarters')).toBe(true),
  'indirect-fire': () =>
    expect(weaponHasFlag(weapon({ keywords: [{ id: 'indirect-fire' }] }), 'indirect')).toBe(true),
  'one-shot': () =>
    expect(weaponHasFlag(weapon({ keywords: [{ id: 'one-shot' }] }), 'one-shot')).toBe(true),
  'extra-attacks': () =>
    expect(weaponHasFlag(weapon({ keywords: [{ id: 'extra-attacks' }] }), 'extra-attacks')).toBe(
      true,
    ),
};

describe('weapon keywords', () => {
  for (const [id, fn] of Object.entries(CASES)) it(id, fn);

  it('every implemented keyword has a test', () => {
    expect(implementedKeywords.filter((k) => !(k in CASES))).toEqual([]);
  });

  it('conditional keywords skip excluded targets', () => {
    const kw = [{ id: 'sustained-hits', param: '1', condition: 'non-MONSTER/VEHICLE' }];
    expect(first(run(kw, unit('t', 1), [6, 1, 1]).events, 'HitRolled').extraHits).toBe(1);
    expect(
      first(run(kw, unit('t', 1, { keywords: ['VEHICLE'] }), [6, 1]).events, 'HitRolled').extraHits,
    ).toBe(0);
  });

  it('lists keywords it does not simulate', () => {
    expect(
      unimplementedKeywords(weapon({ keywords: [{ id: 'conversion' }, { id: 'blast' }] })),
    ).toEqual([{ id: 'conversion' }]);
  });
});
