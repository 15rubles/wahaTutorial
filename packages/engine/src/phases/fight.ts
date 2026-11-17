import { defaultContext } from '../attack/context.js';
import { resolveAttacks } from '../attack/resolveAttacks.js';
import { OBJECTIVE_MARKER_RADIUS, OBJECTIVE_RANGE } from '../board/battlefield.js';
import { dist, distToPolygon } from '../board/geometry.js';
import {
  inBaseContact,
  modelDistance,
  unitDistance,
  unitsEngaged,
  within,
} from '../board/measure.js';
import type { Roller } from '../dice/roller.js';
import { type RuleError, err } from '../game/errors.js';
import {
  type GameEvent,
  type GameState,
  opponent,
  unitsOf,
  withStatus,
  withUnit,
} from '../game/state.js';
import { hasKeywordId } from '../keywords/registry.js';
import {
  type ModelState,
  type PlayerId,
  type Point,
  type UnitState,
  type Weapon,
  aliveModels,
} from '../types.js';
import { engagedEnemies, isEngaged, validateMove } from './validateMove.js';

export const ruleRefs = [
  'core.fight-phase.pile-in',
  'core.fight-phase.pile-in-move',
  'core.fight-phase.fight-step',
  'core.fight-phase.normal-fight',
  'core.fight-phase.overrun-fight',
  'core.fight-phase.consolidate',
  'core.fight-phase.consolidation-move',
  'core.making-attacks.select-targets',
];

type Result = { state: GameState; events: GameEvent[] } | RuleError;

export const PILE_IN_DISTANCE = 3;
export const CONSOLIDATE_DISTANCE = 3;
export const PILE_IN_SEARCH = 5;

const onTable = (u: UnitState) => aliveModels(u).some((m) => m.position);

/** Fights First here means: charged this turn (11.04). Other sources are not simulated. */
export const fightsFirst = (state: GameState, unitId: string): boolean =>
  !!state.status[unitId]?.charged;

/** Eligible to fight (12.04): not yet fought, and engaged (now or at the start of the step) or charged. */
export function eligibleToFight(state: GameState, unitId: string): boolean {
  const u = state.units[unitId];
  const st = state.status[unitId];
  if (!u || !st || st.fought || !onTable(u)) return false;
  return st.eligibleToFight || isEngaged(state, u);
}

function closestEnemyDistance(m: ModelState, targets: readonly UnitState[]): number {
  return Math.min(...targets.flatMap((t) => aliveModels(t).map((e) => modelDistance(m, e))));
}

/** Pile-in or ongoing consolidation shape shared by both moves. */
function closingMove(
  state: GameState,
  unit: UnitState,
  targets: readonly UnitState[],
  positions: readonly Point[],
  maxDistance: number,
): { unit: UnitState; moved: number } | RuleError {
  const before = aliveModels(unit);
  const frozen = new Set(
    before
      .filter((m) =>
        Object.values(state.units).some(
          (o) => o.player !== unit.player && aliveModels(o).some((e) => inBaseContact(m, e)),
        ),
      )
      .map((m) => m.id),
  );
  const result = validateMove(state, unit, positions, {
    maxDistance: () => maxDistance,
    frozen: (m) => frozen.has(m.id),
  });
  if ('code' in result) return result;
  const after = aliveModels(result.unit);
  for (let i = 0; i < before.length; i++) {
    const a = before[i]!;
    const b = after[i]!;
    if (!a.position || !b.position || dist(a.position, b.position) < 1e-6) continue;
    if (closestEnemyDistance(b, targets) >= closestEnemyDistance(a, targets) - 1e-6)
      return err('NOT_CLOSER', b.id);
  }
  // Models that began this move in combat with a unit have to stay in combat with it.
  for (let i = 0; i < before.length; i++) {
    for (const t of targets) {
      const was = aliveModels(t).some((e) => within(modelDistance(before[i]!, e), 2));
      const is = aliveModels(t).some((e) => within(modelDistance(after[i]!, e), 2));
      if (was && !is) return err('MUST_BE_ENGAGED', `${after[i]!.id} left ${t.id}`);
    }
  }
  return result;
}

export function pileInTargets(state: GameState, unit: UnitState): UnitState[] {
  const engaged = engagedEnemies(state, unit);
  if (engaged.length > 0) return engaged;
  return Object.values(state.units).filter(
    (o) => o.player !== unit.player && onTable(o) && within(unitDistance(unit, o), PILE_IN_SEARCH),
  );
}

export function canPileIn(state: GameState, unitId: string): boolean {
  const u = state.units[unitId];
  const st = state.status[unitId];
  if (!u || !st || st.piledIn || !onTable(u)) return false;
  return isEngaged(state, u) || st.charged;
}

/** Pile-in move (12.03): up to 3", closer to the closest pile-in target, unit engaged afterwards. */
export function pileIn(
  state: GameState,
  unitId: string,
  positions: readonly Point[],
  allowRepeat = false,
): Result {
  const unit = state.units[unitId];
  if (!unit) return err('UNKNOWN_UNIT', unitId);
  if (!allowRepeat && !canPileIn(state, unitId)) return err('NOT_ELIGIBLE', 'pile in');
  const targets = pileInTargets(state, unit);
  if (targets.length === 0) return err('NO_TARGET', 'no enemy within 5');
  const result = closingMove(state, unit, targets, positions, PILE_IN_DISTANCE);
  if ('code' in result) return result;
  const next = withUnit(state, result.unit);
  if (!isEngaged(next, result.unit)) return err('MUST_BE_ENGAGED');
  const st = state.status[unitId]!;
  return {
    state: withStatus(next, unitId, {
      piledIn: true,
      maxMoved: Math.max(st.maxMoved, result.moved),
    }),
    events: [{ type: 'PiledIn', unitId }],
  };
}

/**
 * Who selects the next unit to fight (12.04). Fights First units go first, alternating from the
 * player whose turn it is; then the remaining units alternate. Returns null when nobody can fight.
 */
export function nextFightSelector(state: GameState, last: PlayerId | null): PlayerId | null {
  const eligible = (p: PlayerId) => unitsOf(state, p).filter((u) => eligibleToFight(state, u.id));
  const ff = (p: PlayerId) => eligible(p).filter((u) => fightsFirst(state, u.id));
  const first = last ? opponent(last) : state.activePlayer;
  if (ff('p1').length + ff('p2').length > 0) return ff(first).length > 0 ? first : opponent(first);
  if (eligible(first).length > 0) return first;
  if (eligible(opponent(first)).length > 0) return opponent(first);
  return null;
}

function meleeLoadout(unit: UnitState, model: ModelState, chosen?: string): Weapon[] {
  const melee = unit.weapons.filter((w) => w.type === 'melee' && model.weapons.includes(w.name));
  const extra = melee.filter((w) => hasKeywordId(w, 'extra-attacks'));
  const normal = melee.filter((w) => !hasKeywordId(w, 'extra-attacks'));
  const pick = normal.find((w) => w.name === chosen) ?? normal[0];
  return [...(pick ? [pick] : []), ...extra];
}

export function fight(
  state: GameState,
  unitId: string,
  targetId: string,
  weaponName: string | undefined,
  pileInPositions: readonly Point[] | undefined,
  roller: Roller,
): Result {
  let next = state;
  const events: GameEvent[] = [];
  const unit = state.units[unitId];
  if (!unit) return err('UNKNOWN_UNIT', unitId);
  if (state.fightSelector !== unit.player)
    return err('NOT_ACTIVE_PLAYER', 'other player selects next');
  if (!eligibleToFight(state, unitId)) return err('NOT_ELIGIBLE', 'fight');
  const anyFF = unitsOf(state, unit.player).some(
    (u) => eligibleToFight(state, u.id) && fightsFirst(state, u.id),
  );
  if (anyFF && !fightsFirst(state, unitId))
    return err('NOT_ELIGIBLE', 'fights first units must fight first');

  // Overrun fight (12.06): an unengaged unit makes an additional pile-in move first.
  if (!isEngaged(state, unit)) {
    if (!pileInPositions) return err('MUST_BE_ENGAGED', 'overrun fight needs a pile-in move');
    const p = pileIn(next, unitId, pileInPositions, true);
    if ('code' in p) return p;
    next = p.state;
    events.push(...p.events);
  }

  const attacker = next.units[unitId]!;
  const target = next.units[targetId];
  if (!target || target.player === attacker.player) return err('NO_TARGET', targetId);
  if (!unitsEngaged(attacker, target)) return err('NO_TARGET', 'target must be engaged');

  // Only models engaged with the target attack it (04.02).
  const counts = new Map<string, { weapon: Weapon; count: number }>();
  for (const m of aliveModels(attacker)) {
    if (!aliveModels(target).some((e) => within(modelDistance(m, e), 2))) continue;
    for (const w of meleeLoadout(attacker, m, weaponName)) {
      const c = counts.get(w.name) ?? { weapon: w, count: 0 };
      c.count += 1;
      counts.set(w.name, c);
    }
  }
  const st = next.status[unitId]!;
  const ctx = defaultContext(attacker, target, 'fight', {
    attackerCharged: st.charged,
    visibleCharacterIds: aliveModels(target)
      .filter((t) => t.isCharacter)
      .map((t) => t.id),
  });
  const r = resolveAttacks(ctx, [...counts.values()], roller);
  next = withUnit(withUnit(next, r.target), r.attacker);
  next = withStatus(next, unitId, { fought: true, eligibleToFight: true });
  events.push({ type: 'UnitFought', unitId, targetIds: [targetId] }, ...r.events);
  return { state: { ...next, fightSelector: nextFightSelector(next, unit.player) }, events };
}

export type ConsolidationMode = 'ongoing' | 'engaging' | 'objective';

export function consolidationMode(
  state: GameState,
  unit: UnitState,
): { mode: ConsolidationMode; targets: UnitState[]; objective?: Point } | null {
  const engaged = engagedEnemies(state, unit);
  if (engaged.length > 0) return { mode: 'ongoing', targets: engaged };
  const near = Object.values(state.units).filter(
    (o) =>
      o.player !== unit.player && onTable(o) && within(unitDistance(unit, o), CONSOLIDATE_DISTANCE),
  );
  if (near.length > 0) return { mode: 'engaging', targets: near };
  for (const obj of state.battlefield.objectives) {
    const d = Math.min(
      ...aliveModels(unit).map((m) =>
        m.position ? objectiveDistance(state, obj.position, obj.terrainAreaId, m) : Infinity,
      ),
    );
    if (within(d, CONSOLIDATE_DISTANCE))
      return { mode: 'objective', targets: [], objective: obj.position };
  }
  return null;
}

export function objectiveDistance(
  state: GameState,
  position: Point,
  terrainAreaId: string | undefined,
  m: ModelState,
): number {
  if (!m.position) return Infinity;
  const area = terrainAreaId
    ? state.battlefield.terrain.find((t) => t.id === terrainAreaId)
    : undefined;
  if (area) return Math.max(0, distToPolygon(m.position, area.polygon) - m.baseRadius);
  return Math.max(0, dist(m.position, position) - m.baseRadius - OBJECTIVE_MARKER_RADIUS);
}

export function canConsolidate(state: GameState, unitId: string): boolean {
  const u = state.units[unitId];
  const st = state.status[unitId];
  return (
    !!u &&
    !!st &&
    onTable(u) &&
    !st.consolidated &&
    st.eligibleToFight &&
    consolidationMode(state, u) !== null
  );
}

/** Consolidation move (12.08): up to 3", mode decided by what is nearby. */
export function consolidate(state: GameState, unitId: string, positions: readonly Point[]): Result {
  const unit = state.units[unitId];
  if (!unit) return err('UNKNOWN_UNIT', unitId);
  if (!canConsolidate(state, unitId)) return err('NOT_ELIGIBLE', 'consolidate');
  const mode = consolidationMode(state, unit)!;
  let moved: { unit: UnitState; moved: number } | RuleError;
  if (mode.mode === 'objective') {
    const obj = state.battlefield.objectives.find((o) => o.position === mode.objective)!;
    moved = validateMove(state, unit, positions, { maxDistance: () => CONSOLIDATE_DISTANCE });
    if (!('code' in moved)) {
      const before = aliveModels(unit);
      const after = aliveModels(moved.unit);
      for (let i = 0; i < before.length; i++) {
        const a = objectiveDistance(state, obj.position, obj.terrainAreaId, before[i]!);
        const b = objectiveDistance(state, obj.position, obj.terrainAreaId, after[i]!);
        if (
          dist(before[i]!.position!, after[i]!.position!) > 1e-6 &&
          !within(b, OBJECTIVE_RANGE) &&
          b >= a - 1e-6
        )
          return err('NOT_CLOSER', after[i]!.id);
      }
    }
  } else {
    moved = closingMove(state, unit, mode.targets, positions, CONSOLIDATE_DISTANCE);
  }
  if ('code' in moved) return moved;
  const st = state.status[unitId]!;
  return {
    state: withStatus(withUnit(state, moved.unit), unitId, {
      consolidated: true,
      maxMoved: Math.max(st.maxMoved, moved.moved),
    }),
    events: [{ type: 'Consolidated', unitId }],
  };
}
