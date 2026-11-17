import type { ModelState, UnitComponent, UnitState, Weapon } from '../types.js';

export const ruleRefs = [
  'core.attached-units.forming-attached-units',
  'core.attached-units.keywords-in-attached-units',
  'core.core-abilities.leader-support',
];

const component = (u: UnitState, role: UnitComponent['role']): UnitComponent => ({
  datasheetId: u.datasheetId,
  name: u.name,
  role,
  keywords: u.keywords,
  modelIds: u.models.map((m) => m.id),
});

/**
 * Forms an attached unit (19.01): one unit for all rules purposes, with the keywords of all its
 * component units (19.03). Bodyguard models come first. Weapons keep their names unless two
 * components have different profiles under the same name; then the leader's gets a suffix.
 */
export function attachUnits(bodyguard: UnitState, leaders: readonly UnitState[]): UnitState {
  const weapons: Weapon[] = [...bodyguard.weapons];
  const models: ModelState[] = bodyguard.models.map((m) => ({
    ...m,
    attachedRole: 'bodyguard' as const,
  }));
  for (const leader of leaders) {
    const rename = new Map<string, string>();
    for (const w of leader.weapons) {
      const same = weapons.find((x) => x.name === w.name);
      if (!same) weapons.push(w);
      else if (JSON.stringify(same) !== JSON.stringify(w)) {
        const name = `${w.name} (${leader.name})`;
        rename.set(w.name, name);
        weapons.push({ ...w, name });
      }
    }
    for (const m of leader.models) {
      models.push({
        ...m,
        attachedRole: 'leader',
        weapons: m.weapons.map((n) => rename.get(n) ?? n),
      });
    }
  }
  const keywords = [...new Set([bodyguard, ...leaders].flatMap((u) => u.keywords))];
  const abilities = [bodyguard, ...leaders].map((u) => u.abilities ?? []);
  // A unit-wide ability (deep strike) only counts if every component has it.
  const shared = abilities[0]!.filter((a) => abilities.every((list) => list.includes(a)));
  return {
    ...bodyguard,
    name: `${leaders.map((l) => l.name).join(' + ')} + ${bodyguard.name}`,
    keywords,
    weapons,
    models,
    startingStrength: models.length,
    abilities: shared,
    components: [component(bodyguard, 'bodyguard'), ...leaders.map((l) => component(l, 'leader'))],
  };
}

/** Live keywords of a unit: an attached unit only has keywords of components with models left. */
export function liveKeywords(unit: UnitState): readonly string[] {
  if (!unit.components) return unit.keywords;
  const alive = new Set(unit.models.filter((m) => !m.destroyed).map((m) => m.id));
  return [
    ...new Set(
      unit.components
        .filter((c) => c.modelIds.some((id) => alive.has(id)))
        .flatMap((c) => c.keywords),
    ),
  ];
}
