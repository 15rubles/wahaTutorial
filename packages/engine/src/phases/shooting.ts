import { defaultContext } from '../attack/context.js';
import type { AttackEvent } from '../attack/events.js';
import { resolveAttacks } from '../attack/resolveAttacks.js';
import { hasBenefitOfCover, modelVisible } from '../board/visibility.js';
import { modelDistance, unitsEngaged, within } from '../board/measure.js';
import type { Roller } from '../dice/roller.js';
import { type RuleError, err } from '../game/errors.js';
import {
  type GameEvent,
  type GameState,
  type ShootingType,
  withStatus,
  withUnit,
} from '../game/state.js';
import { hasKeywordId, weaponHasFlag } from '../keywords/registry.js';
import { type ModelState, type UnitState, type Weapon, aliveModels } from '../types.js';
import { engagedEnemies, isEngaged } from './validateMove.js';

export const ruleRefs = [
  'core.shooting-phase.shoot',
  'core.shooting-phase.normal-shooting',
  'core.shooting-phase.assault-shooting',
  'core.shooting-phase.close-quarters-shooting',
  'core.making-attacks.select-weapons',
  'core.making-attacks.select-targets',
];

const isBig = (u: UnitState) => u.keywords.includes('MONSTER') || u.keywords.includes('VEHICLE');

/** Shooting types the unit is eligible for (10.04 - 10.06). Indirect shooting is not simulated. */
export function eligibleShootingTypes(state: GameState, unitId: string): ShootingType[] {
  const unit = state.units[unitId];
  const st = state.status[unitId];
  if (!unit || !st || st.shot || !aliveModels(unit).some((m) => m.position)) return [];
  if (st.moved === 'fall-back') return [];
  const ranged = unit.weapons.filter((w) => w.type === 'ranged');
  const engaged = isEngaged(state, unit);
  const advanced = st.moved === 'advance';
  const out: ShootingType[] = [];
  if (!engaged && !advanced) out.push('normal');
  if (!engaged && advanced && ranged.some((w) => weaponHasFlag(w, 'assault'))) out.push('assault');
  if (
    engaged &&
    !advanced &&
    (ranged.some((w) => weaponHasFlag(w, 'close-quarters')) || isBig(unit))
  )
    out.push('close-quarters');
  return out;
}

export function weaponAllowed(unit: UnitState, weapon: Weapon, type: ShootingType): boolean {
  if (weapon.type !== 'ranged') return false;
  if (type === 'assault') return weaponHasFlag(weapon, 'assault');
  if (type === 'close-quarters' && !isBig(unit)) return weaponHasFlag(weapon, 'close-quarters');
  return true;
}

export interface ShooterGroup {
  readonly models: ModelState[];
  readonly halfRange: boolean;
  readonly cover: boolean;
}

/** Models that can fire `weapon` at `target`: visible and in range, grouped by half range and cover. */
export function shooters(
  state: GameState,
  unit: UnitState,
  weapon: Weapon,
  target: UnitState,
): ShooterGroup[] {
  const groups = new Map<string, ShooterGroup>();
  for (const m of aliveModels(unit)) {
    if (!m.weapons.includes(weapon.name) || !m.position) continue;
    const enemies = aliveModels(target).filter((t) => t.position);
    const visible = enemies.filter((t) => modelVisible(state.battlefield, m, t));
    if (visible.length === 0) continue;
    const range = weapon.range ?? 0;
    const nearest = Math.min(...enemies.map((t) => modelDistance(m, t)));
    if (!within(nearest, range)) continue;
    const halfRange = within(nearest, range / 2);
    const cover = hasBenefitOfCover(state.battlefield, m, target);
    const key = `${halfRange}:${cover}`;
    const g = groups.get(key) ?? { models: [], halfRange, cover };
    g.models.push(m);
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** Can this target be selected for this weapon (04.02)? */
export function checkTarget(
  state: GameState,
  unit: UnitState,
  weapon: Weapon,
  type: ShootingType,
  target: UnitState,
): RuleError | null {
  if (target.player === unit.player) return err('NO_TARGET', 'friendly unit');
  if (aliveModels(target).length === 0) return err('NO_TARGET', 'destroyed');
  const engagedWithUs = unitsEngaged(unit, target);
  if (type === 'close-quarters') {
    if (!isBig(unit) && !engagedWithUs)
      return err('TARGET_ENGAGED', 'close-quarters targets must be engaged with your unit');
    if (engagedWithUs && hasKeywordId(weapon, 'blast'))
      return err('WEAPON_NOT_ALLOWED', 'blast at engaged unit');
  } else if (engagedEnemies(state, target).length > 0) {
    return err('TARGET_ENGAGED', target.id);
  }
  const visibleAny = aliveModels(unit).some(
    (m) =>
      m.weapons.includes(weapon.name) &&
      m.position &&
      aliveModels(target).some((t) => modelVisible(state.battlefield, m, t)),
  );
  if (!visibleAny) return err('NOT_VISIBLE', target.id);
  if (shooters(state, unit, weapon, target).length === 0)
    return err('OUT_OF_RANGE', `${weapon.name} -> ${target.id}`);
  return null;
}

export function shoot(
  state: GameState,
  unitId: string,
  type: ShootingType,
  targets: Readonly<Record<string, string>>,
  roller: Roller,
): { state: GameState; events: GameEvent[] } | RuleError {
  const unit = state.units[unitId];
  if (!unit) return err('UNKNOWN_UNIT', unitId);
  if (!eligibleShootingTypes(state, unitId).includes(type)) return err('NOT_ELIGIBLE', type);
  const st = state.status[unitId]!;
  const entries = Object.entries(targets);
  if (entries.length === 0) return err('NO_TARGET', 'no weapons selected');

  for (const [weaponName, targetId] of entries) {
    const weapon = unit.weapons.find((w) => w.name === weaponName);
    const target = state.units[targetId];
    if (!weapon || !target) return err('NO_TARGET', `${weaponName} -> ${targetId}`);
    if (!weaponAllowed(unit, weapon, type)) return err('WEAPON_NOT_ALLOWED', weaponName);
    const problem = checkTarget(state, unit, weapon, type, target);
    if (problem) return problem;
  }

  let next = state;
  const events: GameEvent[] = [];
  const braced = !isEngaged(state, unit) && !st.setUpThisTurn && st.maxMoved <= 3;
  // Resolve target by target, weapon by weapon (04.03).
  const byTarget = new Map<string, string[]>();
  for (const [w, t] of entries) byTarget.set(t, [...(byTarget.get(t) ?? []), w]);
  for (const [targetId, weaponNames] of byTarget) {
    for (const weaponName of weaponNames) {
      const attacker = next.units[unitId]!;
      const target = next.units[targetId]!;
      if (aliveModels(target).length === 0) break;
      const weapon = attacker.weapons.find((w) => w.name === weaponName)!;
      for (const group of shooters(next, attacker, weapon, target)) {
        // Close-quarters shooting by MONSTER / VEHICLE models: -1 to hit unless a close-quarters
        // weapon targets a unit it is engaged with (10.06).
        const cqPenalty =
          type === 'close-quarters' &&
          isBig(attacker) &&
          !(weaponHasFlag(weapon, 'close-quarters') && unitsEngaged(attacker, target))
            ? -1
            : 0;
        const ctx = defaultContext(next.units[unitId]!, next.units[targetId]!, 'shooting', {
          hitModifier: cqPenalty,
          withinHalfRange: group.halfRange,
          targetHasCover: group.cover,
          attackerBraced: braced,
          attackerCharged: st.charged,
          visibleCharacterIds: aliveModels(target)
            .filter(
              (t) =>
                t.isCharacter && group.models.some((m) => modelVisible(next.battlefield, m, t)),
            )
            .map((t) => t.id),
        });
        const r = resolveAttacks(ctx, [{ weapon, count: group.models.length }], roller);
        next = withUnit(withUnit(next, r.target), r.attacker);
        events.push(...(r.events as AttackEvent[]));
      }
    }
  }
  next = withStatus(next, unitId, { shot: true });
  events.unshift({ type: 'UnitShot', unitId, shootingType: type, targetIds: [...byTarget.keys()] });
  return { state: next, events };
}
