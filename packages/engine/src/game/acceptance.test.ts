import type { Datasheet } from '@battle-drill/data';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { actingPlayer, nextAiAction } from '../ai/scriptedAi.js';
import { trainingGround } from '../board/battlefield.js';
import { unitFromDatasheet } from '../units/fromData.js';
import type { GameAction } from './actions.js';
import { apply } from './apply.js';
import { replay, record, startHistory, undo } from './history.js';
import { type GameState, createGame } from './state.js';

const load = (f: string) =>
  JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, '../../../../fixtures/normalized/datasheets', f),
      'utf8',
    ),
  ) as Datasheet[];
const rp = load('RP.json');
const gc = load('GC.json');
const ds = (list: Datasheet[], name: string) => list.find((d) => d.name === name)!;

function armies(): GameState {
  const units = [
    unitFromDatasheet(ds(rp, 'Pilgrim Scrapwarden'), { id: 'rp-warden', player: 'p1' }),
    unitFromDatasheet(ds(rp, 'Rustbound Devotees'), {
      id: 'rp-devotees',
      player: 'p1',
      modelCount: 10,
    }),
    unitFromDatasheet(ds(rp, 'Cinder Lancers'), { id: 'rp-lancers', player: 'p1', modelCount: 3 }),
    unitFromDatasheet(ds(rp, 'Furnace Walker'), { id: 'rp-walker', player: 'p1' }),
    unitFromDatasheet(ds(gc, 'Choir Precentor'), { id: 'gc-precentor', player: 'p2' }),
    unitFromDatasheet(ds(gc, 'Glass Wardens'), { id: 'gc-wardens', player: 'p2', modelCount: 5 }),
    unitFromDatasheet(ds(gc, 'Echo Skimmers'), { id: 'gc-skimmers', player: 'p2', modelCount: 3 }),
    unitFromDatasheet(ds(gc, 'Prism Engine'), { id: 'gc-engine', player: 'p2' }),
  ];
  return createGame({ seed: 0, battlefield: trainingGround(), units });
}

/** Both sides played by the scripted AI from deployment to the end of battle round 1. */
function playRoundOne(seed: number): {
  final: GameState;
  actions: GameAction[];
  initial: GameState;
} {
  const initial = { ...armies(), rng: { seed, draws: 0 } };
  let state = initial;
  const actions: GameAction[] = [];
  for (let i = 0; i < 400; i++) {
    if (state.battleRound === 2) break;
    const player = actingPlayer(state)!;
    const action = nextAiAction(state, player)!;
    const r = apply(state, action);
    if (!r.ok) throw new Error(`step ${i}: ${action.type} ${r.error.code} ${r.error.detail}`);
    state = r.state;
    actions.push(action);
  }
  return { final: state, actions, initial };
}

describe('M6 acceptance: scripted game through battle round 1', () => {
  it('runs from deployment to the end of battle round 1', () => {
    const { final } = playRoundOne(2026);
    expect(final.battleRound).toBe(2);
    expect(final.phase).toBe('command');
    const types = new Set(final.log.map((e) => e.type));
    for (const t of [
      'UnitDeployed',
      'BattleRoundStarted',
      'CommandPointsGained',
      'UnitMoved',
      'UnitShot',
      'HitRolled',
    ])
      expect(types.has(t as never)).toBe(true);
    expect(
      final.log
        .filter((e) => e.type === 'TurnStarted')
        .map((e) => (e as { player: string }).player),
    ).toEqual(['p1', 'p2', 'p1']);
  });

  it('is deterministic: same seed, same game', () => {
    const a = playRoundOne(2026);
    const b = playRoundOne(2026);
    expect(b.actions).toEqual(a.actions);
    expect(JSON.stringify(b.final)).toBe(JSON.stringify(a.final));
    const c = playRoundOne(7);
    expect(JSON.stringify(c.final.log)).not.toBe(JSON.stringify(a.final.log));
  });

  it('replays from the action log and undoes the last action', () => {
    const { final, actions, initial } = playRoundOne(2026);
    expect(JSON.stringify(replay(initial, actions))).toBe(JSON.stringify(final));
    let h = startHistory(initial);
    for (const a of actions.slice(0, 12)) h = record(h, a).history;
    const undone = undo(h);
    expect(undone.actions).toHaveLength(11);
    expect(JSON.stringify(undone.current)).toBe(
      JSON.stringify(replay(initial, actions.slice(0, 11))),
    );
  });

  it('game state is serializable', () => {
    const { final } = playRoundOne(1);
    expect(JSON.parse(JSON.stringify(final))).toEqual(final);
  });
});
