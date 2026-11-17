import type { Lesson } from '../types.js';

export const armyRulesLesson: Lesson = {
  id: 'army-rules',
  title: '8. Army rule, detachment and enhancements',
  summary: 'What your faction, detachment and enhancements add.',
  units: [
    { role: 'character', at: { x: 22, y: 8 } },
    { role: 'target', at: { x: 22, y: 24 } },
  ],
  panels: ['army-rules'],
  steps: [
    {
      id: 'army-rule',
      ruleRefs: ['core.other-rules-and-abilities.faction-abilities'],
      say: 'Your army rule (faction ability) applies to every unit with your faction keyword. Read it here.',
      focus: [{ kind: 'element', id: 'army-rule' }],
    },
    {
      id: 'detachment',
      ruleRefs: ['core.muster-armies'],
      say: 'Your detachment adds another rule, its own stratagems and a list of enhancements. You pick it when you build your army.',
      focus: [{ kind: 'element', id: 'detachment-rule' }],
    },
    {
      id: 'enhancements',
      ruleRefs: ['core.muster-armies'],
      say: 'Enhancements are upgrades for your CHARACTER models, paid for in points. Taken ones are marked.',
      focus: [{ kind: 'element', id: 'enhancements' }],
    },
    {
      id: 'leader',
      ruleRefs: ['core.core-abilities.leader-support'],
      say: 'Many characters can lead a bodyguard unit. Select your {character} and check its abilities for which units it can lead.',
      focus: [{ kind: 'unit', role: 'character' }],
      expect: { kind: 'ui', signal: 'unit-selected', role: 'character' },
    },
  ],
};
