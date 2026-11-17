import {
  type GameState,
  type UnitState,
  apply,
  createGame,
  formation,
  trainingGround,
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
    const positions = formation(fresh, spec.at);
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
  return { state, ctx: { units: ids, names, fallbacks: [...new Set([...fallbacks, ...missing])] } };
}

/** Replaces `{role}` tokens with the unit names from the lesson context. */
export function fillText(text: string, ctx: LessonContext): string {
  return text.replace(/\{(\w+)\}/g, (all, role: string) => ctx.names[role as Role] ?? all);
}
