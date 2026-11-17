/**
 * A simple deterministic opponent. It proposes candidate actions in a fixed order and keeps the first
 * one the rules engine accepts, so it can never cheat. Policy: move towards the nearest enemy, shoot
 * the closest legal target, charge when in range, always fight, pile in and consolidate when possible.
 */
import { centroid } from '../board/geometry.js';
import { unitDistance } from '../board/measure.js';
import type { GameAction } from '../game/actions.js';
import { apply } from '../game/apply.js';
import { formation, moveToward, stepModelsToward } from '../game/formation.js';
import { type GameState, opponent, unitsOf } from '../game/state.js';
import { possibleChargeTargets } from '../phases/charge.js';
import {
  canConsolidate,
  canPileIn,
  consolidationMode,
  eligibleToFight,
  fightsFirst,
  pileInTargets,
} from '../phases/fight.js';
import { eligibleMoveTypes } from '../phases/movement.js';
import { checkTarget, eligibleShootingTypes, weaponAllowed } from '../phases/shooting.js';
import { engagedEnemies } from '../phases/validateMove.js';
import { type PlayerId, type Point, type UnitState, aliveModels } from '../types.js';
import { hasDeepStrike } from '../phases/reserves.js';
import { chargePositions } from '../phases/chargeProximity.js';

const onTable = (u: UnitState) => aliveModels(u).some((m) => m.position);
const alive = (u: UnitState) => aliveModels(u).length > 0;
const toDeploy = (state: GameState, u: UnitState) =>
  alive(u) && !onTable(u) && !state.status[u.id]?.inReserves;

/** Whose decision the game is waiting for. */
export function actingPlayer(state: GameState): PlayerId | null {
  if (state.phase === 'game-over') return null;
  if (state.phase === 'deployment') {
    const pending = (p: PlayerId) => unitsOf(state, p).filter((u) => toDeploy(state, u)).length;
    const d1 = unitsOf(state, 'p1').filter(onTable).length;
    const d2 = unitsOf(state, 'p2').filter(onTable).length;
    // Alternate, first player starts; a player with nothing left to deploy passes.
    const turn: PlayerId = d1 <= d2 ? state.firstPlayer : opponent(state.firstPlayer);
    if (pending(turn) > 0) return turn;
    if (pending(opponent(turn)) > 0) return opponent(turn);
    return state.firstPlayer;
  }
  if (state.phase === 'fight') return state.fightSelector ?? state.activePlayer;
  return state.activePlayer;
}

function nearestEnemy(state: GameState, unit: UnitState): UnitState | undefined {
  return Object.values(state.units)
    .filter((o) => o.player !== unit.player && onTable(o) && alive(o))
    .sort((a, b) => unitDistance(unit, a) - unitDistance(unit, b))[0];
}

const enemyCentre = (u: UnitState): Point => centroid(aliveModels(u).map((m) => m.position!));

function deploymentCandidates(state: GameState, player: PlayerId): GameAction[] {
  const zone = state.battlefield.deploymentZones.find((z) => z.player === player);
  const unit = unitsOf(state, player).find((u) => toDeploy(state, u));
  if (!zone || !unit) return [];
  const ys = zone.polygon.map((p) => p.y);
  const yMid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const index = unitsOf(state, player).indexOf(unit);
  const xs = [0.3, 0.55, 0.75, 0.15, 0.9, 0.45].map((f) => f * state.battlefield.width);
  const out: GameAction[] = [];
  for (let k = 0; k < xs.length; k++) {
    out.push({
      type: 'deploy',
      unitId: unit.id,
      positions: formation(unit, { x: xs[(index + k) % xs.length]!, y: yMid }),
    });
  }
  return out;
}

function movementCandidates(state: GameState, player: PlayerId): GameAction[] {
  const out: GameAction[] = [];
  for (const u of unitsOf(state, player)) {
    const types = eligibleMoveTypes(state, u.id);
    if (types.length === 0) continue;
    if (types.includes('ingress')) {
      out.push(...ingressCandidates(state, u));
      continue;
    }
    if (engagedEnemies(state, u).length > 0) {
      out.push({ type: 'move', unitId: u.id, moveType: 'stationary' });
      continue;
    }
    const enemy = nearestEnemy(state, u);
    const move = Math.min(...aliveModels(u).map((m) => m.movement ?? 0));
    if (enemy && move > 0) {
      const ranged = u.weapons.filter((w) => w.type === 'ranged' && w.range);
      const keepAway = ranged.length > 0 ? Math.max(...ranged.map((w) => w.range! / 2)) : 7;
      const gap = unitDistance(u, enemy);
      if (gap > keepAway + 0.5) {
        for (const f of [1, 0.75, 0.5, 0.25])
          out.push({
            type: 'move',
            unitId: u.id,
            moveType: 'normal',
            positions: moveToward(u, enemyCentre(enemy), move * f, 0),
          });
      }
    }
    out.push({ type: 'move', unitId: u.id, moveType: 'stationary' });
  }
  return out;
}

/** Arrival spots: near the nearest enemy but legal, from the board edges (or anywhere with Deep Strike). */
function ingressCandidates(state: GameState, u: UnitState): GameAction[] {
  const { width, height } = state.battlefield;
  const spots: Point[] = [];
  for (let x = 3; x < width; x += 4) spots.push({ x, y: 3 }, { x, y: height - 3 });
  for (let y = 3; y < height; y += 4) spots.push({ x: 3, y }, { x: width - 3, y });
  if (hasDeepStrike(u))
    for (let x = 4; x < width; x += 4) for (let y = 4; y < height; y += 4) spots.push({ x, y });
  const enemies = Object.values(state.units).filter(
    (o) => o.player !== u.player && onTable(o) && alive(o),
  );
  const score = (p: Point) =>
    Math.min(
      Infinity,
      ...enemies.map((e) => Math.hypot(enemyCentre(e).x - p.x, enemyCentre(e).y - p.y)),
    );
  return spots
    .sort((a, b) => score(a) - score(b))
    .map((p) => ({ type: 'move', unitId: u.id, moveType: 'ingress', positions: formation(u, p) }));
}

function shootingCandidates(state: GameState, player: PlayerId): GameAction[] {
  const out: GameAction[] = [];
  for (const u of unitsOf(state, player)) {
    for (const type of eligibleShootingTypes(state, u.id)) {
      const targets: Record<string, string> = {};
      const enemies = Object.values(state.units)
        .filter((o) => o.player !== player && alive(o) && onTable(o))
        .sort((a, b) => unitDistance(u, a) - unitDistance(u, b));
      for (const w of u.weapons) {
        if (!weaponAllowed(u, w, type)) continue;
        const t = enemies.find((e) => checkTarget(state, u, w, type, e) === null);
        if (t) targets[w.name] = t.id;
      }
      if (Object.keys(targets).length > 0)
        out.push({ type: 'shoot', unitId: u.id, shootingType: type, targets });
    }
  }
  return out;
}

function chargeCandidates(state: GameState, player: PlayerId): GameAction[] {
  const out: GameAction[] = [];
  for (const u of unitsOf(state, player)) {
    const st = state.status[u.id]!;
    if (st.declaredCharge && !st.charged && st.chargeRoll !== null) {
      for (const t of possibleChargeTargets(state, u.id)) {
        for (const gap of [0.5, 1, 1.5]) {
          const positions = chargePositions(state, u, [t], st.chargeRoll, gap);
          if (positions)
            out.push({ type: 'chargeMove', unitId: u.id, targetIds: [t.id], positions });
        }
      }
      out.push({ type: 'skipCharge', unitId: u.id });
    }
  }
  for (const u of unitsOf(state, player)) {
    const hasMelee = u.weapons.some((w) => w.type === 'melee');
    if (hasMelee) out.push({ type: 'declareCharge', unitId: u.id });
  }
  return out;
}

function fightCandidates(state: GameState, player: PlayerId): GameAction[] {
  const out: GameAction[] = [];
  const mine = unitsOf(state, player);
  if (state.fightStep === 'pile-in') {
    for (const u of mine)
      if (canPileIn(state, u.id))
        out.push({
          type: 'pileIn',
          unitId: u.id,
          positions: stepModelsToward(state, u, pileInTargets(state, u), 3),
        });
  } else if (state.fightStep === 'fight') {
    const eligible = mine.filter((u) => eligibleToFight(state, u.id));
    const ff = eligible.filter((u) => fightsFirst(state, u.id));
    for (const u of ff.length > 0 ? ff : eligible) {
      const engaged = engagedEnemies(state, u);
      for (const t of engaged) out.push({ type: 'fight', unitId: u.id, targetId: t.id });
      if (engaged.length === 0) {
        const targets = pileInTargets(state, u);
        for (const t of targets)
          out.push({
            type: 'fight',
            unitId: u.id,
            targetId: t.id,
            pileInPositions: stepModelsToward(state, u, [t], 3),
          });
      }
    }
  } else if (state.fightStep === 'consolidate') {
    for (const u of mine) {
      if (!canConsolidate(state, u.id)) continue;
      const mode = consolidationMode(state, u)!;
      const positions =
        mode.mode === 'objective'
          ? moveToward(u, mode.objective!, 3, 0)
          : stepModelsToward(state, u, mode.targets, 3);
      out.push({ type: 'consolidate', unitId: u.id, positions });
    }
  }
  return out;
}

/** The next action for `player`, or null if the game is not waiting on them. */
export function nextAiAction(state: GameState, player: PlayerId): GameAction | null {
  if (actingPlayer(state) !== player) return null;
  const candidates: GameAction[] =
    state.phase === 'deployment'
      ? deploymentCandidates(state, player)
      : state.phase === 'movement'
        ? movementCandidates(state, player)
        : state.phase === 'shooting'
          ? shootingCandidates(state, player)
          : state.phase === 'charge'
            ? chargeCandidates(state, player)
            : state.phase === 'fight'
              ? fightCandidates(state, player)
              : [];
  for (const c of candidates) if (apply(state, c).ok) return c;
  return { type: 'endPhase' };
}
