import type { Lesson } from '../types.js';

export const transportsLesson: Lesson = {
  id: 'transports',
  title: '11. Transports',
  summary: 'Riding inside a transport, and getting out at the right moment.',
  units: [
    { role: 'transport', at: { x: 20, y: 6 } },
    { role: 'passenger', at: { x: 0, y: 0 }, embarkIn: 'transport' },
    { role: 'target', at: { x: 22, y: 25 } },
  ],
  startPhase: 'movement',
  steps: [
    {
      id: 'intro',
      ruleRefs: ['core.transports', 'core.transports.transport-capacity'],
      say: 'A TRANSPORT carries other units. Your {transport} has room for {transport.capacity} models, and your {passenger} starts the battle inside it. Passengers are not on the battlefield: they cannot be shot, but they cannot shoot either.',
      focus: [{ kind: 'unit', role: 'transport' }],
    },
    {
      id: 'select',
      ruleRefs: ['core.transports.disembarking'],
      say: 'Units inside a transport are listed in the side panel. Select your {passenger} there.',
      focus: [{ kind: 'element', id: 'reserve-list' }],
      expect: { kind: 'ui', signal: 'unit-selected', role: 'passenger' },
    },
    {
      id: 'disembark',
      ruleRefs: ['core.transports.disembark-move'],
      say: 'Get out in your movement phase: click inside the yellow area so every model is wholly within 3" of the {transport}. The {transport} has not moved yet, so this is a tactical disembark.',
      focus: [
        { kind: 'element', id: 'battlefield' },
        { kind: 'element', id: 'action-panel' },
      ],
      allow: ['move'],
      onWrong: 'Click closer to the transport, inside the yellow area.',
      expect: {
        kind: 'event',
        event: 'UnitDisembarked',
        where: (e, ctx) => e.type === 'UnitDisembarked' && e.unitId === ctx.units.passenger,
      },
    },
    {
      id: 'modes',
      ruleRefs: ['core.transports.disembark-move'],
      say: 'A tactical disembark still lets the unit make a normal or advance move. Had the {transport} moved first, it would have been a rapid disembark: no more moving and no charge this turn. After the transport advances or falls back, nobody can get out.',
      focus: [{ kind: 'element', id: 'action-panel' }],
    },
    {
      id: 'embark',
      ruleRefs: ['core.transports.embarking'],
      say: 'Getting back in works after the unit has moved this phase (any move except staying put), as long as all its models finish close to the transport, within 3". An Embark button then shows up.',
    },
    {
      id: 'emergency',
      ruleRefs: ['core.transports.emergency-disembark-move'],
      say: 'If a transport is destroyed, everyone inside makes an emergency disembark: a hazard roll for each model, set up within 6", and the unit is battle-shocked and cannot charge that turn.',
    },
  ],
};
