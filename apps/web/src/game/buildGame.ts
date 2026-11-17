import type { Datasheet } from '@battle-drill/data';
import {
  type GameState,
  type UnitState,
  actingPlayer,
  apply,
  createGame,
  flat,
  nextAiAction,
  trainingGround,
  unitFromDatasheet,
} from '@battle-drill/engine';
import type { ResolvedArmy } from '@battle-drill/roster';

/** An invented practice target, so the sandbox needs only the player's own army. */
export function practiceDummies(id = 'dummy'): UnitState {
  const models = Array.from({ length: 5 }, (_, i) => ({
    id: `${id}-m${i + 1}`,
    name: 'Practice Dummy',
    toughness: 4,
    save: 5,
    invuln: null,
    wounds: 2,
    woundsLeft: 2,
    leadership: 7,
    objectiveControl: 1,
    movement: 5,
    isCharacter: false,
    feelNoPain: null,
    weapons: ['Training stave'],
    baseRadius: 32 / 25.4 / 2,
    position: null,
    destroyed: false,
  }));
  return {
    id,
    name: 'Practice Dummies',
    player: 'p2',
    datasheetId: 'practice-dummies',
    keywords: ['INFANTRY'],
    weapons: [
      {
        name: 'Training stave',
        type: 'melee',
        range: null,
        attacks: flat(1),
        skill: 5,
        strength: flat(3),
        ap: 0,
        damage: flat(1),
        keywords: [],
      },
    ],
    models,
    startingStrength: 5,
  };
}

export function armyUnits(
  army: ResolvedArmy,
  datasheet: (id: string) => Datasheet | undefined,
  abilityName: (id: string) => string | undefined,
): UnitState[] {
  const out: UnitState[] = [];
  for (const u of army.units) {
    const ds = datasheet(u.datasheetId);
    if (!ds || ds.models.length === 0) continue;
    out.push(
      unitFromDatasheet(ds, {
        id: u.key,
        player: 'p1',
        modelCount: u.modelCount,
        ...(u.models.length > 0
          ? { models: u.models.map((m) => ({ name: m.name, count: m.count })) }
          : {}),
        weapons: u.weapons,
        abilityName,
      }),
    );
  }
  return out;
}

/** Deploys every unit with the scripted deployment and starts battle round 1. */
export function autoDeploy(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 100 && s.phase === 'deployment'; i++) {
    const player = actingPlayer(s);
    if (!player) break;
    const action = nextAiAction(s, player);
    if (!action) break;
    const r = apply(s, action);
    if (!r.ok) break;
    s = r.state;
  }
  return s;
}

export function sandboxGame(
  units: UnitState[],
  seed: number,
  enemies: UnitState[] = [practiceDummies()],
): GameState {
  const game = createGame({
    seed,
    battlefield: trainingGround(),
    units: [...units, ...enemies],
    playerNames: { p1: 'You', p2: 'Opponent' },
  });
  return autoDeploy(game);
}
