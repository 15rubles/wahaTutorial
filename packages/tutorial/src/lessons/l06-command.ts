import type { Lesson } from '../types.js';

export const commandLesson: Lesson = {
  id: 'command',
  title: '6. Command points and stratagems',
  summary: 'The command phase, CP and the stratagems of your detachment.',
  units: [
    { role: 'shooter', at: { x: 22, y: 8 } },
    { role: 'target', at: { x: 22, y: 24 } },
  ],
  startPhase: 'command',
  startCp: 3,
  panels: ['stratagems'],
  steps: [
    {
      id: 'cp',
      ruleRefs: ['core.command-phase', 'core.command-phase.gain-core-cp'],
      say: 'Each command phase both players gain 1 command point (CP). For this drill you start with 3. Your CP total is in the bar at the top.',
      focus: [{ kind: 'element', id: 'phase-bar' }],
    },
    {
      id: 'battle-shock',
      ruleRefs: ['core.command-phase.battle-shock-step', 'core.core-concepts.battle-shock-rolls'],
      say: 'Also in the command phase: battle-shock tests for units at half strength or below. A failed test drops their OC and stops stratagems on them.',
    },
    {
      id: 'use',
      ruleRefs: ['core.stratagems', 'core.stratagems.using-stratagems'],
      say: 'Stratagems cost CP. These come from your detachment, plus the core ones every army has. Open one to read it, then use any stratagem you can afford.',
      focus: [{ kind: 'element', id: 'stratagems' }],
      allow: ['useStratagem'],
      expect: { kind: 'event', event: 'StratagemUsed' },
    },
    {
      id: 'limits',
      ruleRefs: ['core.stratagems.using-stratagems'],
      say: 'The same stratagem only once per phase, and one stratagem per unit per phase. This app tracks CP and those limits; the effect itself you apply by reading the card.',
      focus: [{ kind: 'element', id: 'stratagems' }],
    },
  ],
};
