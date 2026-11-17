import {
  type Lesson,
  type LessonContext,
  type Progress,
  type RunnerInput,
  type RunnerState,
  completeLesson,
  emptyProgress,
  parseProgress,
  runStep,
  saveStep,
  startRunner,
} from '@battle-drill/tutorial';
import { create } from 'zustand';

const KEY = 'battle-drill.tutorial';

function loadProgress(): Progress {
  try {
    return parseProgress(window.localStorage.getItem(KEY));
  } catch {
    return emptyProgress();
  }
}

function storeProgress(p: Progress): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Progress is a convenience; losing it is not fatal.
  }
}

interface TutorialState {
  lesson: Lesson | null;
  ctx: LessonContext | null;
  runner: RunnerState | null;
  progress: Progress;
  begin(lesson: Lesson, ctx: LessonContext, resumeAt?: number): void;
  input(i: RunnerInput): void;
  exit(): void;
}

export const useTutorial = create<TutorialState>((set, get) => ({
  lesson: null,
  ctx: null,
  runner: null,
  progress: loadProgress(),
  begin(lesson, ctx, resumeAt) {
    const runner = {
      ...startRunner(lesson),
      stepIndex: Math.min(resumeAt ?? 0, Math.max(0, lesson.steps.length - 1)),
    };
    set({ lesson, ctx, runner });
  },
  input(i) {
    const { lesson, ctx, runner, progress } = get();
    if (!lesson || !ctx || !runner) return;
    const next = runStep(lesson, runner, i, ctx);
    if (next === runner) return;
    let p = progress;
    if (next.done && !runner.done) p = completeLesson(progress, lesson.id);
    else if (next.stepIndex !== runner.stepIndex) p = saveStep(progress, lesson.id, next.stepIndex);
    if (p !== progress) storeProgress(p);
    set({ runner: next, progress: p });
  },
  exit() {
    set({ lesson: null, ctx: null, runner: null });
  },
}));
