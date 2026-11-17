import type { GameAction, GameEvent, GameState } from '@battle-drill/engine';
import type { Lesson, LessonContext, Step, UiSignal } from './types.js';

/** Where the player is in a lesson. Plain data, saved to progress. */
export interface RunnerState {
  readonly lessonId: string;
  readonly stepIndex: number;
  readonly done: boolean;
  readonly hint: string | null;
  readonly wrongCount: number;
  /** "Explain again" pressed: the UI shows the full rule text. */
  readonly explainAgain: boolean;
}

export type RunnerInput =
  | { readonly type: 'ack' }
  | { readonly type: 'ui'; readonly signal: UiSignal }
  | { readonly type: 'events'; readonly events: readonly GameEvent[]; readonly state: GameState }
  | { readonly type: 'blocked'; readonly action: GameAction | 'click' }
  | { readonly type: 'rejected'; readonly code: string }
  | { readonly type: 'skip' }
  | { readonly type: 'explainAgain' }
  | { readonly type: 'restart' };

export const startRunner = (lesson: Lesson): RunnerState => ({
  lessonId: lesson.id,
  stepIndex: 0,
  done: lesson.steps.length === 0,
  hint: null,
  wrongCount: 0,
  explainAgain: false,
});

export const currentStep = (lesson: Lesson, r: RunnerState): Step | undefined =>
  r.done ? undefined : lesson.steps[r.stepIndex];

const DEFAULT_WRONG = 'Not quite. Follow the highlighted part of the screen.';

function advance(lesson: Lesson, r: RunnerState): RunnerState {
  const next = r.stepIndex + 1;
  return {
    ...r,
    stepIndex: Math.min(next, lesson.steps.length - 1),
    done: next >= lesson.steps.length,
    hint: null,
    wrongCount: 0,
    explainAgain: false,
  };
}

function wrong(step: Step, r: RunnerState, fallback?: string): RunnerState {
  return { ...r, hint: step.onWrong ?? fallback ?? DEFAULT_WRONG, wrongCount: r.wrongCount + 1 };
}

/** Pure step runner: advances on the expected action, gives hints on anything else. */
export function runStep(
  lesson: Lesson,
  r: RunnerState,
  input: RunnerInput,
  ctx: LessonContext,
): RunnerState {
  if (input.type === 'restart') return startRunner(lesson);
  const step = currentStep(lesson, r);
  if (!step) return r;
  const expect = step.expect ?? { kind: 'ack' as const };

  switch (input.type) {
    case 'skip':
      return advance(lesson, r);
    case 'explainAgain':
      return { ...r, explainAgain: true };
    case 'ack':
      return expect.kind === 'ack' ? advance(lesson, r) : r;
    case 'ui': {
      if (expect.kind !== 'ui' || expect.signal !== input.signal.type) return r;
      if (
        expect.role &&
        input.signal.type === 'unit-selected' &&
        ctx.units[expect.role] !== input.signal.unitId
      ) {
        return wrong(step, r, 'That is not the unit this step is about.');
      }
      return advance(lesson, r);
    }
    case 'events': {
      if (expect.kind !== 'event') return r;
      const hit = input.events.some(
        (e) => e.type === expect.event && (!expect.where || expect.where(e, ctx, input.state)),
      );
      return hit ? advance(lesson, r) : r;
    }
    case 'blocked':
      return wrong(step, r);
    case 'rejected':
      return wrong(step, r);
  }
}

/** Is this engine action allowed in the current step? */
export function actionAllowed(step: Step | undefined, action: GameAction): boolean {
  if (!step) return true;
  if (!step.allow) return true;
  return step.allow.includes(action.type);
}
