import type { Point } from '../types.js';
import type { MoveType, ShootingType } from './state.js';

/** Positions are given for the unit's alive models, in model order. */
export type GameAction =
  | { readonly type: 'deploy'; readonly unitId: string; readonly positions: readonly Point[] }
  | { readonly type: 'placeInReserves'; readonly unitId: string }
  | { readonly type: 'embark'; readonly unitId: string; readonly transportId: string }
  | { readonly type: 'endPhase' }
  | { readonly type: 'advanceRoll'; readonly unitId: string }
  | {
      readonly type: 'move';
      readonly unitId: string;
      readonly moveType: MoveType;
      readonly positions?: readonly Point[];
    }
  | {
      readonly type: 'shoot';
      readonly unitId: string;
      readonly shootingType: ShootingType;
      /** Weapon name -> target unit id. Weapons left out do not fire. */
      readonly targets: Readonly<Record<string, string>>;
    }
  | { readonly type: 'declareCharge'; readonly unitId: string }
  | {
      readonly type: 'chargeMove';
      readonly unitId: string;
      readonly targetIds: readonly string[];
      readonly positions: readonly Point[];
    }
  | { readonly type: 'skipCharge'; readonly unitId: string }
  | { readonly type: 'pileIn'; readonly unitId: string; readonly positions: readonly Point[] }
  | {
      readonly type: 'fight';
      readonly unitId: string;
      readonly targetId: string;
      /** Melee weapon each model uses; default is the first non extra attacks melee weapon. */
      readonly weapon?: string;
      /** Overrun fight only: the additional pile-in move made before fighting. */
      readonly pileInPositions?: readonly Point[];
    }
  | { readonly type: 'consolidate'; readonly unitId: string; readonly positions: readonly Point[] }
  | {
      readonly type: 'useStratagem';
      readonly player: 'p1' | 'p2';
      readonly stratagemId: string;
      /** CP cost from the stratagem's data. */
      readonly cost: number;
      readonly targetUnitId?: string;
    };

export type ActionType = GameAction['type'];
