import type { Lesson } from '../types.js';

export const reservesLesson: Lesson = {
  id: 'reserves',
  title: '10. Reserves and Deep Strike',
  summary: 'Keeping a unit off the board, and bringing it in later where the enemy is weak.',
  units: [
    { role: 'deepStriker', at: { x: 0, y: 0 }, reserves: true },
    { role: 'shooter', at: { x: 10, y: 4 } },
    { role: 'target', at: { x: 30, y: 20 } },
  ],
  startPhase: 'movement',
  startRound: 2,
  steps: [
    {
      id: 'intro',
      ruleRefs: ['core.strategic-reserves.placing-units-in-strategic-reserves'],
      say: 'Instead of deploying a unit, you can keep it in strategic reserves, waiting off the battlefield. Your {deepStriker} started there. It is now battle round 2, the first round reserves can arrive.',
      focus: [{ kind: 'element', id: 'reserve-list' }],
    },
    {
      id: 'select',
      ruleRefs: ['core.strategic-reserves.arriving-from-strategic-reserves'],
      say: 'Units in reserves are not on the board, so they are listed in the side panel. Select your {deepStriker} there.',
      focus: [{ kind: 'element', id: 'reserve-list' }],
      expect: { kind: 'ui', signal: 'unit-selected', role: 'deepStriker' },
    },
    {
      id: 'arrive',
      ruleRefs: ['core.strategic-reserves.ingress-move', 'core.core-abilities.deep-strike'],
      say: 'Reserves arrive with an ingress move in your movement phase. For your {deepStriker}, {deepStriker.arrival}. The red rings are the 8" no-go areas around enemies. Click the board where it should arrive.',
      focus: [
        { kind: 'element', id: 'battlefield' },
        { kind: 'element', id: 'action-panel' },
      ],
      allow: ['move'],
      onWrong: 'Too close or in the wrong place: pick a spot outside the red rings.',
      expect: {
        kind: 'event',
        event: 'UnitArrived',
        where: (e, ctx) => e.type === 'UnitArrived' && e.unitId === ctx.units.deepStriker,
      },
    },
    {
      id: 'after',
      ruleRefs: ['core.strategic-reserves.ingress-move'],
      say: 'After arriving it cannot make any other move until the charge phase, but it can still shoot and charge this turn.',
      focus: [{ kind: 'unit', role: 'deepStriker' }],
    },
    {
      id: 'deadline',
      ruleRefs: [
        'core.strategic-reserves.ingress-move',
        'core.strategic-reserves.placing-units-in-strategic-reserves.strategic-reserves-at-the-end-of-the-battle',
      ],
      say: 'Do not wait too long: units still in reserves at the end of battle round 3 are destroyed.',
    },
  ],
};
