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

/** Kept from M0 for the web shell and tutorial skeleton; M6 replaces it with the full game state. */
export interface LegacyGameState {
  readonly version: 1;
  readonly battleRound: number;
  readonly events: readonly { readonly type: string }[];
}

export function createEmptyGameState(): LegacyGameState {
  return Object.freeze({ version: 1, battleRound: 0, events: Object.freeze([]) });
}
export type GameState = LegacyGameState;
