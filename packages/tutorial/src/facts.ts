import { type UnitState, type Weapon, aliveModels, hasDeepStrike } from '@battle-drill/engine';

/**
 * Plain facts about a lesson unit for `{role.fact}` tokens in step text, so lessons can name the
 * player's own weapons, abilities and stats. Every fact always has a value.
 */
export function unitFacts(role: string, unit: UnitState): Record<string, string> {
  const first = aliveModels(unit)[0] ?? unit.models[0];
  const avg = (w: Weapon) => w.attacks.dice * ((w.attacks.sides + 1) / 2) + w.attacks.plus;
  const best = (type: Weapon['type']) =>
    [...unit.weapons.filter((w) => w.type === type)].sort((a, b) => avg(b) - avg(a))[0];
  const ranged = best('ranged');
  const melee = best('melee');
  const abilities = [
    ...new Set(
      unit.weapons.flatMap((w) =>
        w.keywords.map((k) =>
          `${k.id === 'anti' ? `anti-${(k.target ?? '').toLowerCase()}` : k.id.replace(/-/g, ' ')}${k.param ? ` ${k.param}` : ''}`.trim(),
        ),
      ),
    ),
  ];
  const parts = unit.components ?? [];
  const leaders = parts.filter((c) => c.role === 'leader').map((c) => c.name);
  const bodyguard = parts.find((c) => c.role === 'bodyguard')?.name;
  const leaderModels = unit.models.filter((m) => m.attachedRole === 'leader');
  const leaderWeapon =
    unit.weapons.find(
      (w) => w.type === 'ranged' && leaderModels.some((m) => m.weapons.includes(w.name)),
    ) ?? unit.weapons.find((w) => leaderModels.some((m) => m.weapons.includes(w.name)));
  const leaderToughness = unit.models.find((m) => m.attachedRole === 'leader')?.toughness;
  const bodyguardToughness = unit.models.find((m) => m.attachedRole === 'bodyguard')?.toughness;
  const f: Record<string, string> = {
    rangedWeapon: ranged?.name ?? 'its guns',
    meleeWeapon: melee?.name ?? 'its close combat weapons',
    weaponAbilities: abilities.length > 0 ? abilities.join(', ') : 'none',
    toughness: String(first?.toughness ?? '?'),
    save: `${first?.save ?? '?'}+`,
    move: first?.movement === null || first?.movement === undefined ? '-' : `${first.movement}"`,
    models: String(aliveModels(unit).length),
    leaderName: leaders.join(' and ') || unit.name,
    bodyguard: bodyguard ?? unit.name,
    leaderWeapon: leaderWeapon?.name ?? ranged?.name ?? melee?.name ?? 'its weapons',
    leaderToughness: String(leaderToughness ?? first?.toughness ?? '?'),
    bodyguardToughness: String(bodyguardToughness ?? first?.toughness ?? '?'),
    arrival: hasDeepStrike(unit)
      ? 'it has Deep Strike, so it can arrive anywhere more than 8" from every enemy'
      : 'it arrives wholly within 6" of a battlefield edge',
  };
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [`${role}.${k}`, v]));
}
