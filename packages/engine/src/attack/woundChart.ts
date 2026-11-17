/** Required wound roll from the attack's Strength against the target's Toughness (05.02). */
export const ruleRefs = ['core.attack-sequence.wound-roll'];

export function requiredWoundRoll(strength: number, toughness: number): number {
  if (strength >= toughness * 2) return 2;
  if (strength > toughness) return 3;
  if (strength === toughness) return 4;
  if (strength * 2 <= toughness) return 6;
  return 5;
}
