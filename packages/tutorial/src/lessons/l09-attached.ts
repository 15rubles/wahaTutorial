import type { Lesson } from '../types.js';

export const attachedLesson: Lesson = {
  id: 'attached',
  title: '9. Leaders and bodyguards',
  summary: 'Attaching a character to a unit, and how the joined unit fights and is attacked.',
  units: [
    { role: 'leader', at: { x: 22, y: 7 } },
    { role: 'target', at: { x: 22, y: 0 }, near: { role: 'leader', gap: 9 } },
  ],
  startPhase: 'shooting',
  steps: [
    {
      id: 'intro',
      ruleRefs: [
        'core.attached-units.forming-attached-units',
        'core.muster-armies.fill-your-army-roster.attach-leaders-and-support-units',
      ],
      say: 'Some characters can lead a bodyguard unit named on their datasheet. Here {leader.leaderName} has joined {leader.bodyguard}. Before the battle they become one unit, and every rule treats them as one. You choose who leads whom on the Army page.',
    },
    {
      id: 'select',
      ruleRefs: ['core.attached-units'],
      say: 'Select the joined unit. Its models keep their own pieces on the board, but they move, shoot and fight together.',
      focus: [{ kind: 'unit', role: 'leader' }],
      expect: { kind: 'ui', signal: 'unit-selected', role: 'leader' },
    },
    {
      id: 'cards',
      ruleRefs: ['core.attached-units.keywords-in-attached-units'],
      say: 'There is one datasheet card for each part. The joined unit has the keywords of both parts, as long as a model that has them is still alive.',
      focus: [{ kind: 'element', id: 'unit-card' }],
    },
    {
      id: 'fire',
      ruleRefs: ['core.shooting-phase.normal-shooting'],
      say: 'Every model fires its own weapons, so the leader adds its {leader.leaderWeapon}. Press Fire.',
      focus: [{ kind: 'element', id: 'action-panel' }],
      allow: ['shoot'],
      expect: {
        kind: 'event',
        event: 'UnitShot',
        where: (e, ctx) => e.type === 'UnitShot' && e.unitId === ctx.units.leader,
      },
    },
    {
      id: 'toughness',
      ruleRefs: ['core.attached-units.attacking-attached-units'],
      say: 'When an enemy attacks this unit, the wound roll uses the bodyguard Toughness ({leader.bodyguardToughness}) while any bodyguard model is left, whatever the leader has ({leader.leaderToughness}). Once only leader models remain, their own Toughness is used.',
      focus: [{ kind: 'unit', role: 'leader' }],
    },
    {
      id: 'destroyed',
      ruleRefs: [
        'core.attached-units.attacking-attached-units',
        'core.attached-units.forming-attached-units.attached-units-after-their-bodyguard-unit-is-destroyed',
      ],
      say: 'Rules that trigger when a unit is destroyed only happen when its last model falls. That is the whole leader and bodyguard idea: the bodyguard keeps the character alive.',
    },
  ],
};
