import { describe, expect, it } from 'vitest';
import { trainingGround } from '../board/battlefield.js';
import { apply } from '../game/apply.js';
import { formation } from '../game/formation.js';
import { type GameState, createGame } from '../game/state.js';
import { unit } from '../testing.js';
import type { Point, UnitState } from '../types.js';
import { legalActions } from './legalActions.js';

const place = (u: UnitState, at: Point): UnitState => {
  const ps = formation(u, at);
  return { ...u, models: u.models.map((m, i) => ({ ...m, position: ps[i]! })) };
};
const reserve = (abilities: string[] = []) =>
  unit('pilgrims', 3, { abilities }, { baseRadius: 0.5 }, 'p1');
const enemy = place(unit('foe', 3, {}, { baseRadius: 0.5 }, 'p2'), { x: 22, y: 27 });
const holder = place(unit('holder', 1, {}, { baseRadius: 0.5 }, 'p1'), { x: 5, y: 3 });

function run(state: GameState, ...actions: Parameters<typeof apply>[1][]): GameState {
  let s = state;
  for (const a of actions) {
    const r = apply(s, a);
    if (!r.ok) throw new Error(`${a.type}: ${r.error.code} ${r.error.detail ?? ''}`);
    s = r.state;
  }
  return s;
}
const endPhase = { type: 'endPhase' } as const;

/** Reserve unit placed in deployment, then advanced to the given round's p1 movement phase. */
function toMovement(abilities: string[], round: number): GameState {
  let s = createGame({
    seed: 3,
    battlefield: { ...trainingGround(), terrain: [] },
    units: [reserve(abilities), enemy, holder],
  });
  s = run(s, { type: 'placeInReserves', unitId: 'pilgrims' }, endPhase);
  while (!(s.battleRound === round && s.activePlayer === 'p1' && s.phase === 'movement'))
    s = run(s, endPhase);
  return s;
}
const ingressAt = (s: GameState, at: Point) =>
  apply(s, {
    type: 'move',
    unitId: 'pilgrims',
    moveType: 'ingress',
    positions: formation(s.units['pilgrims']!, at),
  });
const code = (r: ReturnType<typeof apply>) => (r.ok ? 'ok' : r.error.code);

describe('strategic reserves', () => {
  it('keeps the unit in reserves through round 1', () => {
    const s = toMovement([], 1);
    expect(s.status['pilgrims']!.inReserves).toBe(true);
    expect(code(ingressAt(s, { x: 3, y: 15 }))).toBe('NOT_ELIGIBLE');
    expect(legalActions(s, 'pilgrims')).toEqual([{ kind: 'in-reserves', canArrive: false }]);
  });

  it('arrives wholly within 6 inches of an edge from round 2', () => {
    const s = toMovement([], 2);
    expect(legalActions(s, 'pilgrims')).toEqual([{ kind: 'in-reserves', canArrive: true }]);
    expect(code(ingressAt(s, { x: 22, y: 15 }))).toBe('NOT_NEAR_EDGE');
    const r = ingressAt(s, { x: 3, y: 15 });
    expect(code(r)).toBe('ok');
    if (!r.ok) return;
    expect(r.state.status['pilgrims']!.inReserves).toBe(false);
    expect(r.events.map((e) => e.type)).toContain('UnitArrived');
  });

  it('cannot arrive in the enemy deployment zone before round 3 or within 8 inches of enemies', () => {
    const s = toMovement([], 2);
    expect(code(ingressAt(s, { x: 3, y: 27 }))).toBe('OUTSIDE_DEPLOYMENT_ZONE');
    expect(code(ingressAt(s, { x: 3, y: 15 }))).toBe('ok');
    const s3 = toMovement([], 3);
    expect(code(ingressAt(s3, { x: 14, y: 27 }))).toBe('TOO_CLOSE_TO_ENEMY');
    expect(code(ingressAt(s3, { x: 3, y: 27 }))).toBe('ok');
  });

  it('lets a Deep Strike unit arrive anywhere more than 8 inches from enemies', () => {
    const s = toMovement(['deep-strike'], 2);
    expect(code(ingressAt(s, { x: 22, y: 15 }))).toBe('ok');
    expect(code(ingressAt(s, { x: 22, y: 21 }))).toBe('TOO_CLOSE_TO_ENEMY');
  });

  it('destroys units that have not arrived by the end of battle round 3', () => {
    let s = toMovement([], 3);
    expect(s.units['pilgrims']!.models.some((m) => !m.destroyed)).toBe(true);
    while (s.battleRound === 3) s = run(s, endPhase);
    expect(s.units['pilgrims']!.models.every((m) => m.destroyed)).toBe(true);
    expect(s.status['pilgrims']!.inReserves).toBe(false);
  });

  it('destroys units still in reserves at the end of the battle', () => {
    let s = toMovement([], 1);
    while (s.phase !== 'game-over') s = run(s, endPhase);
    expect(s.units['pilgrims']!.models.every((m) => m.destroyed)).toBe(true);
  });
});
