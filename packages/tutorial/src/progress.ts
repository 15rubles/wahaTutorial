/** Lesson progress. Pure helpers; the web app stores it in localStorage. */
export interface Progress {
  readonly completed: readonly string[];
  readonly current?: { readonly lessonId: string; readonly stepIndex: number } | undefined;
}

export const emptyProgress = (): Progress => ({ completed: [] });

export function completeLesson(p: Progress, lessonId: string): Progress {
  return {
    completed: p.completed.includes(lessonId) ? p.completed : [...p.completed, lessonId],
    current: undefined,
  };
}

export function saveStep(p: Progress, lessonId: string, stepIndex: number): Progress {
  return { ...p, current: { lessonId, stepIndex } };
}

export function parseProgress(raw: string | null): Progress {
  if (!raw) return emptyProgress();
  try {
    const v = JSON.parse(raw) as Partial<Progress>;
    return {
      completed: Array.isArray(v.completed)
        ? v.completed.filter((x): x is string => typeof x === 'string')
        : [],
      current:
        v.current &&
        typeof v.current.lessonId === 'string' &&
        typeof v.current.stepIndex === 'number'
          ? v.current
          : undefined,
    };
  } catch {
    return emptyProgress();
  }
}
