/** Machine readable reasons an action was refused. The tutorial maps these to hints. */
export type RuleErrorCode =
  | 'WRONG_PHASE'
  | 'NOT_ACTIVE_PLAYER'
  | 'UNKNOWN_UNIT'
  | 'NOT_YOUR_UNIT'
  | 'ALREADY_ACTED'
  | 'NOT_ELIGIBLE'
  | 'BAD_POSITIONS'
  | 'TOO_FAR'
  | 'OFF_BATTLEFIELD'
  | 'OVERLAPS'
  | 'THROUGH_ENEMY'
  | 'COHERENCY'
  | 'ENDS_ENGAGED'
  | 'MUST_BE_ENGAGED'
  | 'OUTSIDE_DEPLOYMENT_ZONE'
  | 'TERRAIN_BLOCKS'
  | 'NO_TARGET'
  | 'NOT_VISIBLE'
  | 'OUT_OF_RANGE'
  | 'TARGET_ENGAGED'
  | 'WEAPON_NOT_ALLOWED'
  | 'NOT_CLOSER'
  | 'NOT_ALL_TARGETS_ENGAGED'
  | 'ENGAGED_NON_TARGET'
  | 'NOT_ENOUGH_CP'
  | 'STRATAGEM_USED'
  | 'GAME_OVER';

export interface RuleError {
  readonly code: RuleErrorCode;
  /** Short developer facing detail (not rules text). */
  readonly detail: string;
}

export const err = (code: RuleErrorCode, detail = ''): RuleError => ({ code, detail });
