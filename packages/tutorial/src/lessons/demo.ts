import type { Lesson } from '../types.js';

/** M8 demo: three steps to prove the framework (select, end a phase, move). */
export const demoLesson: Lesson = {
  id: 'demo',
  title: 'Drill zero: first orders',
  summary: 'Select one of your units, start the turn, and make your first move.',
  units: [
    { role: 'shooter', at: { x: 22, y: 6 } },
    { role: 'target', at: { x: 22, y: 25 } },
  ],
  startPhase: 'command',
  steps: [
    {
      id: 'select',
      ruleRefs: ['core.core-concepts.units-and-models'],
      say: 'This is your {shooter}. Click it on the battlefield to select it and see its datasheet.',
      focus: [{ kind: 'unit', role: 'shooter' }],
      expect: { kind: 'ui', signal: 'unit-selected', role: 'shooter' },
      onWrong: 'Click your {shooter} (the highlighted blue unit).',
    },
    {
      id: 'end-command',
      ruleRefs: ['core.command-phase'],
      say: 'Every turn starts in the Command phase, where both players gain a command point. Nothing else to do here yet: end the phase.',
      focus: [{ kind: 'element', id: 'end-phase' }],
      expect: {
        kind: 'event',
        event: 'PhaseStarted',
        where: (e) => e.type === 'PhaseStarted' && e.phase === 'movement',
      },
      allow: ['endPhase'],
    },
    {
      id: 'move',
      ruleRefs: ['core.movement-phase.normal-move', 'core.moving.moving-units'],
      say: 'Now move. Pick "Normal move", drag your {shooter} towards the dummies (it can go up to its Move characteristic), then confirm.',
      focus: [
        { kind: 'unit', role: 'shooter' },
        { kind: 'element', id: 'action-panel' },
      ],
      expect: {
        kind: 'event',
        event: 'UnitMoved',
        where: (e, ctx) =>
          e.type === 'UnitMoved' && e.unitId === ctx.units.shooter && e.moveType === 'normal',
      },
      allow: ['move'],
      onWrong: 'Use a normal move with your {shooter}: select it, drag, then press Confirm.',
    },
  ],
};
