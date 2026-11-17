import { describe, expect, it } from 'vitest';
import { trainingGround } from '../board/battlefield.js';
import { apply } from '../game/apply.js';
import { formation, translate } from '../game/formation.js';
import { type GameState, createGame } from '../game/state.js';
import { unit } from '../testing.js';
import type { Point, UnitState } from '../types.js';
import { legalActions } from './legalActions.js';

const place = (u: UnitState, at: Point): UnitState => {
  const ps = formation(u, at);
  return { ...u, models: u.models.map((m, i) => ({ ...m, position: ps[i]! })) };
};
const hauler = place(
  unit(
    'hauler',
    1,
    { keywords: ['VEHICLE', 'TRANSPORT'], transport: { capacity: 6, text: 'invented' } },
    { baseRadius: 1.5, wounds: 10, toughness: 9, movement: 10 },
    'p1',
  ),
  { x: 22, y: 3 },
);
const squad = (n = 5) => unit('pilgrims', n, {}, { baseRadius: 0.5 }, 'p1');
const enemy = place(unit('foe', 3, {}, { baseRadius: 0.5 }, 'p2'), { x: 22, y: 27 });

function run(state: GameState, ...actions: Parameters<typeof apply>[1][]): GameState {
  let s = state;
  for (const a of actions) {
    const r = apply(s, a);
    if (!r.ok) throw new Error(`${a.type}: ${r.error.code} ${r.error.detail ?? ''}`);
    s = r.state;
  }
  return s;
}
const code = (r: ReturnType<typeof apply>) => (r.ok ? 'ok' : r.error.code);
const endPhase = { type: 'endPhase' } as const;

/** Squad starts embarked; game moved to p1's movement phase in round 1. */
function started(n = 5): GameState {
  let s = createGame({
    seed: 2,
    battlefield: { ...trainingGround(), terrain: [] },
    units: [hauler, squad(n), enemy],
  });
  s = run(s, { type: 'embark', unitId: 'pilgrims', transportId: 'hauler' }, endPhase, endPhase);
  return s;
}

describe('transports', () => {
  it('starts a unit embarked during deployment, within capacity', () => {
    const s = started();
    expect([s.phase, s.activePlayer]).toEqual(['movement', 'p1']);
    expect(s.status['pilgrims']!.embarkedIn).toBe('hauler');
    expect(legalActions(s, 'pilgrims')).toEqual([
      { kind: 'embarked', transportId: 'hauler', canDisembark: true },
    ]);
    const tooMany = createGame({
      seed: 2,
      battlefield: trainingGround(),
      units: [hauler, squad(7)],
    });
    expect(
      code(apply(tooMany, { type: 'embark', unitId: 'pilgrims', transportId: 'hauler' })),
    ).toBe('NO_CAPACITY');
  });

  it('tactical disembark before the transport moves, then the unit may still move', () => {
    const s = started();
    const far = apply(s, {
      type: 'move',
      unitId: 'pilgrims',
      moveType: 'disembark',
      positions: formation(s.units['pilgrims']!, { x: 22, y: 12 }),
    });
    expect(code(far)).toBe('NOT_NEAR_TRANSPORT');
    const out = run(s, {
      type: 'move',
      unitId: 'pilgrims',
      moveType: 'disembark',
      positions: formation(s.units['pilgrims']!, { x: 22, y: 5.6 }),
    });
    expect(out.status['pilgrims']!.disembarked).toBe('tactical');
    expect(legalActions(out, 'pilgrims')[0]).toEqual({
      kind: 'move',
      moveTypes: ['normal', 'advance'],
    });
    const moved = run(out, {
      type: 'move',
      unitId: 'pilgrims',
      moveType: 'normal',
      positions: translate(out.units['pilgrims']!, { x: 0, y: 5 }),
    });
    expect(moved.status['pilgrims']!.moved).toBe('normal');
  });

  it('rapid disembark after the transport moved: no charge this turn', () => {
    let s = started();
    s = run(s, {
      type: 'move',
      unitId: 'hauler',
      moveType: 'normal',
      positions: translate(s.units['hauler']!, { x: 0, y: 8 }),
    });
    s = run(s, {
      type: 'move',
      unitId: 'pilgrims',
      moveType: 'disembark',
      positions: formation(s.units['pilgrims']!, { x: 22, y: 13.6 }),
    });
    expect(s.status['pilgrims']!).toMatchObject({
      disembarked: 'rapid',
      moved: 'disembark',
      cannotCharge: true,
    });
  });

  it('embarks after a move with every model within 3"', () => {
    let s = createGame({
      seed: 2,
      battlefield: { ...trainingGround(), terrain: [] },
      units: [hauler, place(squad(), { x: 22, y: 9 }), enemy],
    });
    s = run(s, endPhase, endPhase);
    expect(code(apply(s, { type: 'embark', unitId: 'pilgrims', transportId: 'hauler' }))).toBe(
      'NOT_ELIGIBLE',
    );
    s = run(s, {
      type: 'move',
      unitId: 'pilgrims',
      moveType: 'normal',
      positions: translate(s.units['pilgrims']!, { x: 0, y: -2.5 }),
    });
    s = run(s, { type: 'embark', unitId: 'pilgrims', transportId: 'hauler' });
    expect(s.units['pilgrims']!.models.every((m) => m.position === null)).toBe(true);
    // Embarked this phase: cannot disembark again.
    expect(legalActions(s, 'pilgrims')[0]).toMatchObject({ kind: 'embarked', canDisembark: false });
  });

  it('emergency disembark when the transport is destroyed', async () => {
    const { emergencyDisembark } = await import('./transports.js');
    const { scriptedRoller } = await import('../dice/roller.js');
    const { createRng } = await import('../dice/rng.js');
    let s = started();
    const wreck = {
      ...s.units['hauler']!,
      models: s.units['hauler']!.models.map((m) => ({ ...m, destroyed: true, woundsLeft: 0 })),
    };
    s = { ...s, units: { ...s.units, hauler: wreck } };
    const r = emergencyDisembark(s, 'hauler', scriptedRoller([1, 6, 6, 6, 6], createRng(1)));
    const out = r.state.units['pilgrims']!;
    expect(out.models.filter((m) => !m.destroyed)).toHaveLength(4); // one failed hazard roll
    expect(out.models.filter((m) => !m.destroyed).every((m) => m.position)).toBe(true);
    expect(r.state.status['pilgrims']).toMatchObject({
      embarkedIn: null,
      battleShocked: true,
      cannotCharge: true,
    });
    expect(r.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['HazardRolled', 'UnitDisembarked']),
    );
  });

  it('disembarkPositions packs a big unit around the hull', async () => {
    const { disembarkPositions } = await import('./transports.js');
    let s = createGame({
      seed: 2,
      battlefield: { ...trainingGround(), terrain: [] },
      units: [{ ...hauler, transport: { capacity: 12, text: 'x' } }, squad(10), enemy],
    });
    s = run(s, { type: 'embark', unitId: 'pilgrims', transportId: 'hauler' }, endPhase, endPhase);
    const positions = disembarkPositions(s, 'pilgrims', { x: 22, y: 8 });
    expect(positions).toHaveLength(10);
    expect(
      code(
        apply(s, {
          type: 'move',
          unitId: 'pilgrims',
          moveType: 'disembark',
          positions: positions!,
        }),
      ),
    ).toBe('ok');
  });
});
