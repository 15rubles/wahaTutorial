import type { ModelState, UnitState } from '../types.js';

export const ruleRefs = [
  'core.attack-sequence.save-rolls',
  'core.attack-sequence.inflict-damage.current-allocation-group',
  'core.core-abilities.precision',
];

export interface AllocationGroup {
  readonly key: string;
  readonly character: boolean;
  readonly modelIds: readonly string[];
}

const wounded = (m: ModelState) => !m.destroyed && m.woundsLeft < m.wounds;

/**
 * Create Groups and Allocation Order (05.03): one group per CHARACTER model, one group per
 * (W, Sv, InSv) for the rest. Non-character groups with a wounded model first, then other
 * non-character groups, then wounded character groups, then other character groups. The defending
 * player may choose among equals; the engine keeps the unit's model order.
 */
export function allocationOrder(unit: UnitState): AllocationGroup[] {
  const groups = new Map<string, { character: boolean; modelIds: string[] }>();
  for (const m of unit.models) {
    if (m.destroyed) continue;
    const key = m.isCharacter ? `char:${m.id}` : `w${m.wounds}:sv${m.save}:inv${m.invuln ?? '-'}`;
    const g = groups.get(key) ?? { character: m.isCharacter, modelIds: [] };
    g.modelIds.push(m.id);
    groups.set(key, g);
  }
  const byId = new Map(unit.models.map((m) => [m.id, m]));
  const rank = (g: { character: boolean; modelIds: string[] }) =>
    (g.character ? 2 : 0) + (g.modelIds.some((id) => wounded(byId.get(id)!)) ? 0 : 1);
  return [...groups]
    .map(([key, g], index) => ({ key, ...g, index }))
    .sort((a, b) => rank(a) - rank(b) || a.index - b.index)
    .map(({ key, character, modelIds }) => ({ key, character, modelIds }));
}

/** First group in the order that still has a model alive. */
export function currentGroup(
  unit: UnitState,
  order: readonly AllocationGroup[],
  forced?: string,
): AllocationGroup | undefined {
  const alive = new Set(unit.models.filter((m) => !m.destroyed).map((m) => m.id));
  if (forced) {
    const g = order.find((x) => x.key === forced);
    if (g && g.modelIds.some((id) => alive.has(id))) return g;
  }
  return order.find((g) => g.modelIds.some((id) => alive.has(id)));
}

/** Select Model: a model in the group that has lost wounds if possible. */
export function selectModel(unit: UnitState, group: AllocationGroup): ModelState | undefined {
  const models = group.modelIds
    .map((id) => unit.models.find((m) => m.id === id)!)
    .filter((m) => !m.destroyed);
  return models.find(wounded) ?? models[0];
}

/** Group key a precision attack may pick: the first visible CHARACTER model still alive. */
export function precisionGroupKey(
  unit: UnitState,
  visibleCharacterIds: readonly string[],
): string | undefined {
  const m = unit.models.find(
    (x) => !x.destroyed && x.isCharacter && visibleCharacterIds.includes(x.id),
  );
  return m ? `char:${m.id}` : undefined;
}
