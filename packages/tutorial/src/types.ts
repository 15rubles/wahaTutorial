import type { GameAction, GameEvent, GameState, Phase, UnitState } from '@battle-drill/engine';

/** Unit roles a lesson can ask for. Filled from the player's army (roles.ts). */
export type Role =
  | 'melee'
  | 'shooter'
  | 'fast'
  | 'character'
  /** A leader attached to its bodyguard unit (one merged unit). */
  | 'leader'
  /** A unit with the Deep Strike ability, starting in reserves. */
  | 'deepStriker'
  /** A TRANSPORT that can carry another lesson unit. */
  | 'transport'
  /** An INFANTRY unit to ride in the transport. */
  | 'passenger'
  | 'target'
  | 'enemyMelee';

/** Something on screen to highlight. Elements carry `data-tutorial-id`. */
export type UiTarget =
  | { readonly kind: 'element'; readonly id: string }
  | { readonly kind: 'unit'; readonly role: Role };

export interface LessonContext {
  /** Unit id in the lesson game for each role. */
  readonly units: Readonly<Partial<Record<Role, string>>>;
  /** Display name per role (the player's own unit names). */
  readonly names: Readonly<Partial<Record<Role, string>>>;
  /** Roles the army could not fill, played by an invented stand-in unit. */
  readonly fallbacks: readonly Role[];
  /** `{role.fact}` values, e.g. `shooter.rangedWeapon` (see facts.ts). */
  readonly facts?: Readonly<Record<string, string>>;
}

/** What the player has to do to finish a step. */
export type ExpectedAction =
  /** Press "Next". */
  | { readonly kind: 'ack' }
  /** A UI signal, e.g. selecting a unit or opening a rule popup. */
  | { readonly kind: 'ui'; readonly signal: UiSignal['type']; readonly role?: Role }
  /** An engine event, optionally checked by a predicate. */
  | {
      readonly kind: 'event';
      readonly event: GameEvent['type'];
      readonly where?: (e: GameEvent, ctx: LessonContext, state: GameState) => boolean;
    };

export type UiSignal =
  | { readonly type: 'unit-selected'; readonly unitId: string }
  | { readonly type: 'rule-opened'; readonly ruleId: string }
  | { readonly type: 'card-section-opened'; readonly section: string };

export interface Step {
  readonly id: string;
  /** RuleSection ids; the text is pulled from the local cache. */
  readonly ruleRefs: readonly string[];
  /**
   * Our own short explanation in plain words. `{role}` is replaced by the unit's name and
   * `{role.fact}` by a fact about it (facts.ts), e.g. `{shooter.rangedWeapon}`.
   */
  readonly say: string;
  /** Elements to highlight; everything else is dimmed and blocked. */
  readonly focus?: readonly UiTarget[];
  readonly expect?: ExpectedAction;
  /** Hint shown when the player does something else. */
  readonly onWrong?: string;
  /** Engine actions allowed during this step (others are blocked). Default: any. */
  readonly allow?: readonly GameAction['type'][];
  /** Dice to use for the next rolls in this step (to show a specific result). */
  readonly dice?: readonly number[];
  readonly setup?: (s: GameState, ctx: LessonContext) => GameState;
  /** Free play: nothing is dimmed or blocked during this step. */
  readonly free?: boolean;
}

export interface LessonUnitSpec {
  readonly role: Role;
  readonly at: { readonly x: number; readonly y: number };
  /** Instead of `at.y`: place this unit `gap` inches (edge to edge) beyond the named role's unit. */
  readonly near?: { readonly role: Role; readonly gap: number };
  /** Start off the board in strategic reserves (`at` is ignored). */
  readonly reserves?: boolean;
  /** Start embarked within this role's TRANSPORT (`at` is ignored). List the transport first. */
  readonly embarkIn?: Role;
}

export type LessonPanel = 'stratagems' | 'army-rules';

export interface Lesson {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  /** Roles placed on the board (player roles are p1, `target` / `enemyMelee` are p2). */
  readonly units: readonly LessonUnitSpec[];
  /**
   * 'roles' (default): only the role units, already placed. 'full': the whole army plus `units` as
   * enemies, starting in deployment (or auto-deployed when `deployment` is false).
   */
  readonly army?: 'roles' | 'full';
  readonly deployment?: boolean;
  readonly battleRounds?: number;
  /** CP each player starts with (drills hand out a few to practise with). */
  readonly startCp?: number;
  /** Extra side panels the lesson needs. */
  readonly panels?: readonly LessonPanel[];
  /** Phase (of player 1, round 1) the lesson starts in. */
  readonly startPhase?: Phase;
  /** Battle round the lesson starts in (default 1); earlier turns pass with no actions. */
  readonly startRound?: number;
  readonly seed?: number;
  readonly steps: readonly Step[];
}

export type RoleUnits = Readonly<Partial<Record<Role, UnitState>>>;
