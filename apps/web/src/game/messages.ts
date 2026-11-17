import type { RuleErrorCode } from '@battle-drill/engine';

/** Our own short explanations of why an action was refused (no rules text). */
export const ERROR_TEXT: Record<RuleErrorCode, string> = {
  WRONG_PHASE: 'That is not something you can do in this phase.',
  NOT_ACTIVE_PLAYER: 'It is the other player’s turn to choose.',
  UNKNOWN_UNIT: 'That unit is not on the battlefield.',
  NOT_YOUR_UNIT: 'That is not one of your units.',
  ALREADY_ACTED: 'That unit has already done this.',
  NOT_ELIGIBLE: 'That unit is not allowed to do that right now.',
  BAD_POSITIONS: 'Some models were not placed.',
  TOO_FAR: 'That is further than this move allows.',
  MUST_END_WITHIN_1:
    'A charging model that can get within 1" of a charge target has to. Move it closer.',
  MUST_END_ENGAGED:
    'A charging model that can reach engagement range of a charge target has to. Move it closer.',
  NOT_NEAR_EDGE:
    'Too far from the edge: arriving models go wholly within 6" of a battlefield edge.',
  TOO_CLOSE_TO_ENEMY: 'Too close: keep arriving models over 8" from every enemy.',
  OFF_BATTLEFIELD: 'Models must stay on the battlefield.',
  OVERLAPS: 'Models cannot end on top of other models.',
  THROUGH_ENEMY: 'Models cannot move through enemy models.',
  COHERENCY: 'The unit would fall out of coherency (keep models close together).',
  ENDS_ENGAGED: 'This move cannot end within 2" of an enemy.',
  MUST_BE_ENGAGED: 'This move has to end in engagement range of the enemy.',
  OUTSIDE_DEPLOYMENT_ZONE: 'Set up inside your deployment zone.',
  TERRAIN_BLOCKS: 'This unit cannot move through that dense terrain.',
  NO_TARGET: 'There is no valid target for that.',
  NOT_VISIBLE: 'No model with that weapon can see the target.',
  OUT_OF_RANGE: 'The target is out of range.',
  TARGET_ENGAGED: 'That target is locked in combat.',
  WEAPON_NOT_ALLOWED: 'That weapon cannot be used with this kind of shooting.',
  NOT_CLOSER: 'Every model that moves has to end closer to the enemy.',
  NOT_ALL_TARGETS_ENGAGED: 'The charge has to end engaged with every target.',
  ENGAGED_NON_TARGET: 'The charge cannot end engaged with a unit you did not charge.',
  NOT_ENOUGH_CP: 'You do not have enough command points.',
  STRATAGEM_USED: 'That stratagem (or a stratagem on that unit) was already used this phase.',
  GAME_OVER: 'The game is over.',
};
