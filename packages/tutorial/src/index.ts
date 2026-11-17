/**
 * Tutorial lessons and the step runner. Pure TypeScript.
 * Steps reference rules by RuleSection id only; rule text comes from the local cache at runtime.
 */
export * from './types.js';
export { pickRoles, standIn } from './roles.js';
export { buildLessonGame, fillText, autoDeploy } from './buildLesson.js';
export {
  runStep,
  startRunner,
  currentStep,
  actionAllowed,
  type RunnerState,
  type RunnerInput,
} from './runner.js';
export * from './progress.js';
export { demoLesson } from './lessons/demo.js';
export { LESSONS, lessonById } from './lessons/index.js';
