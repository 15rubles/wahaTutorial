import { apply, translate } from '@battle-drill/engine';
import { describe, expect, it } from 'vitest';
import { buildLessonGame, fillText } from './buildLesson.js';
import { demoLesson } from './lessons/demo.js';
import { completeLesson, parseProgress, saveStep } from './progress.js';
import { pickRoles, standIn } from './roles.js';
import { actionAllowed, currentStep, runStep, startRunner } from './runner.js';
import { fixtureArmy } from './testing.js';

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
