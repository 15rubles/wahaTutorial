import { apply, translate } from '@battle-drill/engine';
import { describe, expect, it } from 'vitest';
import { buildLessonGame, fillText } from './buildLesson.js';
import { demoLesson } from './lessons/demo.js';
import { completeLesson, parseProgress, saveStep } from './progress.js';
import { pickRoles, standIn } from './roles.js';
import { actionAllowed, currentStep, runStep, startRunner } from './runner.js';
import { fixtureArmy, fixtureAttachedArmy } from './testing.js';

describe('roles', () => {
  it('picks distinct units from the army by role', () => {
    const { picked, fallbacks } = pickRoles(fixtureArmy(), [
      'character',
      'shooter',
      'melee',
      'fast',
    ]);
    expect(fallbacks).toEqual([]);
    expect(picked.character?.name).toBe('Pilgrim Scrapwarden');
    expect(picked.fast?.name).toBe('Cinder Lancers');
    expect(new Set(Object.values(picked).map((u) => u!.id)).size).toBe(4);
  });

  it('falls back to invented stand-ins and says so', () => {
    const { fallbacks } = pickRoles([], ['shooter', 'character']);
    expect(fallbacks.sort()).toEqual(['character', 'shooter']);
    expect(standIn('character', 'x').keywords).toContain('CHARACTER');
    const { ctx } = buildLessonGame(demoLesson, []);
    expect(ctx.fallbacks).toEqual(['shooter']);
    expect(ctx.names.shooter).toContain('stand-in');
  });
});

describe('lesson game', () => {
  it('places the roles and starts in the lesson phase', () => {
    const { state, ctx } = buildLessonGame(demoLesson, fixtureArmy());
    expect([state.phase, state.battleRound, state.activePlayer]).toEqual(['command', 1, 'p1']);
    expect(state.units[ctx.units.shooter!]?.player).toBe('p1');
    expect(state.units[ctx.units.target!]?.player).toBe('p2');
    expect(fillText('Your {shooter} vs {target}', ctx)).toBe(
      `Your ${ctx.names.shooter} vs Practice Dummies`,
    );
    expect(fillText('{unknown}', ctx)).toBe('{unknown}');
  });
});

describe('runner', () => {
  const { state, ctx } = buildLessonGame(demoLesson, fixtureArmy());

  it('runs the demo lesson end to end', () => {
    let r = startRunner(demoLesson);
    expect(currentStep(demoLesson, r)?.id).toBe('select');
    r = runStep(
      demoLesson,
      r,
      { type: 'ui', signal: { type: 'unit-selected', unitId: ctx.units.target! } },
      ctx,
    );
    expect(r.stepIndex).toBe(0);
    expect(r.hint).toBeTruthy();
    r = runStep(
      demoLesson,
      r,
      { type: 'ui', signal: { type: 'unit-selected', unitId: ctx.units.shooter! } },
      ctx,
    );
    expect(currentStep(demoLesson, r)?.id).toBe('end-command');
    expect(r.hint).toBeNull();

    const step = currentStep(demoLesson, r)!;
    expect(actionAllowed(step, { type: 'move', unitId: 'x', moveType: 'stationary' })).toBe(false);
    expect(actionAllowed(step, { type: 'endPhase' })).toBe(true);
    const ended = apply(state, { type: 'endPhase' });
    if (!ended.ok) throw new Error('endPhase');
    r = runStep(demoLesson, r, { type: 'events', events: ended.events, state: ended.state }, ctx);
    expect(currentStep(demoLesson, r)?.id).toBe('move');

    const shooter = ended.state.units[ctx.units.shooter!]!;
    const moved = apply(ended.state, {
      type: 'move',
      unitId: shooter.id,
      moveType: 'normal',
      positions: translate(shooter, { x: 0, y: 3 }),
    });
    if (!moved.ok) throw new Error(moved.error.code);
    r = runStep(demoLesson, r, { type: 'events', events: moved.events, state: moved.state }, ctx);
    expect(r.done).toBe(true);
  });

  it('gives hints, explains again, skips and restarts', () => {
    let r = startRunner(demoLesson);
    r = runStep(demoLesson, r, { type: 'blocked', action: 'click' }, ctx);
    expect(r.hint).toContain('{shooter}');
    expect(r.wrongCount).toBe(1);
    r = runStep(demoLesson, r, { type: 'explainAgain' }, ctx);
    expect(r.explainAgain).toBe(true);
    r = runStep(demoLesson, r, { type: 'ack' }, ctx);
    expect(r.stepIndex).toBe(0); // ack does not finish a ui step
    r = runStep(demoLesson, r, { type: 'skip' }, ctx);
    expect(r.stepIndex).toBe(1);
    expect(r.explainAgain).toBe(false);
    r = runStep(demoLesson, r, { type: 'restart' }, ctx);
    expect(r.stepIndex).toBe(0);
  });
});

describe('progress', () => {
  it('survives bad storage values', () => {
    expect(parseProgress(null).completed).toEqual([]);
    expect(parseProgress('{not json').completed).toEqual([]);
    expect(parseProgress('{"completed":[1,"demo"],"current":{"lessonId":3}}')).toEqual({
      completed: ['demo'],
      current: undefined,
    });
    const p = completeLesson(saveStep({ completed: [] }, 'demo', 2), 'demo');
    expect(parseProgress(JSON.stringify(p))).toEqual({ completed: ['demo'] });
  });
});

describe('campaign lessons', () => {
  it('place engaged units for the melee lesson', async () => {
    const { meleeLesson } = await import('./lessons/l02-melee.js');
    const { eligibleToFight } = await import('@battle-drill/engine');
    const { state, ctx } = buildLessonGame(meleeLesson, fixtureArmy());
    expect(state.phase).toBe('fight');
    expect(eligibleToFight(state, ctx.units.character!)).toBe(true);
  });

  it('start full army lessons in deployment, or deployed', async () => {
    const { battleRoundLesson } = await import('./lessons/l11-battle-round.js');
    const { graduationLesson } = await import('./lessons/l12-graduation.js');
    const a = buildLessonGame(battleRoundLesson, fixtureArmy());
    expect(a.state.phase).toBe('deployment');
    expect(Object.values(a.state.units).filter((u) => u.player === 'p1')).toHaveLength(5);
    const b = buildLessonGame(graduationLesson, fixtureArmy());
    expect([b.state.phase, b.state.battleRound, b.state.mission.battleRounds]).toEqual([
      'command',
      1,
      2,
    ]);
  });

  it('every lesson builds with an empty army (stand-ins)', async () => {
    const { LESSONS } = await import('./lessons/index.js');
    for (const lesson of LESSONS) expect(() => buildLessonGame(lesson, [])).not.toThrow();
  });

  it('use an attached unit for the leaders lesson', async () => {
    const { attachedLesson } = await import('./lessons/l09-attached.js');
    const { state, ctx } = buildLessonGame(attachedLesson, fixtureArmy(), fixtureAttachedArmy());
    const unit = state.units[ctx.units.leader!]!;
    expect(ctx.fallbacks).toEqual([]);
    expect(unit.components?.map((c) => c.name)).toEqual([
      'Rustbound Devotees',
      'Pilgrim Scrapwarden',
    ]);
    // Component model ids follow the lesson's renumbering.
    const ids = new Set(unit.models.map((m) => m.id));
    expect(unit.components!.every((c) => c.modelIds.every((id) => ids.has(id)))).toBe(true);
    expect(fillText('{leader.leaderName} leads {leader.bodyguard}', ctx)).toBe(
      'Pilgrim Scrapwarden leads Rustbound Devotees',
    );
    // Without an attached unit in the army, an invented pair stands in.
    const fallback = buildLessonGame(attachedLesson, fixtureArmy());
    expect(fallback.ctx.fallbacks).toEqual(['leader']);
  });

  it('start the reserves lesson in round 2 with the Deep Strike unit off the board', async () => {
    const { reservesLesson } = await import('./lessons/l10-reserves.js');
    const { state, ctx } = buildLessonGame(reservesLesson, fixtureArmy());
    expect([state.phase, state.battleRound, state.activePlayer]).toEqual(['movement', 2, 'p1']);
    expect(ctx.names.deepStriker).toBe('Gutter Marksman');
    expect(state.status[ctx.units.deepStriker!]!.inReserves).toBe(true);
    expect(fillText('{deepStriker.arrival}', ctx)).toContain('Deep Strike');
    const r = apply(state, {
      type: 'move',
      unitId: ctx.units.deepStriker!,
      moveType: 'ingress',
      positions: [{ x: 22, y: 6 }],
    });
    expect(r.ok).toBe(true);
  });

  it('fill unit facts from the player units', () => {
    const { ctx } = buildLessonGame(demoLesson, fixtureArmy());
    expect(fillText('{shooter.weaponAbilities}', ctx)).not.toContain('{');
    expect(fillText('{shooter.nonsense}', ctx)).toBe('{shooter.nonsense}');
  });
});
