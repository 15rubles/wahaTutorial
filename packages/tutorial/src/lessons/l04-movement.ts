import type { Lesson } from '../types.js';

export const movementLesson: Lesson = {
  id: 'movement',
  title: '4. Movement',
  summary: 'Normal moves, advancing, falling back and terrain.',
  units: [
    { role: 'fast', at: { x: 8, y: 6 } },
    { role: 'melee', at: { x: 33, y: 6 } },
    { role: 'enemyMelee', at: { x: 33, y: 0 }, near: { role: 'melee', gap: 1 } },
  ],
  startPhase: 'movement',
  steps: [
    {
      id: 'select-fast',
      ruleRefs: ['core.movement-phase.move-units-step'],
      say: 'Movement phase: every unit is picked once, even if it stays put. Select your {fast}.',
      focus: [{ kind: 'unit', role: 'fast' }],
      expect: { kind: 'ui', signal: 'unit-selected', role: 'fast' },
    },
    {
      id: 'normal',
      ruleRefs: ['core.movement-phase.normal-move', 'core.moving.moving-units'],
      say: 'Pick Normal move and drag your {fast} forward. It can go up to its M characteristic ({fast.move}) and cannot end within 2" of an enemy. Then confirm.',
      focus: [
        { kind: 'unit', role: 'fast' },
        { kind: 'element', id: 'action-panel' },
      ],
      allow: ['move'],
      expect: {
        kind: 'event',
        event: 'UnitMoved',
        where: (e, ctx) =>
          e.type === 'UnitMoved' && e.unitId === ctx.units.fast && e.moveType === 'normal',
      },
    },
    {
      id: 'advance',
      ruleRefs: ['core.movement-phase.advance-move'],
      say: 'Advancing adds a D6 to the move, but the unit then cannot shoot normally or charge this turn.',
    },
    {
      id: 'fall-back',
      ruleRefs: ['core.movement-phase.fall-back-move'],
      say: 'Your {melee} is engaged. Engaged units can only fall back (or stay). Select it, pick Fall back, drag it away from the enemy and confirm.',
      focus: [
        { kind: 'unit', role: 'melee' },
        { kind: 'element', id: 'action-panel' },
      ],
      allow: ['move'],
      expect: {
        kind: 'event',
        event: 'UnitMoved',
        where: (e, ctx) =>
          e.type === 'UnitMoved' && e.unitId === ctx.units.melee && e.moveType === 'fall-back',
      },
    },
    {
      id: 'terrain',
      ruleRefs: ['core.terrain.terrain-and-movement', 'core.moving.coherency'],
      say: 'Infantry can walk through ruins; vehicles and monsters go around. Models in a unit must stay together (coherency).',
      focus: [{ kind: 'element', id: 'terrain-ruin-west' }],
    },
  ],
};
