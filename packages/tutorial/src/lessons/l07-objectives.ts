import { controlLevels } from '@battle-drill/engine';
import type { Lesson } from '../types.js';

export const objectivesLesson: Lesson = {
  id: 'objectives',
  title: '7. Objectives and battle-shock',
  summary: 'Objective control, OC, scoring and why morale matters.',
  units: [
    { role: 'shooter', at: { x: 22, y: 8 } },
    { role: 'target', at: { x: 38, y: 26 } },
  ],
  startPhase: 'movement',
  steps: [
    {
      id: 'objectives',
      ruleRefs: ['core.objectives', 'core.objectives.level-of-control'],
      say: 'Yellow markers are objectives. A model is in range within 3" of a marker. At the end of every phase, the player with more total OC in range controls it.',
      focus: [{ kind: 'element', id: 'objective-obj-centre' }],
    },
    {
      id: 'move',
      ruleRefs: ['core.movement-phase.normal-move'],
      say: 'Move your {shooter} until it is within 3" of the centre objective (the dashed circle), then confirm. Undo if you fall short.',
      focus: [
        { kind: 'unit', role: 'shooter' },
        { kind: 'element', id: 'action-panel' },
        { kind: 'element', id: 'objective-obj-centre' },
        { kind: 'element', id: 'undo' },
      ],
      allow: ['move'],
      expect: {
        kind: 'event',
        event: 'UnitMoved',
        where: (e, ctx, state) =>
          e.type === 'UnitMoved' &&
          e.unitId === ctx.units.shooter &&
          controlLevels(state, 'obj-centre').p1 > 0,
      },
      onWrong: 'Get at least one model inside the dashed circle around the centre objective.',
    },
    {
      id: 'control',
      ruleRefs: ['core.objectives.level-of-control'],
      say: 'Control is checked at the end of the phase. End the movement phase.',
      focus: [{ kind: 'element', id: 'end-phase' }],
      allow: ['endPhase'],
      expect: {
        kind: 'event',
        event: 'ObjectiveControlled',
        where: (e) =>
          e.type === 'ObjectiveControlled' && e.objectiveId === 'obj-centre' && e.player === 'p1',
      },
    },
    {
      id: 'oc',
      ruleRefs: ['core.datasheets.profiles'],
      say: 'The marker now shows your colour. Your OC is the sum of the OC of your models in range. A bigger squad or a tougher one wins the tug of war.',
      focus: [{ kind: 'element', id: 'objective-obj-centre' }],
    },
    {
      id: 'shock',
      ruleRefs: [
        'core.core-concepts.battle-shock-rolls',
        'core.core-concepts.units-and-models.starting-strength-and-half-strength',
      ],
      say: 'A battle-shocked unit counts as OC 0. Losing half a unit means a battle-shock test (2D6 against Ld) every command phase until it passes.',
    },
    {
      id: 'score',
      ruleRefs: ['core.objectives'],
      say: 'Missions decide how objectives score. In these drills you get 5 victory points for each objective you hold at the end of your turn.',
      focus: [{ kind: 'element', id: 'phase-bar' }],
    },
  ],
};
