import { describe, expect, it } from 'vitest';
import { flat } from '../dice/diceExpr.js';
import { createRng } from '../dice/rng.js';
import { scriptedRoller, seededRoller } from '../dice/roller.js';
import { model, unit, weapon } from '../testing.js';
import { allocationOrder } from './allocation.js';
import { defaultContext } from './context.js';
import type { AttackEvent, HitRolled, SaveRolled, WoundRolled } from './events.js';
import { rollHits } from './hitRoll.js';
import { capRollModifier } from './modifiers.js';
import { resolveAttacks } from './resolveAttacks.js';
import { checkSave } from './saveRoll.js';
import { rollWounds, unitToughness } from './woundRoll.js';

const rng = createRng(1);
const attacker = unit('a', 5, {}, {}, 'p1');
const ev = <T extends AttackEvent['type']>(events: readonly AttackEvent[], type: T) =>
  events.filter((e) => e.type === type) as Extract<AttackEvent, { type: T }>[];

describe('hit roll', () => {
  const target = unit('t', 5);
  it('1 always fails, 6 is critical, otherwise compare to BS', () => {
    const ctx = {
      ...defaultContext(attacker, target, 'shooting', { hitModifier: 1 }),
      weapon: weapon({ skill: 3 }),
    };
    const r = rollHits(ctx, 4, scriptedRoller([1, 6, 2, 3], rng));
    expect(r.event.rolls.map((x) => x.outcome)).toEqual(['fail', 'critical', 'hit', 'hit']);
    expect(r.event.criticals).toBe(1);
  });

  it('caps modifiers at +-1', () => {
    expect(capRollModifier(3)).toBe(1);
    expect(capRollModifier(-2)).toBe(-1);
    const ctx = {
      ...defaultContext(attacker, target, 'shooting', { hitModifier: -3 }),
      weapon: weapon({ skill: 3 }),
    };
    expect(rollHits(ctx, 1, scriptedRoller([4], rng)).event.rolls[0]!.outcome).toBe('hit'); // 4-1 = 3
  });

  it('benefit of cover worsens BS by 1', () => {
    const ctx = {
      ...defaultContext(attacker, target, 'shooting', { targetHasCover: true }),
      weapon: weapon({ skill: 3 }),
    };
    const r = rollHits(ctx, 2, scriptedRoller([3, 4], rng));
    expect(r.event.target).toBe(4);
    expect(r.event.rolls.map((x) => x.outcome)).toEqual(['fail', 'hit']);
  });
});

describe('wound roll', () => {
  it('uses the chart and the highest bodyguard toughness', () => {
    const mixed = {
      ...unit('t', 3, {}, { toughness: 3 }),
      models: [
        model('c', { toughness: 5, isCharacter: true }),
        model('b1', { toughness: 3 }),
        model('b2', { toughness: 4 }),
      ],
    };
    expect(unitToughness(mixed)).toBe(4);
    const ctx = {
      ...defaultContext(attacker, mixed, 'shooting'),
      weapon: weapon({ strength: flat(4) }),
    };
    const r = rollWounds(ctx, 3, 0, scriptedRoller([3, 4, 6], rng));
    expect(r.event.target).toBe(4);
    expect(r.event.rolls.map((x) => x.outcome)).toEqual(['fail', 'wound', 'critical']);
  });
});

describe('saves and damage', () => {
  it('checks unmodified 1, invulnerable, then armour with AP', () => {
    expect(checkSave(1, 2, 2, 0)).toBe('damage');
    expect(checkSave(4, 3, 4, -3)).toBe('saved-invuln');
    expect(checkSave(4, 3, null, -1)).toBe('saved-armour');
    expect(checkSave(4, 3, null, -2)).toBe('damage');
  });

  it('allocates to wounded models first and characters last', () => {
    const u = {
      ...unit('t', 0),
      models: [
        model('c', { isCharacter: true, wounds: 4, woundsLeft: 4 }),
        model('x', { wounds: 2, woundsLeft: 2 }),
        model('y', { wounds: 2, woundsLeft: 1 }),
        model('z', { wounds: 1, save: 3 }),
      ],
    };
    expect(allocationOrder(u).map((g) => g.key)).toEqual(['w2:sv4:inv-', 'w1:sv3:inv-', 'char:c']);
  });

  it('resolves saves from lowest to highest, damage never spills over', () => {
    const target = unit('t', 2, {}, { wounds: 2, save: 4 });
    // 2 hits (auto by torrent), wounds: 4,4 (S4 vs T4), saves: 2,3 fail. Damage 3 on a 2-wound model.
    const ctx = defaultContext(attacker, target, 'shooting');
    const r = resolveAttacks(
      ctx,
      [
        {
          weapon: weapon({ attacks: flat(2), damage: flat(3), keywords: [{ id: 'torrent' }] }),
          count: 1,
        },
      ],
      scriptedRoller([4, 4, 2, 3], rng),
    );
    const saves = ev(r.events, 'SaveRolled')[0]!;
    expect(saves.rolls.map((x) => [x.roll, x.modelId, x.outcome])).toEqual([
      [2, 't-m1', 'damage'],
      [3, 't-m2', 'damage'],
    ]);
    expect(r.target.models.every((m) => m.destroyed)).toBe(true);
    expect(ev(r.events, 'AttacksResolved')[0]).toMatchObject({
      modelsDestroyed: 2,
      woundsInflicted: 4,
    });
  });

  it('loses excess attacks once the unit is destroyed', () => {
    const target = unit('t', 1);
    const r = resolveAttacks(
      defaultContext(attacker, target, 'shooting'),
      [{ weapon: weapon({ attacks: flat(3), keywords: [{ id: 'torrent' }] }), count: 1 }],
      scriptedRoller([4, 4, 4, 1, 1, 1], rng),
    );
    expect(ev(r.events, 'SaveRolled')[0]!.rolls).toHaveLength(1);
  });

  it('rolls Feel No Pain for each wound', () => {
    const target = unit('t', 1, {}, { wounds: 3, feelNoPain: 5 });
    const r = resolveAttacks(
      defaultContext(attacker, target, 'shooting'),
      [{ weapon: weapon({ damage: flat(3), keywords: [{ id: 'torrent' }] }), count: 1 }],
      scriptedRoller([4, 1, 6, 5, 2], rng),
    );
    const dmg = ev(r.events, 'DamageInflicted')[0]!;
    expect(dmg).toMatchObject({ damage: 3, prevented: 2, woundsLeft: 2 });
  });

  it('is deterministic for a seed', () => {
    const target = unit('t', 10, {}, { wounds: 1 });
    const run = () =>
      resolveAttacks(
        defaultContext(attacker, target, 'shooting'),
        [{ weapon: weapon({ attacks: flat(3) }), count: 5 }],
        seededRoller(createRng(99)),
      ).events;
    expect(run()).toEqual(run());
  });
});

describe('event payloads', () => {
  it('report the full breakdown for the dice tray', () => {
    const target = unit('t', 5);
    const r = resolveAttacks(
      defaultContext(attacker, target, 'shooting'),
      [{ weapon: weapon({ attacks: flat(2) }), count: 1 }],
      scriptedRoller([6, 2, 5, 1], rng),
    );
    const hit = ev(r.events, 'HitRolled')[0] as HitRolled;
    const wound = ev(r.events, 'WoundRolled')[0] as WoundRolled;
    const save = ev(r.events, 'SaveRolled')[0] as SaveRolled;
    expect([hit.hits, hit.criticals, wound.wounds, save.failed]).toEqual([1, 1, 1, 1]);
    expect(r.events.map((e) => e.type)).toEqual([
      'AttackDiceGathered',
      'HitRolled',
      'WoundRolled',
      'SaveRolled',
      'DamageInflicted',
      'ModelDestroyed',
      'AttacksResolved',
    ]);
  });
});
