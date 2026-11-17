import { describe, expect, it } from 'vitest';
import { rect } from '../board/geometry.js';
import { trainingGround } from '../board/battlefield.js';
import { createRng } from '../dice/rng.js';
import { scriptedRoller } from '../dice/roller.js';
import { flat } from '../dice/diceExpr.js';
import { model, unit, weapon } from '../testing.js';
import type { Point, UnitState } from '../types.js';
import { apply } from './apply.js';
import { formation, translate } from './formation.js';
import { type GameState, createGame } from './state.js';
import { nextFightSelector } from '../phases/fight.js';
import { atOrBelowHalfStrength } from '../phases/command.js';
import { chargePositions } from '../phases/chargeProximity.js';

const gun = weapon({ name: 'Rifle', range: 24, attacks: flat(2) });
const blade = weapon({ name: 'Blade', type: 'melee', range: null, attacks: flat(2), skill: 3 });
const squad = (id: string, player: 'p1' | 'p2', at: Point, n = 5): UnitState => {
  const u = unit(
    id,
    n,
    { weapons: [gun, blade], keywords: ['INFANTRY'] },
    { baseRadius: 0.5, movement: 6, weapons: ['Rifle', 'Blade'] },
    player,
  );
  const ps = formation(u, at);
  return { ...u, models: u.models.map((m, i) => ({ ...m, position: ps[i]! })) };
};

/** A game already in battle round 1, p1's command phase, with units placed. */
function started(units: UnitState[], seed = 1): GameState {
  const g = createGame({ seed, battlefield: { ...trainingGround(), terrain: [] }, units });
  const r = apply(g, { type: 'endPhase' });
  if (!r.ok) throw new Error(r.error.code);
  return r.state;
}

function run(state: GameState, ...actions: Parameters<typeof apply>[1][]): GameState {
  let s = state;
  for (const a of actions) {
    const r = apply(s, a);
    if (!r.ok) throw new Error(`${a.type}: ${r.error.code} ${r.error.detail}`);
    s = r.state;
  }
  return s;
}

const expectError = (state: GameState, action: Parameters<typeof apply>[1], code: string) => {
  const r = apply(state, action);
  expect(r.ok ? 'ok' : r.error.code).toBe(code);
};

describe('deployment', () => {
  it('sets up units wholly within their zone', () => {
    const g = createGame({
      seed: 1,
      battlefield: trainingGround(),
      units: [unit('a', 2, {}, { baseRadius: 0.5 }, 'p1')],
    });
    expectError(
      g,
      {
        type: 'deploy',
        unitId: 'a',
        positions: [
          { x: 5, y: 10 },
          { x: 6.2, y: 10 },
        ],
      },
      'OUTSIDE_DEPLOYMENT_ZONE',
    );
    expectError(
      g,
      {
        type: 'deploy',
        unitId: 'a',
        positions: [
          { x: 5, y: 3 },
          { x: 9, y: 3 },
        ],
      },
      'COHERENCY',
    );
    const r = apply(g, {
      type: 'deploy',
      unitId: 'a',
      positions: [
        { x: 5, y: 3 },
        { x: 6.2, y: 3 },
      ],
    });
    expect(r.ok).toBe(true);
  });
});

describe('battle round structure', () => {
  it('runs command, movement, shooting, charge, fight, then the other player, then round 2', () => {
    let s = started([squad('a', 'p1', { x: 10, y: 3 }), squad('b', 'p2', { x: 30, y: 27 })]);
    expect([s.battleRound, s.activePlayer, s.phase]).toEqual([1, 'p1', 'command']);
    expect(s.players.p1.cp).toBe(1);
    const phases: string[] = [];
    for (let i = 0; i < 20 && s.battleRound === 1; i++) {
      phases.push(
        `${s.activePlayer}:${s.phase}${s.fightStep ? `/${s.fightStep}:${s.fightSelector}` : ''}`,
      );
      s = run(s, { type: 'endPhase' });
    }
    expect(phases).toEqual([
      'p1:command',
      'p1:movement',
      'p1:shooting',
      'p1:charge',
      'p1:fight/pile-in:p1',
      'p1:fight/pile-in:p2',
      'p1:fight/fight:null',
      'p1:fight/consolidate:p1',
      'p1:fight/consolidate:p2',
      'p2:command',
      'p2:movement',
      'p2:shooting',
      'p2:charge',
      'p2:fight/pile-in:p2',
      'p2:fight/pile-in:p1',
      'p2:fight/fight:null',
      'p2:fight/consolidate:p2',
      'p2:fight/consolidate:p1',
    ]);
    expect([s.battleRound, s.activePlayer, s.phase]).toEqual([2, 'p1', 'command']);
    expect(s.players.p1.cp).toBe(3); // 1 per command phase, both players gain
  });
});

describe('movement', () => {
  const base = () =>
    run(started([squad('a', 'p1', { x: 10, y: 10 }), squad('b', 'p2', { x: 10, y: 17.5 })]), {
      type: 'endPhase',
    });

  it('normal move up to M, not through enemies, not ending engaged', () => {
    const s = base();
    const unitA = s.units['a']!;
    expectError(
      s,
      {
        type: 'move',
        unitId: 'a',
        moveType: 'normal',
        positions: translate(unitA, { x: 0, y: 6.5 }),
      },
      'TOO_FAR',
    );
    expectError(
      s,
      {
        type: 'move',
        unitId: 'a',
        moveType: 'normal',
        positions: translate(unitA, { x: 0, y: 6 }),
      },
      'ENDS_ENGAGED',
    );
    const ok = apply(s, {
      type: 'move',
      unitId: 'a',
      moveType: 'normal',
      positions: translate(unitA, { x: 6, y: 0 }),
    });
    expect(ok.ok).toBe(true);
    if (ok.ok)
      expectError(
        ok.state,
        {
          type: 'move',
          unitId: 'a',
          moveType: 'normal',
          positions: translate(ok.state.units['a']!, { x: 1, y: 0 }),
        },
        'NOT_ELIGIBLE',
      );
  });

  it('advance adds a D6 and blocks normal shooting and charging', () => {
    let s = base();
    const r = apply(s, { type: 'advanceRoll', unitId: 'a' }, scriptedRoller([4], createRng(1)));
    expect(r.ok).toBe(true);
    s = (r as { state: GameState }).state;
    s = run(s, {
      type: 'move',
      unitId: 'a',
      moveType: 'advance',
      positions: translate(s.units['a']!, { x: 10, y: 0 }),
    });
    s = run(s, { type: 'endPhase' });
    expectError(
      s,
      { type: 'shoot', unitId: 'a', shootingType: 'normal', targets: { Rifle: 'b' } },
      'NOT_ELIGIBLE',
    );
    s = run(s, { type: 'endPhase' });
    expectError(s, { type: 'declareCharge', unitId: 'a' }, 'NOT_ELIGIBLE');
  });

  it('fall back is the only real move while engaged', () => {
    let s = started([squad('a', 'p1', { x: 10, y: 10 }), squad('b', 'p2', { x: 10, y: 12.5 })]);
    s = run(s, { type: 'endPhase' });
    expectError(
      s,
      {
        type: 'move',
        unitId: 'a',
        moveType: 'normal',
        positions: translate(s.units['a']!, { x: 0, y: -3 }),
      },
      'NOT_ELIGIBLE',
    );
    s = run(s, {
      type: 'move',
      unitId: 'a',
      moveType: 'fall-back',
      positions: translate(s.units['a']!, { x: 0, y: -4 }),
    });
    s = run(s, { type: 'endPhase' });
    expectError(
      s,
      { type: 'shoot', unitId: 'a', shootingType: 'normal', targets: { Rifle: 'b' } },
      'NOT_ELIGIBLE',
    );
  });
});

describe('shooting', () => {
  it('needs range and line of sight', () => {
    const units = [squad('a', 'p1', { x: 10, y: 3 }), squad('b', 'p2', { x: 10, y: 29 })];
    let s = run(started(units), { type: 'endPhase' }, { type: 'endPhase' });
    expectError(
      s,
      { type: 'shoot', unitId: 'a', shootingType: 'normal', targets: { Rifle: 'b' } },
      'OUT_OF_RANGE',
    );
    const walled = createGame({
      seed: 1,
      battlefield: {
        ...trainingGround(),
        terrain: [{ id: 'w', name: 'Wall', polygon: rect(0, 12, 44, 2), categories: ['dense'] }],
      },
      units: [squad('a', 'p1', { x: 10, y: 8 }), squad('b', 'p2', { x: 10, y: 18 })],
    });
    s = run(walled, { type: 'endPhase' }, { type: 'endPhase' }, { type: 'endPhase' });
    expectError(
      s,
      { type: 'shoot', unitId: 'a', shootingType: 'normal', targets: { Rifle: 'b' } },
      'NOT_VISIBLE',
    );
  });

  it('resolves attacks and marks the unit as shot', () => {
    let s = run(
      started([squad('a', 'p1', { x: 10, y: 8 }), squad('b', 'p2', { x: 10, y: 18 })]),
      { type: 'endPhase' },
      { type: 'endPhase' },
    );
    const r = apply(s, {
      type: 'shoot',
      unitId: 'a',
      shootingType: 'normal',
      targets: { Rifle: 'b' },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.state;
    expect(r.events.map((e) => e.type)).toContain('HitRolled');
    expectError(
      s,
      { type: 'shoot', unitId: 'a', shootingType: 'normal', targets: { Rifle: 'b' } },
      'NOT_ELIGIBLE',
    );
    expect(s.log.length).toBeGreaterThan(r.events.length);
  });

  const mortar = weapon({
    name: 'Mortar',
    range: 36,
    attacks: flat(6),
    skill: 3,
    keywords: [{ id: 'indirect-fire' }, { id: 'one-shot' }],
  });
  const walledGame = (moveFirst: boolean) => {
    const a = squad('a', 'p1', { x: 10, y: 8 });
    const gunners = {
      ...a,
      weapons: [...a.weapons, mortar],
      models: a.models.map((m) => ({ ...m, weapons: [...m.weapons, 'Mortar'] })),
    };
    const g = createGame({
      seed: 1,
      battlefield: {
        ...trainingGround(),
        terrain: [{ id: 'w', name: 'Wall', polygon: rect(0, 12, 44, 2), categories: ['dense'] }],
      },
      units: [gunners, squad('b', 'p2', { x: 10, y: 18 })],
    });
    let s = run(g, { type: 'endPhase' }, { type: 'endPhase' });
    if (!moveFirst) s = run(s, { type: 'move', unitId: 'a', moveType: 'stationary' });
    return run(s, { type: 'endPhase' });
  };

  it('indirect fire hits unseen targets, which always get cover; 1-5 fail without a spotter', () => {
    const s = walledGame(false);
    expectError(
      s,
      { type: 'shoot', unitId: 'a', shootingType: 'normal', targets: { Mortar: 'b' } },
      'NOT_VISIBLE',
    );
    // Rifles cannot shoot blind even in indirect shooting.
    expectError(
      s,
      { type: 'shoot', unitId: 'a', shootingType: 'indirect', targets: { Rifle: 'b' } },
      'NOT_VISIBLE',
    );
    const r = apply(
      s,
      { type: 'shoot', unitId: 'a', shootingType: 'indirect', targets: { Mortar: 'b' } },
      scriptedRoller(
        [
          5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
          6, 6, 6, 6, 6, 6,
        ],
        createRng(1),
      ),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const hits = r.events.filter((e) => e.type === 'HitRolled');
    const rolls = hits.flatMap((e) => (e.type === 'HitRolled' ? e.rolls : []));
    // Fives fail; sixes hit.
    expect(rolls.filter((x) => x.roll === 5).every((x) => x.outcome === 'fail')).toBe(true);
    expect(rolls.filter((x) => x.roll === 6).every((x) => x.outcome === 'critical')).toBe(true);
  });

  it('one-shot weapons fire once per battle', () => {
    const s = walledGame(false);
    const r = apply(s, {
      type: 'shoot',
      unitId: 'a',
      shootingType: 'indirect',
      targets: { Mortar: 'b' },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.units['a']!.spentWeapons).toEqual(['Mortar']);
    const again = {
      ...r.state,
      status: { ...r.state.status, a: { ...r.state.status['a']!, shot: false } },
    };
    expectError(
      again,
      { type: 'shoot', unitId: 'a', shootingType: 'indirect', targets: { Mortar: 'b' } },
      'WEAPON_NOT_ALLOWED',
    );
  });
});

describe('charge and fight', () => {
  function toCharge(seedRolls: number[]) {
    let s = run(
      started([squad('a', 'p1', { x: 10, y: 10 }), squad('b', 'p2', { x: 10, y: 16 })]),
      { type: 'endPhase' },
      { type: 'endPhase' },
      { type: 'endPhase' },
    );
    const r = apply(
      s,
      { type: 'declareCharge', unitId: 'a' },
      scriptedRoller(seedRolls, createRng(5)),
    );
    if (!r.ok) throw new Error(r.error.code);
    s = r.state;
    return s;
  }

  it('declares within 12" and must end engaged with every target', () => {
    const s = toCharge([3, 3]);
    expect(s.status['a']!.chargeRoll).toBe(6);
    expectError(
      s,
      {
        type: 'chargeMove',
        unitId: 'a',
        targetIds: ['b'],
        positions: translate(s.units['a']!, { x: 0, y: 1 }),
      },
      'NOT_ALL_TARGETS_ENGAGED',
    );
    expectError(
      s,
      {
        type: 'chargeMove',
        unitId: 'a',
        targetIds: ['b'],
        positions: translate(s.units['a']!, { x: 0, y: 6.5 }),
      },
      'TOO_FAR',
    );
    // Engaged at 2", but every model could have ended within 1" (RQ-4).
    expectError(
      s,
      {
        type: 'chargeMove',
        unitId: 'a',
        targetIds: ['b'],
        positions: translate(s.units['a']!, { x: 0, y: 3 }),
      },
      'MUST_END_WITHIN_1',
    );
    const ok = apply(s, {
      type: 'chargeMove',
      unitId: 'a',
      targetIds: ['b'],
      positions: translate(s.units['a']!, { x: 0, y: 4.2 }),
    });
    expect(ok.ok).toBe(true);
  });

  it('chargePositions packs models in so the move passes the 1" check', () => {
    const s = toCharge([3, 3]);
    const positions = chargePositions(s, s.units['a']!, [s.units['b']!], 6);
    expect(positions).not.toBeNull();
    expect(
      apply(s, { type: 'chargeMove', unitId: 'a', targetIds: ['b'], positions: positions! }).ok,
    ).toBe(true);
  });

  it('a short roll means no possible charge targets', () => {
    const s = toCharge([1, 1]);
    expectError(
      s,
      {
        type: 'chargeMove',
        unitId: 'a',
        targetIds: ['b'],
        positions: translate(s.units['a']!, { x: 0, y: 2 }),
      },
      'OUT_OF_RANGE',
    );
    expect(apply(s, { type: 'skipCharge', unitId: 'a' }).ok).toBe(true);
  });

  it('charging units fight first, then players alternate', () => {
    let s = toCharge([3, 3]);
    s = run(
      s,
      {
        type: 'chargeMove',
        unitId: 'a',
        targetIds: ['b'],
        positions: translate(s.units['a']!, { x: 0, y: 4.2 }),
      },
      { type: 'endPhase' },
    );
    expect([s.phase, s.fightStep, s.fightSelector]).toEqual(['fight', 'pile-in', 'p1']);
    s = run(s, { type: 'endPhase' }, { type: 'endPhase' });
    expect(s.fightStep).toBe('fight');
    expect(s.fightSelector).toBe('p1');
    expectError(s, { type: 'fight', unitId: 'b', targetId: 'a' }, 'NOT_ACTIVE_PLAYER');
    s = run(s, { type: 'fight', unitId: 'a', targetId: 'b' });
    expect(s.status['a']!.fought).toBe(true);
    if (Object.values(s.units['b']!.models).some((m) => !m.destroyed)) {
      expect(s.fightSelector).toBe('p2');
      s = run(s, { type: 'fight', unitId: 'b', targetId: 'a' });
    }
    expect(nextFightSelector(s, 'p2')).toBeNull();
  });
});

describe('command phase', () => {
  it('battle-shock rolls for units at or below half strength', () => {
    const hurt = squad('a', 'p1', { x: 10, y: 3 }, 4);
    const half = {
      ...hurt,
      models: hurt.models.map((m, i) => (i < 2 ? { ...m, destroyed: true } : m)),
    };
    expect(atOrBelowHalfStrength(half)).toBe(true);
    const g = createGame({
      seed: 3,
      battlefield: trainingGround(),
      units: [half, squad('b', 'p2', { x: 30, y: 27 })],
    });
    const r = apply(g, { type: 'endPhase' }, scriptedRoller([1, 2], createRng(1)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events.find((e) => e.type === 'BattleShockRolled')).toMatchObject({
      unitId: 'a',
      rolls: [1, 2],
      passed: false,
    });
    expect(r.state.status['a']!.battleShocked).toBe(true);
  });

  it('keeps single model units honest: half wounds counts as half strength', () => {
    const lone = { ...unit('c', 1, {}, { wounds: 6, woundsLeft: 3 }) };
    expect(atOrBelowHalfStrength(lone)).toBe(true);
    expect(
      atOrBelowHalfStrength({ ...lone, models: [model('x', { wounds: 6, woundsLeft: 4 })] }),
    ).toBe(false);
  });
});

describe('stratagems', () => {
  it('spend CP once per phase per stratagem and per target unit', () => {
    let s = started([squad('a', 'p1', { x: 10, y: 3 }), squad('b', 'p2', { x: 30, y: 27 })]);
    expect(s.players.p1.cp).toBe(1);
    expectError(
      s,
      { type: 'useStratagem', player: 'p1', stratagemId: 'x', cost: 2 },
      'NOT_ENOUGH_CP',
    );
    s = run(s, {
      type: 'useStratagem',
      player: 'p1',
      stratagemId: 'x',
      cost: 1,
      targetUnitId: 'a',
    });
    expect(s.players.p1.cp).toBe(0);
    expectError(
      s,
      { type: 'useStratagem', player: 'p1', stratagemId: 'x', cost: 0 },
      'STRATAGEM_USED',
    );
    expectError(
      s,
      { type: 'useStratagem', player: 'p1', stratagemId: 'y', cost: 0, targetUnitId: 'a' },
      'STRATAGEM_USED',
    );
    s = run(s, { type: 'endPhase' });
    expect(s.stratagemsThisPhase).toEqual([]);
    s = run(s, { type: 'useStratagem', player: 'p1', stratagemId: 'x', cost: 0 });
    expect(s.log.at(-1)).toMatchObject({ type: 'StratagemUsed', stratagemId: 'x', cpLeft: 0 });
  });
});

describe('legalActions', () => {
  it('lists what a unit can do in each phase', async () => {
    const { legalActions } = await import('../phases/legalActions.js');
    let s = started([squad('a', 'p1', { x: 10, y: 10 }), squad('b', 'p2', { x: 10, y: 16 })]);
    expect(legalActions(s, 'a')).toEqual([{ kind: 'none', reason: 'nothing-this-phase' }]);
    s = run(s, { type: 'endPhase' });
    expect(legalActions(s, 'a')).toEqual([
      { kind: 'move', moveTypes: ['stationary', 'normal', 'advance'] },
    ]);
    expect(legalActions(s, 'b')).toEqual([{ kind: 'none', reason: 'not-your-turn' }]);
    s = run(s, { type: 'move', unitId: 'a', moveType: 'stationary' });
    expect(legalActions(s, 'a')).toEqual([{ kind: 'none', reason: 'already-acted' }]);
    s = run(s, { type: 'endPhase' });
    expect(legalActions(s, 'a')).toEqual([{ kind: 'shoot', shootingTypes: ['normal'] }]);
    s = run(s, { type: 'endPhase' });
    expect(legalActions(s, 'a')).toEqual([{ kind: 'declare-charge' }]);
  });
});
