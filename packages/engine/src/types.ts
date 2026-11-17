/**
 * Engine state types. Plain, immutable, JSON-serializable objects.
 */
import type { DiceExpr } from './dice/diceExpr.js';

export interface WeaponKeyword {
  /** Slug, e.g. `sustained-hits`, `anti`. */
  readonly id: string;
  readonly param?: string;
  /** For `anti`: target keyword(s), lower case, `/` separated. */
  readonly target?: string;
  /** Limiting condition as written in the data, e.g. `non-MONSTER/VEHICLE`. */
  readonly condition?: string;
}

export interface Weapon {
  readonly name: string;
  readonly type: 'ranged' | 'melee';
  /** Inches; null for melee. */
  readonly range: number | null;
  readonly attacks: DiceExpr;
  /** BS / WS target number, null if none (attacks without a skill value). */
  readonly skill: number | null;
  readonly strength: DiceExpr;
  /** Non-positive. */
  readonly ap: number;
  readonly damage: DiceExpr;
  readonly keywords: readonly WeaponKeyword[];
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface ModelState {
  readonly id: string;
  readonly name: string;
  readonly toughness: number;
  readonly save: number;
  readonly invuln: number | null;
  readonly wounds: number;
  readonly woundsLeft: number;
  readonly leadership: number;
  readonly objectiveControl: number;
  readonly movement: number | null;
  readonly isCharacter: boolean;
  /** Feel No Pain target, if the model has the ability. */
  readonly feelNoPain: number | null;
  /** Weapon names this model carries (keys into the unit's weapon list). */
  readonly weapons: readonly string[];
  /** Base radius in inches. */
  readonly baseRadius: number;
  readonly position: Point | null;
  readonly destroyed: boolean;
  /** In an attached unit: whether this model came from the leader / support unit or the bodyguard. */
  readonly attachedRole?: 'leader' | 'bodyguard';
}

export interface UnitState {
  readonly id: string;
  readonly name: string;
  readonly player: PlayerId;
  readonly datasheetId: string;
  /** Upper case keywords, e.g. INFANTRY, CHARACTER, VEHICLE. */
  readonly keywords: readonly string[];
  readonly weapons: readonly Weapon[];
  readonly models: readonly ModelState[];
  /** Model count when the unit was set up (for half-strength). */
  readonly startingStrength: number;
  /** Slugs of core abilities the unit has, e.g. `deep-strike` (only those the engine uses). */
  readonly abilities?: readonly string[];
  /** One-shot weapons already used this battle (24.26). */
  readonly spentWeapons?: readonly string[];
  /** For attached units (19): the units it was formed from, in order (bodyguard first). */
  readonly components?: readonly UnitComponent[];
}

export interface UnitComponent {
  readonly datasheetId: string;
  readonly name: string;
  readonly role: 'leader' | 'bodyguard';
  readonly keywords: readonly string[];
  readonly modelIds: readonly string[];
}

export type PlayerId = 'p1' | 'p2';

export const aliveModels = (u: UnitState): ModelState[] => u.models.filter((m) => !m.destroyed);
export const isDestroyed = (u: UnitState): boolean => u.models.every((m) => m.destroyed);
export const hasKeyword = (u: UnitState, kw: string): boolean =>
  u.keywords.includes(kw.toUpperCase());
