import type { UnitState, Weapon, WeaponKeyword } from '../types.js';
import { liveKeywords } from '../units/attach.js';

/** Facts about the attack that the battlefield / phase layer works out. */
export interface AttackContext {
  readonly kind: 'shooting' | 'fight';
  readonly attacker: UnitState;
  readonly target: UnitState;
  /** Target was within half range of the weapon in Select Targets (rapid fire, melta). */
  readonly withinHalfRange: boolean;
  /** Target has the benefit of cover against these attacks (13.08). */
  readonly targetHasCover: boolean;
  /** Attacking unit made a charge move this turn (lance). */
  readonly attackerCharged: boolean;
  /** Heavy bracing applies: unengaged, not set up this turn, no model moved more than 3" (24.16). */
  readonly attackerBraced: boolean;
  /** All of this weapon's attacks target one unit (cleave). */
  readonly singleTarget: boolean;
  /** Target model count in the Select Targets step (blast, cleave). */
  readonly targetModelsAtSelect: number;
  /** Extra modifiers from other rules (stratagems, abilities). Capped as the rules say. */
  readonly hitModifier: number;
  readonly woundModifier: number;
  /** Change to the BS / WS characteristic (positive = worse), e.g. cover. */
  readonly skillWorsened: number;
  /** Character model ids visible to the attackers (precision). */
  readonly visibleCharacterIds: readonly string[];
  /** Unmodified hit rolls up to this value fail (1 normally; indirect fire raises it, 10.07). */
  readonly hitFailsUpTo: number;
  /** Lethal hits: auto wound on a critical hit (true), or roll to wound to fish for criticals. */
  readonly lethalHitsAutoWound: 'always' | 'unless-better-on-critical-wound';
}

export function defaultContext(
  attacker: UnitState,
  target: UnitState,
  kind: AttackContext['kind'],
  overrides: Partial<AttackContext> = {},
): AttackContext {
  return {
    kind,
    attacker,
    target,
    withinHalfRange: false,
    targetHasCover: false,
    attackerCharged: false,
    attackerBraced: false,
    singleTarget: true,
    targetModelsAtSelect: target.models.filter((m) => !m.destroyed).length,
    hitModifier: 0,
    woundModifier: 0,
    skillWorsened: 0,
    visibleCharacterIds: [],
    hitFailsUpTo: 1,
    lethalHitsAutoWound: 'unless-better-on-critical-wound',
    ...overrides,
  };
}

export interface WeaponContext extends AttackContext {
  readonly weapon: Weapon;
}

/** Applied keywords: a keyword with a `non-X/Y` condition only applies to targets without X or Y. */
export function keywordApplies(kw: WeaponKeyword, target: UnitState): boolean {
  if (!kw.condition) return true;
  const m = /^non-(.+)$/i.exec(kw.condition.trim());
  // RULES-QUESTION: RQ-1 conditional keyword forms other than `non-X` are treated as always applying.
  if (!m) return true;
  const excluded = m[1]!.split('/').map((k) => k.trim().toUpperCase());
  return !excluded.some((k) => liveKeywords(target).includes(k));
}
