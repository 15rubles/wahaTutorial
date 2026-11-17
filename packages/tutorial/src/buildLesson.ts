import {
  type GameState,
  type UnitState,
  actingPlayer,
  nextAiAction,
  apply,
  createGame,
  formation,
  trainingGround,
  unitDistance,
} from '@battle-drill/engine';
import { pickRoles, standIn } from './roles.js';
import type { Lesson, LessonContext, Role } from './types.js';

const ENEMY_ROLES: readonly Role[] = ['target', 'enemyMelee'];

/**
 * Builds a lesson's game: the player's units for each role (or stand-ins), placed where the lesson
 * says, starting at the lesson's phase in round 1. Deterministic for a given army and lesson.
 */
export function buildLessonGame(
  lesson: Lesson,
  army: readonly UnitState[],
): { state: GameState; ctx: LessonContext } {
  if (lesson.army === 'full') return buildFullArmyGame(lesson, army);
  const playerRoles = lesson.units.map((u) => u.role).filter((r) => !ENEMY_ROLES.includes(r));
  const { picked, fallbacks } = pickRoles(army, playerRoles);
  const units: UnitState[] = [];
  const ids: Partial<Record<Role, string>> = {};
  const names: Partial<Record<Role, string>> = {};
  const missing: Role[] = [];

  for (const spec of lesson.units) {
    const base = ENEMY_ROLES.includes(spec.role)
      ? standIn(spec.role, spec.role)
      : picked[spec.role];
    const unit = base ?? standIn(spec.role, `stand-in-${spec.role}`);
    if (!base) missing.push(spec.role);
    const id = ENEMY_ROLES.includes(spec.role) ? spec.role : `${spec.role}-${unit.id}`;
    const fresh = {
      ...unit,
      id,
      player: ENEMY_ROLES.includes(spec.role) ? ('p2' as const) : ('p1' as const),
      models: unit.models.map((m, i) => ({
        ...m,
        id: `${id}-m${i + 1}`,
        position: null,
        destroyed: false,
        woundsLeft: m.wounds,
      })),
    };
    let positions = formation(fresh, spec.at);
    const other = spec.near ? units.find((u) => u.id === ids[spec.near!.role]) : undefined;
    if (spec.near && other) positions = placeNear(fresh, other, spec.at.x, spec.near.gap);
    units.push({
      ...fresh,
      models: fresh.models.map((m, i) => ({ ...m, position: positions[i]! })),
    });
    ids[spec.role] = id;
    names[spec.role] = fresh.name;
  }

  let state = createGame({
    seed: lesson.seed ?? 11,
    battlefield: { ...trainingGround(), deploymentZones: [] },
    units,
    playerNames: { p1: 'You', p2: 'Drill opponent' },
  });
  // Leave deployment (units are already placed) and walk to the lesson's starting phase.
  const go = () => {
    const r = apply(state, { type: 'endPhase' });
    if (!r.ok) throw new Error(`Lesson ${lesson.id}: ${r.error.code}`);
    state = r.state;
  };
  go();
  const target = lesson.startPhase ?? 'command';
  for (let i = 0; i < 10 && state.phase !== target; i++) go();
  state = withCp(state, lesson.startCp);
  return { state, ctx: { units: ids, names, fallbacks: [...new Set([...fallbacks, ...missing])] } };
}

/** Formation below `other` (larger y) whose closest models are `gap` inches apart, edge to edge. */
function placeNear(unit: UnitState, other: UnitState, x: number, gap: number) {
  const otherY = Math.max(...other.models.map((m) => (m.position?.y ?? 0) + m.baseRadius));
  let lo = otherY;
  let hi = otherY + 30;
  let best = formation(unit, { x, y: hi });
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const ps = formation(unit, { x, y: mid });
    const placed = { ...unit, models: unit.models.map((m, j) => ({ ...m, position: ps[j]! })) };
    const d = unitDistance(placed, other);
    if (d < gap) lo = mid;
    else {
      hi = mid;
      best = ps;
    }
  }
  return best;
}

function withCp(state: GameState, cp: number | undefined): GameState {
  if (cp === undefined) return state;
  return {
    ...state,
    players: { p1: { ...state.players.p1, cp }, p2: { ...state.players.p2, cp } },
  };
}

/** The whole army against invented enemies on the training ground, from deployment. */
function buildFullArmyGame(
  lesson: Lesson,
  army: readonly UnitState[],
): { state: GameState; ctx: LessonContext } {
  const own =
    army.length > 0
      ? army
      : [standIn('shooter', 'stand-in-shooter'), standIn('melee', 'stand-in-melee')];
  const units: UnitState[] = own.map((u) => ({
    ...u,
    id: `p1-${u.id}`,
    player: 'p1' as const,
    models: u.models.map((m, i) => ({
      ...m,
      id: `p1-${u.id}-m${i + 1}`,
      position: null,
      destroyed: false,
      woundsLeft: m.wounds,
    })),
  }));
  const ids: Partial<Record<Role, string>> = {};
  const names: Partial<Record<Role, string>> = {};
  for (const spec of lesson.units) {
    const enemy = standIn(spec.role, spec.role);
    units.push({ ...enemy, player: 'p2' });
    ids[spec.role] = spec.role;
    names[spec.role] = enemy.name;
  }
  const { picked } = pickRoles(
    units.filter((u) => u.player === 'p1'),
    ['character', 'fast', 'shooter', 'melee'],
  );
  for (const [role, u] of Object.entries(picked)) {
    ids[role as Role] = u.id;
    names[role as Role] = u.name;
  }
  let state = createGame({
    seed: lesson.seed ?? 21,
    battlefield: trainingGround(),
    units,
    mission: { battleRounds: lesson.battleRounds ?? 1 },
    playerNames: { p1: 'You', p2: 'Drill opponent' },
  });
  if (!lesson.deployment) state = autoDeploy(state);
  state = withCp(state, lesson.startCp);
  return {
    state,
    ctx: { units: ids, names, fallbacks: army.length > 0 ? [] : ['shooter', 'melee'] },
  };
}

/** Both sides deploy with the scripted deployment, then the battle starts. */
export function autoDeploy(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 200 && s.phase === 'deployment'; i++) {
    const player = actingPlayer(s);
    const action = player ? nextAiAction(s, player) : null;
    if (!action) break;
    const r = apply(s, action);
    if (!r.ok) break;
    s = r.state;
  }
  return s;
}

/** Replaces `{role}` tokens with the unit names from the lesson context. */
export function fillText(text: string, ctx: LessonContext): string {
  return text.replace(/\{(\w+)\}/g, (all, role: string) => ctx.names[role as Role] ?? all);
}
