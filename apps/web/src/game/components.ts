import type { UnitState } from '@battle-drill/engine';

/**
 * Splits an attached unit into one view per original unit (for datasheet cards and the legend).
 * A unit that is not attached is returned as is.
 */
export function componentUnits(unit: UnitState): UnitState[] {
  if (!unit.components || unit.components.length < 2) return [unit];
  return unit.components.map((c) => {
    const models = unit.models.filter((m) => c.modelIds.includes(m.id));
    const used = new Set(models.flatMap((m) => m.weapons));
    return {
      ...unit,
      name: c.name,
      datasheetId: c.datasheetId,
      keywords: c.keywords,
      models,
      weapons: unit.weapons.filter((w) => used.has(w.name)),
      startingStrength: models.length,
      components: undefined,
    } as UnitState;
  });
}
