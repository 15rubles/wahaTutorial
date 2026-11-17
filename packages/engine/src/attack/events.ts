/** Events emitted while resolving attacks. The tutorial listens to these. */

export type HitOutcome = 'fail' | 'hit' | 'critical' | 'auto';
export type WoundOutcome = 'fail' | 'wound' | 'critical' | 'auto';
export type SaveOutcome = 'saved-armour' | 'saved-invuln' | 'damage';

export interface AttackDiceGathered {
  readonly type: 'AttackDiceGathered';
  readonly weapon: string;
  readonly base: number;
  readonly bonus: readonly { readonly keyword: string; readonly dice: number }[];
  readonly total: number;
}

export interface HitRolled {
  readonly type: 'HitRolled';
  readonly weapon: string;
  /** Target number after BS modifiers; null for automatic hits. */
  readonly target: number | null;
  readonly modifier: number;
  readonly rolls: readonly { readonly roll: number | null; readonly outcome: HitOutcome }[];
  readonly hits: number;
  readonly criticals: number;
  /** Extra hits from abilities (sustained hits). */
  readonly extraHits: number;
  /** Hits that skip the wound roll (lethal hits). */
  readonly autoWounds: number;
}

export interface WoundRolled {
  readonly type: 'WoundRolled';
  readonly weapon: string;
  readonly strength: number;
  readonly toughness: number;
  readonly target: number;
  readonly modifier: number;
  readonly rolls: readonly {
    readonly roll: number | null;
    readonly rerolledFrom?: number;
    readonly outcome: WoundOutcome;
  }[];
  readonly wounds: number;
  readonly criticals: number;
  /** Critical wounds that become mortal wounds (devastating wounds). */
  readonly devastating: number;
}

export interface SaveRolled {
  readonly type: 'SaveRolled';
  readonly weapon: string;
  readonly ap: number;
  readonly rolls: readonly {
    readonly roll: number;
    readonly modelId: string;
    readonly save: number;
    readonly invuln: number | null;
    readonly outcome: SaveOutcome;
  }[];
  readonly failed: number;
}

export interface DamageInflicted {
  readonly type: 'DamageInflicted';
  readonly weapon: string;
  readonly modelId: string;
  readonly damage: number;
  readonly prevented: number;
  readonly woundsLeft: number;
  readonly mortal: boolean;
}

export interface ModelDestroyed {
  readonly type: 'ModelDestroyed';
  readonly unitId: string;
  readonly modelId: string;
}

export interface HazardRolled {
  readonly type: 'HazardRolled';
  readonly unitId: string;
  readonly rolls: readonly number[];
  readonly failed: number;
  readonly mortalWounds: number;
}

export interface AttacksResolved {
  readonly type: 'AttacksResolved';
  readonly attackerId: string;
  readonly targetId: string;
  readonly modelsDestroyed: number;
  readonly woundsInflicted: number;
}

export type AttackEvent =
  | AttackDiceGathered
  | HitRolled
  | WoundRolled
  | SaveRolled
  | DamageInflicted
  | ModelDestroyed
  | HazardRolled
  | AttacksResolved;
