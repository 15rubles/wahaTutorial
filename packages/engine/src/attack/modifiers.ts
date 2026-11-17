/** Modifier rules from 02.02.01 (Modifiers) that the attack sequence needs. */
export const ruleRefs = ['core.datasheets.profiles.modifiers'];

/** Hit and wound rolls are never modified by more than +1 or -1. */
export function capRollModifier(total: number): number {
  return Math.max(-1, Math.min(1, total));
}

/** A modified result below 1 counts as 1. */
export function modifiedRoll(roll: number, modifier: number): number {
  return Math.max(1, roll + modifier);
}

/** Keep a skill target between 2 and 6. */
export function clampSkill(skill: number): number {
  return Math.max(2, Math.min(6, skill));
}

/** AP cannot be worse than 0. */
export function clampAp(ap: number): number {
  return Math.min(0, ap);
}
