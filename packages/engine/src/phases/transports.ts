import { makeHazardRolls } from '../attack/hazard.js';
import { dist } from '../board/geometry.js';
import { modelDistance } from '../board/measure.js';
import type { Roller } from '../dice/roller.js';
import { type RuleError, err } from '../game/errors.js';
import { type GameEvent, type GameState, withStatus, withUnit } from '../game/state.js';
import { type ModelState, type Point, type UnitState, aliveModels } from '../types.js';
import { ARRIVAL_ENEMY_DISTANCE } from './reserves.js';
import { engagedEnemies, validateMove } from './validateMove.js';

export const ruleRefs = [
  'core.transports.transport-capacity',
  'core.transports.embarking',
  'core.transports.disembarking',
  'core.transports.disembark-move',
  'core.transports.emergency-disembark-move',
];

/** Every model must be within this of the TRANSPORT to embark (18.02). */
export const EMBARK_DISTANCE = 3;
/** Set-up distance of a rapid or tactical disembark (18.04). */
export const DISEMBARK_DISTANCE = 3;
/** Set-up distance of an emergency disembark (18.05). */
export const EMERGENCY_DISEMBARK_DISTANCE = 6;

const onTable = (u: UnitState) => aliveModels(u).some((m) => m.position);

export const isTransport = (u: UnitState): boolean =>
  u.keywords.includes('TRANSPORT') && (u.transport?.capacity ?? 0) > 0;

/** Models embarked within a TRANSPORT right now. */
export function usedCapacity(state: GameState, transportId: string): number {
  return Object.values(state.units)
    .filter((u) => state.status[u.id]?.embarkedIn === transportId)
    .reduce((n, u) => n + aliveModels(u).length, 0);
}

/** Units embarked within a TRANSPORT. */
export const passengers = (state: GameState, transportId: string): UnitState[] =>
  Object.values(state.units).filter((u) => state.status[u.id]?.embarkedIn === transportId);

/**
 * Can `unitId` embark within `transportId` now? In deployment the unit starts embarked; in the
 * battle it embarks after a normal, advance or fall back move with every model within 3".
 * RULES-QUESTION: RQ-9 which models a TRANSPORT may carry is free text on its datasheet; only the
 * number of models is checked.
 */
export function canEmbark(state: GameState, unitId: string, transportId: string): RuleError | null {
  const unit = state.units[unitId];
  const transport = state.units[transportId];
  const st = state.status[unitId];
  if (!unit || !transport || !st) return err('UNKNOWN_UNIT', unitId);
  if (unit.id === transport.id || transport.player !== unit.player)
    return err('NOT_ELIGIBLE', 'not a friendly transport');
  if (!isTransport(transport) || aliveModels(transport).length === 0)
    return err('NOT_ELIGIBLE', 'not a transport');
  if (isTransport(unit)) return err('NOT_ELIGIBLE', 'a transport cannot embark');
  if (st.embarkedIn || st.inReserves) return err('ALREADY_ACTED', 'not on the battlefield');
  const free = (transport.transport?.capacity ?? 0) - usedCapacity(state, transportId);
  if (aliveModels(unit).length > free) return err('NO_CAPACITY', `${free} spaces left`);
  if (state.phase === 'deployment') {
    if (onTable(unit)) return err('ALREADY_ACTED', 'already deployed');
    return null;
  }
  if (state.phase !== 'movement') return err('WRONG_PHASE');
  if (!onTable(transport)) return err('NOT_ELIGIBLE', 'transport is not on the battlefield');
  if (st.moved !== 'normal' && st.moved !== 'advance' && st.moved !== 'fall-back')
    return err('NOT_ELIGIBLE', 'needs-move-first');
  if (st.setUpThisTurn) return err('NOT_ELIGIBLE', 'set up this turn');
  const hull = aliveModels(transport);
  const far = aliveModels(unit).find(
    (m) => !hull.some((t) => modelDistance(m, t) <= EMBARK_DISTANCE + 1e-9),
  );
  if (far) return err('NOT_NEAR_TRANSPORT', far.id);
  return null;
}

export function embark(
  state: GameState,
  unitId: string,
  transportId: string,
): { state: GameState; events: GameEvent[] } | RuleError {
  const problem = canEmbark(state, unitId, transportId);
  if (problem) return problem;
  const unit = state.units[unitId]!;
  let next = withUnit(state, {
    ...unit,
    models: unit.models.map((m) => (m.destroyed ? m : { ...m, position: null })),
  });
  next = withStatus(next, unitId, { embarkedIn: transportId, embarkedThisTurn: true });
  return { state: next, events: [{ type: 'UnitEmbarked', unitId, transportId }] };
}

/**
 * Disembark mode (18.04): rapid if the TRANSPORT made a normal or ingress move this phase, tactical
 * if it stayed still or has not moved yet; null if it advanced or fell back (not eligible).
 * RULES-QUESTION: RQ-10 combat disembark (when a tactical set-up is impossible) is not offered.
 */
export function disembarkMode(state: GameState, unitId: string): 'rapid' | 'tactical' | null {
  const st = state.status[unitId];
  const tid = st?.embarkedIn;
  if (!st || !tid || st.embarkedThisTurn || state.phase !== 'movement') return null;
  const transport = state.units[tid];
  const tst = state.status[tid];
  if (!transport || !tst || !onTable(transport)) return null;
  if (tst.moved === 'advance' || tst.moved === 'fall-back') return null;
  if (tst.moved === 'normal' || tst.moved === 'ingress') return 'rapid';
  return 'tactical';
}

/** Is every model wholly within `range` of one of the transport's models? */
function whollyWithin(models: readonly ModelState[], transport: UnitState, range: number): boolean {
  const hull = aliveModels(transport).filter((t) => t.position);
  return models.every((m) =>
    hull.some((t) => modelDistance(m, t) + 2 * m.baseRadius <= range + 1e-9),
  );
}

export function disembark(
  state: GameState,
  unitId: string,
  positions: readonly Point[],
): { state: GameState; events: GameEvent[] } | RuleError {
  const unit = state.units[unitId];
  const st = state.status[unitId];
  if (!unit || !st) return err('UNKNOWN_UNIT', unitId);
  const mode = disembarkMode(state, unitId);
  if (!mode) return err('NOT_ELIGIBLE', 'cannot disembark now');
  const transport = state.units[st.embarkedIn!]!;
  const result = validateMove(state, unit, positions, { maxDistance: () => null });
  if ('code' in result) return result;
  if (!whollyWithin(aliveModels(result.unit), transport, DISEMBARK_DISTANCE))
    return err('NOT_NEAR_TRANSPORT', `set up wholly within ${DISEMBARK_DISTANCE}"`);
  let next = withUnit(state, result.unit);
  if (engagedEnemies(next, result.unit).length > 0) return err('ENDS_ENGAGED');
  // A rapid disembark after an ingress move follows the transport's arrival rules (18.04.01).
  if (mode === 'rapid' && state.status[transport.id]?.moved === 'ingress') {
    for (const enemy of Object.values(state.units)) {
      if (enemy.player === unit.player) continue;
      for (const a of aliveModels(result.unit))
        for (const b of aliveModels(enemy))
          if (b.position && modelDistance(a, b) <= ARRIVAL_ENEMY_DISTANCE + 1e-9)
            return err('TOO_CLOSE_TO_ENEMY', enemy.id);
    }
  }
  next = withStatus(next, unitId, {
    embarkedIn: null,
    disembarked: mode,
    setUpThisTurn: true,
    // Rapid: the set-up was its move and it cannot charge. Tactical: it may still move.
    ...(mode === 'rapid' ? { moved: 'disembark' as const, cannotCharge: true } : {}),
  });
  return {
    state: next,
    events: [{ type: 'UnitDisembarked', unitId, transportId: transport.id, mode, lost: 0 }],
  };
}

/** Free spots for a model around the dead transport, nearest first, unengaged ones first. */
function emergencySpots(state: GameState, transport: UnitState, model: ModelState): Point[] {
  const hull = transport.models.filter((t) => t.position);
  const out: { p: Point; d: number }[] = [];
  for (const t of hull) {
    const maxRing = t.baseRadius + EMERGENCY_DISEMBARK_DISTANCE - model.baseRadius;
    for (
      let ring = t.baseRadius + model.baseRadius + 0.05;
      ring <= maxRing;
      ring += model.baseRadius
    ) {
      const steps = Math.max(8, Math.floor((2 * Math.PI * ring) / (model.baseRadius * 2)));
      for (let k = 0; k < steps; k++) {
        const a = (2 * Math.PI * k) / steps;
        out.push({
          p: { x: t.position!.x + Math.cos(a) * ring, y: t.position!.y + Math.sin(a) * ring },
          d: ring,
        });
      }
    }
  }
  return out.sort((a, b) => a.d - b.d).map((x) => x.p);
}

/**
 * Emergency disembark (18.05) for every unit inside a TRANSPORT that was just destroyed: hazard roll
 * per model, then each model is set up as close as possible within 6" (unengaged if it can), or is
 * destroyed. The unit is battle-shocked and cannot charge this turn.
 */
export function emergencyDisembark(
  state: GameState,
  transportId: string,
  roller: Roller,
): { state: GameState; events: GameEvent[] } {
  let next = state;
  const events: GameEvent[] = [];
  const transport = state.units[transportId]!;
  const { width, height } = state.battlefield;
  for (const passenger of passengers(state, transportId)) {
    const hazard = makeHazardRolls(passenger, aliveModels(passenger).length, roller);
    events.push(...(hazard.events as GameEvent[]));
    let unit = hazard.unit;
    let lost = 0;
    const placed: ModelState[] = [];
    const blocked = (p: Point, r: number) =>
      p.x - r < 0 ||
      p.y - r < 0 ||
      p.x + r > width ||
      p.y + r > height ||
      [
        ...Object.values(next.units)
          .filter((u) => u.id !== unit.id && u.id !== transportId)
          .flatMap((u) => aliveModels(u)),
        ...placed,
      ].some((o) => o.position && dist(o.position, p) < o.baseRadius + r - 0.01);
    const engagedAt = (m: ModelState) =>
      Object.values(next.units).some(
        (u) =>
          u.player !== unit.player &&
          aliveModels(u).some((e) => e.position && modelDistance(m, e) <= 2 + 1e-9),
      );
    const models = unit.models.map((m) => {
      if (m.destroyed) return m;
      const spots = emergencySpots(next, transport, m).filter((p) => !blocked(p, m.baseRadius));
      const free = spots.find((p) => !engagedAt({ ...m, position: p }));
      const spot = free ?? spots[0];
      if (!spot) {
        lost += 1;
        return { ...m, destroyed: true, woundsLeft: 0 };
      }
      const done = { ...m, position: spot };
      placed.push(done);
      return done;
    });
    unit = { ...unit, models };
    next = withUnit(next, unit);
    next = withStatus(next, unit.id, {
      embarkedIn: null,
      disembarked: 'emergency',
      battleShocked: true,
      cannotCharge: true,
      setUpThisTurn: true,
    });
    events.push({ type: 'UnitDisembarked', unitId: unit.id, transportId, mode: 'emergency', lost });
  }
  return { state: next, events };
}

/**
 * Disembark positions near `toward`: models are packed on rings around the TRANSPORT, wholly within
 * 3", nearest to the chosen point first, without overlapping other bases or ending engaged.
 * Null if not every model fits.
 */
export function disembarkPositions(
  state: GameState,
  unitId: string,
  toward: Point,
): Point[] | null {
  const unit = state.units[unitId];
  const tid = state.status[unitId]?.embarkedIn;
  const transport = tid ? state.units[tid] : undefined;
  if (!unit || !transport) return null;
  const { width, height } = state.battlefield;
  const placed: { p: Point; r: number }[] = [];
  const others = Object.values(state.units)
    .filter((u) => u.id !== unit.id)
    .flatMap((u) =>
      aliveModels(u)
        .filter((m) => m.position)
        .map((m) => ({ m, enemy: u.player !== unit.player })),
    );
  const out: Point[] = [];
  for (const m of aliveModels(unit)) {
    const r = m.baseRadius;
    const spots: Point[] = [];
    for (const t of aliveModels(transport)) {
      if (!t.position) continue;
      const max = t.baseRadius + DISEMBARK_DISTANCE - r - 0.02;
      for (let ring = t.baseRadius + r + 0.05; ring <= max; ring += r) {
        const steps = Math.max(12, Math.floor((2 * Math.PI * ring) / r));
        for (let k = 0; k < steps; k++) {
          const a = (2 * Math.PI * k) / steps;
          spots.push({
            x: t.position.x + Math.cos(a) * ring,
            y: t.position.y + Math.sin(a) * ring,
          });
        }
      }
    }
    spots.sort((a, b) => dist(a, toward) - dist(b, toward));
    const spot = spots.find(
      (p) =>
        p.x - r >= 0 &&
        p.y - r >= 0 &&
        p.x + r <= width &&
        p.y + r <= height &&
        !placed.some((q) => dist(q.p, p) < q.r + r + 0.02) &&
        !others.some(
          ({ m: o, enemy }) => dist(o.position!, p) < o.baseRadius + r + (enemy ? 2 : 0) + 0.02,
        ),
    );
    if (!spot) return null;
    placed.push({ p: spot, r });
    out.push(spot);
  }
  return out;
}
