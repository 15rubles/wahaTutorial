import type { Lesson } from '../types.js';

export const graduationLesson: Lesson = {
  id: 'graduation',
  title: '13. Graduation',
  summary: 'A short free game. Hints are there when you want them.',
  army: 'full',
  battleRounds: 2,
  units: [
    { role: 'enemyMelee', at: { x: 0, y: 0 } },
    { role: 'target', at: { x: 0, y: 0 } },
  ],
  steps: [
    {
      id: 'brief',
      ruleRefs: ['core.the-battle-round'],
      say: 'Two battle rounds, your whole army, objectives worth 5 VP at the end of each of your turns. Nothing is blocked now. Good luck!',
    },
    {
      id: 'play',
      ruleRefs: [],
      say: 'Free play. Select a unit and press "What can I do now?" for a hint. Finish both battle rounds.',
      free: true,
      expect: { kind: 'event', event: 'GameEnded' },
    },
    {
      id: 'done',
      ruleRefs: ['core.muster-armies'],
      say: 'You know the core of the game. Next steps: read your detachment rules and play a real game.',
    },
  ],
};
