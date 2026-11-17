/**
 * Tutorial lessons and the step runner. Pure TypeScript.
 * Steps reference rules by RuleSection id only. Rule text is never stored here,
 * it is pulled from the local data cache at runtime.
 */
import type { GameState } from '@battle-drill/engine';

export type RuleRef = string;

/** Skeleton of the Step type. Fleshed out in M8. */
export interface Step {
  readonly id: string;
  readonly ruleRefs: readonly RuleRef[];
  /** Our own short explanation in plain words. Never copied rules text. */
  readonly say: string;
  readonly setup?: (state: GameState) => GameState;
}

export interface Lesson {
  readonly id: string;
  readonly title: string;
  readonly steps: readonly Step[];
}

export function lessonStepIds(lesson: Lesson): string[] {
  return lesson.steps.map((step) => step.id);
}
