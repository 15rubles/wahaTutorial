/**
 * Pure rules engine. No UI, no DOM, no network.
 * Game state is an immutable, JSON-serializable plain object.
 */
export * from './types.js';
export * from './dice/rng.js';
export * from './dice/roller.js';
export {
  rollExpr,
  parseParam,
  flat,
  exprToString,
  isRandom,
  type DiceExpr,
} from './dice/diceExpr.js';
export * from './attack/events.js';
export * from './attack/context.js';
export { requiredWoundRoll } from './attack/woundChart.js';
export { capRollModifier, modifiedRoll, clampSkill } from './attack/modifiers.js';
export { gatherDice } from './attack/gatherDice.js';
export { rollHits, hitProfile } from './attack/hitRoll.js';
export { rollWounds, unitToughness, woundProfile } from './attack/woundRoll.js';
export { allocationOrder, currentGroup, selectModel } from './attack/allocation.js';
export { checkSave, resolveSaves } from './attack/saveRoll.js';
export { inflictMortalWounds, mortalWoundModel } from './attack/mortalWounds.js';
export { makeHazardRolls } from './attack/hazard.js';
export {
  resolveAttacks,
  type WeaponSelection,
  type AttackResult,
} from './attack/resolveAttacks.js';
export {
  keywordModule,
  implementedKeywords,
  unimplementedKeywords,
  weaponHasFlag,
  hasKeywordId,
} from './keywords/registry.js';
export type { KeywordModule } from './keywords/types.js';
export { unitFromDatasheet, toWeapon, baseRadius, type UnitChoices } from './units/fromData.js';

export * from './board/geometry.js';
export {
  type TerrainCategory,
  type TerrainArea,
  type Objective,
  type DeploymentZone,
  type Battlefield,
  isObscuring,
  OBJECTIVE_MARKER_RADIUS,
  OBJECTIVE_RANGE,
  trainingGround,
} from './board/battlefield.js';
export {
  ENGAGEMENT_RANGE,
  modelDistance,
  unitDistance,
  within,
  modelsEngaged,
  unitsEngaged,
  onBattlefield,
  inBaseContact,
} from './board/measure.js';
export {
  MODELS_BLOCK_LOS,
  terrainContaining,
  modelVisible,
  modelFullyVisible,
  unitVisibleTo,
  hasBenefitOfCover,
} from './board/visibility.js';
export { inCoherency } from './board/coherency.js';
export {
  type Phase,
  type FightStep,
  type MoveType,
  type ShootingType,
  type UnitStatus,
  freshStatus,
  type PlayerState,
  type Mission,
  type GameEvent,
  type GameState,
  type NewGameOptions,
  createGame,
  opponent,
  unitsOf,
  withUnit,
  withStatus,
  moveModels,
} from './game/state.js';
export * from './game/actions.js';
export * from './game/errors.js';
export { apply, type ApplyResult } from './game/apply.js';
export { endPhase, fightStepDone } from './game/flow.js';
export * from './game/history.js';
export * from './game/formation.js';
export { eligibleMoveTypes } from './phases/movement.js';
export { eligibleShootingTypes, weaponAllowed, checkTarget, shooters } from './phases/shooting.js';
export { canDeclareCharge, possibleChargeTargets, CHARGE_DECLARE_RANGE } from './phases/charge.js';
export {
  canPileIn,
  canConsolidate,
  consolidationMode,
  eligibleToFight,
  fightsFirst,
  nextFightSelector,
  pileInTargets,
  objectiveDistance,
} from './phases/fight.js';
export { atOrBelowHalfStrength } from './phases/command.js';
export { controlLevels } from './phases/objectives.js';
export { engagedEnemies, isEngaged } from './phases/validateMove.js';
export { nextAiAction, actingPlayer } from './ai/scriptedAi.js';
export { engineRuleRefs } from './ruleRefs.js';
export { legalActions, type LegalOption } from './phases/legalActions.js';
