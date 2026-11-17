import type { Roller } from '../dice/roller.js';
import type { WeaponKeyword } from '../types.js';
import type { WeaponContext } from '../attack/context.js';

export interface HitProfile {
  autoHit: boolean;
  /** Roll modifier to the hit roll (capped at +-1 later). */
  modifier: number;
  /** Change to BS / WS (positive = worse). */
  skillWorsened: number;
  /** Unmodified rolls of this or higher are critical hits. */
  criticalOn: number;
  /** Ignore harmful modifiers to the hit roll and BS / WS. */
  ignoreNegative: boolean;
  ignoresCover: boolean;
}

export interface WoundProfile {
  modifier: number;
  criticalOn: number;
  rerollFailed: boolean;
}

export interface CriticalHitEffect {
  extraHits?: number;
  autoWound?: boolean;
}

/**
 * Hooks a weapon keyword can implement. Every hook gets the keyword (with its parameter) and the
 * weapon context. Keywords that only change what a unit may do (assault, pistol, indirect fire...)
 * are flags used by the phase layer and implement no hooks here.
 */
export interface KeywordModule {
  readonly id: string;
  readonly ruleRefs: readonly string[];
  /** Phase level permissions this keyword grants, read by the shooting / fight rules. */
  readonly flags?: readonly (
    'assault' | 'close-quarters' | 'indirect' | 'heavy' | 'one-shot' | 'extra-attacks' | 'psychic'
  )[];
  extraAttackDice?(kw: WeaponKeyword, ctx: WeaponContext, roller: Roller): number;
  hitProfile?(kw: WeaponKeyword, ctx: WeaponContext, profile: HitProfile): HitProfile;
  onCriticalHit?(kw: WeaponKeyword, ctx: WeaponContext, roller: Roller): CriticalHitEffect;
  woundProfile?(kw: WeaponKeyword, ctx: WeaponContext, profile: WoundProfile): WoundProfile;
  /** True: critical wounds skip saves and become mortal wounds equal to D. */
  devastating?(kw: WeaponKeyword, ctx: WeaponContext): boolean;
  damageBonus?(kw: WeaponKeyword, ctx: WeaponContext, roller: Roller): number;
  /** Hazard rolls to make after the unit's attacks, per selected weapon. */
  hazardRolls?(kw: WeaponKeyword, ctx: WeaponContext): number;
}
