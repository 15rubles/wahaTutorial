import type { Lesson } from '../types.js';

export const chargeLesson: Lesson = {
  id: 'charge',
  title: '5. Charge and the full fight phase',
  summary: 'Charge rolls, Fights First, pile in, fight and consolidate.',
  units: [
    { role: 'melee', at: { x: 22, y: 8 } },
    { role: 'target', at: { x: 22, y: 0 }, near: { role: 'melee', gap: 5 } },
  ],
  startPhase: 'charge',
  steps: [
    {
      id: 'select',
      ruleRefs: ['core.charge-phase.charge-step'],
      say: 'Charge phase. Units within 12" of an enemy can declare a charge. Select your {melee}.',
      focus: [{ kind: 'unit', role: 'melee' }],
      expect: { kind: 'ui', signal: 'unit-selected', role: 'melee' },
    },
    {
      id: 'declare',
      ruleRefs: ['core.charge-phase.charge-step'],
      say: 'Declare the charge: you roll 2D6, and that is how far the unit may move.',
      focus: [{ kind: 'element', id: 'action-panel' }],
      allow: ['declareCharge'],
      dice: [5, 5],
      expect: { kind: 'event', event: 'ChargeDeclared' },
    },
    {
      id: 'move',
      ruleRefs: ['core.charge-phase.charge-move'],
      say: 'A 10! The charge has to end engaged with the target. Press Charge.',
      focus: [{ kind: 'element', id: 'action-panel' }],
      allow: ['chargeMove', 'skipCharge'],
      expect: { kind: 'event', event: 'ChargeMoved' },
    },
    {
      id: 'fights-first',
      ruleRefs: ['core.core-abilities.fights-first'],
      say: 'Charging gives your unit Fights First until the end of the turn. End the charge phase.',
      focus: [{ kind: 'element', id: 'end-phase' }],
      allow: ['endPhase'],
      expect: {
        kind: 'event',
        event: 'PhaseStarted',
        where: (e) => e.type === 'PhaseStarted' && e.phase === 'fight',
      },
    },
    {
      id: 'pile-in',
      ruleRefs: ['core.fight-phase.pile-in', 'core.fight-phase.pile-in-move'],
      say: 'Pile in: engaged or charging units may move up to 3" closer. Pile in with your {melee} if you like, then end the pile in step.',
      focus: [
        { kind: 'element', id: 'action-panel' },
        { kind: 'element', id: 'end-phase' },
        { kind: 'unit', role: 'melee' },
      ],
      allow: ['pileIn', 'endPhase'],
      expect: {
        kind: 'event',
        event: 'FightStepStarted',
        where: (e) => e.type === 'FightStepStarted' && e.step === 'fight',
      },
    },
    {
      id: 'fight',
      ruleRefs: ['core.fight-phase.fight-step', 'core.fight-phase.normal-fight'],
      say: 'Fights First units go before everyone else. Select your {melee} and fight.',
      focus: [
        { kind: 'unit', role: 'melee' },
        { kind: 'element', id: 'action-panel' },
      ],
      allow: ['fight'],
      expect: {
        kind: 'event',
        event: 'UnitFought',
        where: (e, ctx) => e.type === 'UnitFought' && e.unitId === ctx.units.melee,
      },
    },
    {
      id: 'consolidate',
      ruleRefs: ['core.fight-phase.consolidate', 'core.fight-phase.consolidation-move'],
      say: 'After all fights, units may consolidate up to 3": towards enemies, or towards an objective. End the fight step to get there.',
      focus: [{ kind: 'element', id: 'end-phase' }],
      allow: ['endPhase', 'fight'],
      expect: {
        kind: 'event',
        event: 'FightStepStarted',
        where: (e) => e.type === 'FightStepStarted' && e.step === 'consolidate',
      },
    },
  ],
};
