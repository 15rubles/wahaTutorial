import type { Lesson } from '../types.js';
import { demoLesson } from './demo.js';
import { datasheetLesson } from './l01-datasheet.js';
import { meleeLesson } from './l02-melee.js';
import { shootingLesson } from './l03-shooting.js';
import { movementLesson } from './l04-movement.js';
import { chargeLesson } from './l05-charge.js';
import { commandLesson } from './l06-command.js';
import { objectivesLesson } from './l07-objectives.js';
import { armyRulesLesson } from './l08-army-rules.js';
import { attachedLesson } from './l09-attached.js';
import { reservesLesson } from './l10-reserves.js';
import { transportsLesson } from './l11-transports.js';
import { battleRoundLesson } from './l12-battle-round.js';
import { graduationLesson } from './l13-graduation.js';

/** The campaign, in order. */
export const LESSONS: readonly Lesson[] = [
  datasheetLesson,
  meleeLesson,
  shootingLesson,
  movementLesson,
  chargeLesson,
  commandLesson,
  objectivesLesson,
  armyRulesLesson,
  attachedLesson,
  reservesLesson,
  transportsLesson,
  battleRoundLesson,
  graduationLesson,
];

/** The M8 framework demo stays reachable at #/learn/demo. */
const ALL: readonly Lesson[] = [...LESSONS, demoLesson];

export const lessonById = (id: string): Lesson | undefined => ALL.find((l) => l.id === id);
