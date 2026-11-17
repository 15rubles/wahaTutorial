import type { Lesson } from '../types.js';

export const shootingLesson: Lesson = {
  id: 'shooting',
  title: '3. Shooting',
  summary: 'Range, line of sight, cover and your weapons’ abilities.',
  units: [
    { role: 'shooter', at: { x: 22, y: 7 } },
    { role: 'target', at: { x: 22, y: 0 }, near: { role: 'shooter', gap: 9 } },
  ],
  startPhase: 'shooting',
  steps: [
    {
      id: 'select',
      ruleRefs: ['core.shooting-phase.shoot'],
      say: 'Shooting phase. Select your {shooter}.',
      focus: [{ kind: 'unit', role: 'shooter' }],
      expect: { kind: 'ui', signal: 'unit-selected', role: 'shooter' },
    },
    {
      id: 'range',
      ruleRefs: ['core.making-attacks.select-targets', 'core.other-concepts.visibility'],
      say: 'The dashed rings show each weapon’s range from every model. A target must be in range and visible: hatched terrain in between blocks sight.',
      focus: [{ kind: 'element', id: 'battlefield' }],
    },
    {
      id: 'fire',
      ruleRefs: ['core.shooting-phase.normal-shooting'],
      say: 'Each weapon picks a target. The {target} is the only one here. Press Fire.',
      focus: [{ kind: 'element', id: 'action-panel' }],
      allow: ['shoot'],
      expect: {
        kind: 'event',
        event: 'UnitShot',
        where: (e, ctx) => e.type === 'UnitShot' && e.unitId === ctx.units.shooter,
      },
    },
    {
      id: 'dice',
      ruleRefs: ['core.attack-sequence'],
      say: 'Same attack sequence as in melee: hit with BS, wound with S against T, then saves and damage.',
      focus: [{ kind: 'element', id: 'dice-tray' }],
    },
    {
      id: 'cover',
      ruleRefs: ['core.terrain.benefit-of-cover', 'core.terrain.obscuring'],
      say: 'Cover: infantry inside a terrain area, or models partly hidden by terrain, make the shooter’s BS one worse. Some weapons ignore cover.',
      focus: [{ kind: 'element', id: 'terrain-ruin-west' }],
    },
    {
      id: 'keywords',
      ruleRefs: ['core.core-abilities'],
      say: 'Weapon abilities change the attack: extra dice up close, automatic hits, extra damage and more. Tap them on the datasheet any time.',
      focus: [{ kind: 'element', id: 'unit-card' }],
    },
  ],
};
