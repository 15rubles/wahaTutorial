import type { Lesson } from '../types.js';
import { demoLesson } from './demo.js';

/** The campaign, in order. M9 fills this in. */
export const LESSONS: readonly Lesson[] = [demoLesson];

export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);
