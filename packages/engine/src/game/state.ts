import type { AttackEvent } from '../attack/events.js';
import type { Battlefield } from '../board/battlefield.js';
import { type RngState, createRng } from '../dice/rng.js';
import type { PlayerId, Point, UnitState } from '../types.js';

export const ruleRefs = ['core.the-battle-round', 'core.the-battle-round.player-turns'];

export type Phase =
  'deployment' | 'command' | 'movement' | 'shooting' | 'charge' | 'fight' | 'game-over';
export type FightStep = 'pile-in' | 'fight' | 'consolidate';
export type MoveType = 'stationary' | 'normal' | 'advance' | 'fall-back' | 'ingress' | 'disembark';
export type ShootingType = 'normal' | 'assault' | 'close-quarters' | 'indirect';

/** Per unit flags that reset every turn (or phase, where noted). */
export interface UnitStatus {
  readonly moved: MoveType | null;
  readonly advanceRoll: number | null;
  /** Largest distance any model moved this turn (heavy). */
  readonly maxMoved: number;
  readonly setUpThisTurn: boolean;
  readonly shot: boolean;
  readonly declaredCharge: boolean;
  readonly chargeRoll: number | null;
  readonly charged: boolean;
  readonly piledIn: boolean;
  readonly fought: boolean;
  readonly consolidated: boolean;
  /** Eligible to fight this phase (kept for consolidation). */
  readonly eligibleToFight: boolean;
  /** Persists across turns until a battle-shock roll is passed. */
  readonly battleShocked: boolean;
  /** In strategic reserves (20): off the battlefield until an ingress move. Persists across turns. */
  readonly inReserves: boolean;
  /** Id of the TRANSPORT this unit is embarked within (18). Persists across turns. */
  readonly embarkedIn: string | null;
  /** Embarked this turn (so it cannot disembark again this phase). */
  readonly embarkedThisTurn: boolean;
  /** Disembarked this turn, and how (18.04). Tactical: may still make a normal or advance move. */
  readonly disembarked: 'rapid' | 'tactical' | 'emergency' | null;
  /** Rapid or emergency disembark this turn: no charge declarations until the turn ends. */
  readonly cannotCharge: boolean;
}

export const freshStatus = (
  battleShocked = false,
  inReserves = false,
  embarkedIn: string | null = null,
): UnitStatus => ({
  moved: null,
  advanceRoll: null,
  maxMoved: 0,
  setUpThisTurn: false,
  shot: false,
  declaredCharge: false,
  chargeRoll: null,
  charged: false,
  piledIn: false,
  fought: false,
  consolidated: false,
  eligibleToFight: false,
  battleShocked,
  inReserves,
  embarkedIn,
  embarkedThisTurn: false,
  disembarked: null,
  cannotCharge: false,
});

export interface PlayerState {
  readonly name: string;
  readonly cp: number;
  readonly vp: number;
}

/** Invented scoring for training games: VP per objective controlled at the end of each turn. */
export interface Mission {
  readonly name: string;
  readonly battleRounds: number;
  readonly vpPerObjective: number;
}

export type GameEvent =
  | AttackEvent
  | { readonly type: 'UnitDeployed'; readonly unitId: string }
  | { readonly type: 'UnitPlacedInReserves'; readonly unitId: string }
  | { readonly type: 'UnitEmbarked'; readonly unitId: string; readonly transportId: string }
  | {
      readonly type: 'UnitDisembarked';
      readonly unitId: string;
      readonly transportId: string;
      readonly mode: 'rapid' | 'tactical' | 'emergency';
      readonly lost: number;
    }
  | { readonly type: 'UnitArrived'; readonly unitId: string; readonly deepStrike: boolean }
  | { readonly type: 'BattleRoundStarted'; readonly round: number }
  | { readonly type: 'TurnStarted'; readonly player: PlayerId; readonly round: number }
  | { readonly type: 'PhaseStarted'; readonly phase: Phase; readonly player: PlayerId }
  | { readonly type: 'FightStepStarted'; readonly step: FightStep }
  | {
      readonly type: 'CommandPointsGained';
      readonly player: PlayerId;
      readonly amount: number;
      readonly total: number;
    }
  | {
      readonly type: 'BattleShockRolled';
      readonly unitId: string;
      readonly rolls: readonly number[];
      readonly target: number;
      readonly passed: boolean;
    }
  | {
      readonly type: 'UnitMoved';
      readonly unitId: string;
      readonly moveType: MoveType;
      readonly maxDistance: number;
      readonly moved: number;
    }
  | { readonly type: 'AdvanceRolled'; readonly unitId: string; readonly roll: number }
  | {
      readonly type: 'UnitShot';
      readonly unitId: string;
      readonly shootingType: ShootingType;
      readonly targetIds: readonly string[];
    }
  | {
      readonly type: 'ChargeDeclared';
      readonly unitId: string;
      readonly rolls: readonly number[];
      readonly distance: number;
    }
  | { readonly type: 'ChargeMoved'; readonly unitId: string; readonly targetIds: readonly string[] }
  | { readonly type: 'ChargeFailed'; readonly unitId: string }
  | { readonly type: 'PiledIn'; readonly unitId: string }
  | { readonly type: 'UnitFought'; readonly unitId: string; readonly targetIds: readonly string[] }
  | { readonly type: 'Consolidated'; readonly unitId: string }
  | {
      readonly type: 'ObjectiveControlled';
      readonly objectiveId: string;
      readonly player: PlayerId | null;
      readonly levels: Readonly<Record<PlayerId, number>>;
    }
  | {
      readonly type: 'VictoryPointsScored';
      readonly player: PlayerId;
      readonly amount: number;
      readonly total: number;
    }
  | { readonly type: 'UnitDestroyed'; readonly unitId: string }
  | {
      readonly type: 'StratagemUsed';
      readonly player: PlayerId;
      readonly stratagemId: string;
      readonly unitId: string | null;
      readonly cost: number;
      readonly cpLeft: number;
    }
  | { readonly type: 'GameEnded'; readonly winner: PlayerId | null };

export interface GameState {
  readonly version: 2;
  readonly rng: RngState;
  readonly battlefield: Battlefield;
  readonly mission: Mission;
  readonly units: Readonly<Record<string, UnitState>>;
  readonly status: Readonly<Record<string, UnitStatus>>;
  readonly players: Readonly<Record<PlayerId, PlayerState>>;
  readonly firstPlayer: PlayerId;
  readonly battleRound: number;
  readonly activePlayer: PlayerId;
  readonly phase: Phase;
  readonly fightStep: FightStep | null;
  /** Fight step: whose turn it is to select a unit (12.04). */
  readonly fightSelector: PlayerId | null;
  readonly objectiveControl: Readonly<Record<string, PlayerId | null>>;
  /** Stratagems used in the current phase (15.01 restrictions). */
  readonly stratagemsThisPhase: readonly {
    readonly player: PlayerId;
    readonly stratagemId: string;
    readonly unitId: string | null;
  }[];
  /** Everything that happened, in order. */
  readonly log: readonly GameEvent[];
}

export interface NewGameOptions {
  readonly seed: number;
  readonly battlefield: Battlefield;
  readonly units: readonly UnitState[];
  readonly firstPlayer?: PlayerId;
  readonly mission?: Partial<Mission>;
  readonly playerNames?: Partial<Record<PlayerId, string>>;
}

export function createGame(options: NewGameOptions): GameState {
  const units: Record<string, UnitState> = {};
  const status: Record<string, UnitStatus> = {};
  for (const u of options.units) {
    units[u.id] = { ...u, models: u.models.map((m) => ({ ...m, position: m.position ?? null })) };
    status[u.id] = freshStatus();
  }
  return {
    version: 2,
    rng: createRng(options.seed),
    battlefield: options.battlefield,
    mission: { name: 'Training Drill', battleRounds: 5, vpPerObjective: 5, ...options.mission },
    units,
    status,
    players: {
      p1: { name: options.playerNames?.p1 ?? 'Player', cp: 0, vp: 0 },
      p2: { name: options.playerNames?.p2 ?? 'Opponent', cp: 0, vp: 0 },
    },
    firstPlayer: options.firstPlayer ?? 'p1',
    battleRound: 0,
    activePlayer: options.firstPlayer ?? 'p1',
    phase: 'deployment',
    fightStep: null,
    fightSelector: null,
    objectiveControl: Object.fromEntries(options.battlefield.objectives.map((o) => [o.id, null])),
    stratagemsThisPhase: [],
    log: [],
  };
}

export const opponent = (p: PlayerId): PlayerId => (p === 'p1' ? 'p2' : 'p1');

export function unitsOf(state: GameState, player: PlayerId): UnitState[] {
  return Object.values(state.units).filter((u) => u.player === player);
}

export function withUnit(state: GameState, unit: UnitState): GameState {
  return { ...state, units: { ...state.units, [unit.id]: unit } };
}

export function withStatus(
  state: GameState,
  unitId: string,
  patch: Partial<UnitStatus>,
): GameState {
  return {
    ...state,
    status: { ...state.status, [unitId]: { ...state.status[unitId]!, ...patch } },
  };
}

export function moveModels(unit: UnitState, positions: readonly (Point | null)[]): UnitState {
  let i = 0;
  return {
    ...unit,
    models: unit.models.map((m) =>
      m.destroyed ? m : { ...m, position: positions[i++] ?? m.position },
    ),
  };
}
