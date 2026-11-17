import type { Lesson } from '../types.js';

export const meleeLesson: Lesson = {
  id: 'melee',
  title: '2. Melee duel',
  summary: 'The fight phase and the attack sequence: hit, wound, save, damage.',
  units: [
    { role: 'character', at: { x: 20, y: 12 } },
    { role: 'enemyMelee', at: { x: 20, y: 0 }, near: { role: 'character', gap: 1 } },
  ],
  startPhase: 'fight',
  steps: [
    {
      id: 'engaged',
      ruleRefs: ['core.moving.engagement'],
      say: 'Your {character} is within 2" of the {enemyMelee}: they are engaged, so both will fight this phase.',
      focus: [
        { kind: 'unit', role: 'character' },
        { kind: 'unit', role: 'enemyMelee' },
      ],
    },
    {
      id: 'pile-in',
      ruleRefs: ['core.fight-phase.pile-in', 'core.fight-phase.pile-in-move'],
      say: 'The fight phase starts with pile in moves (up to 3"). You are already close enough. End the pile in step.',
      focus: [{ kind: 'element', id: 'end-phase' }],
      allow: ['endPhase'],
      expect: {
        kind: 'event',
        event: 'FightStepStarted',
        where: (e) => e.type === 'FightStepStarted' && e.step === 'fight',
      },
    },
    {
      id: 'fight',
      ruleRefs: ['core.fight-phase.fight-step', 'core.making-attacks.select-weapons'],
      say: 'It is your turn, so you pick the first unit to fight. Select your {character} and press Fight. It attacks with its {character.meleeWeapon}.',
      focus: [
        { kind: 'unit', role: 'character' },
        { kind: 'element', id: 'action-panel' },
      ],
      allow: ['fight'],
      dice: [6, 4, 3, 5, 6, 2, 5, 4, 3, 1, 2, 3],
      expect: {
        kind: 'event',
        event: 'UnitFought',
        where: (e, ctx) => e.type === 'UnitFought' && e.unitId === ctx.units.character,
      },
    },
    {
      id: 'sequence',
      ruleRefs: [
        'core.attack-sequence.hit-roll',
        'core.attack-sequence.wound-roll',
        'core.attack-sequence.save-rolls',
        'core.attack-sequence.inflict-damage',
      ],
      say: 'The dice tray shows the attack sequence. Hit rolls need the WS or better (a 6 is a critical hit). Wound rolls compare S to T. The defender then rolls saves, made worse by AP. Every failed save inflicts D damage.',
      focus: [{ kind: 'element', id: 'dice-tray' }],
    },
    {
      id: 'back',
      ruleRefs: ['core.fight-phase.fight-step'],
      say: 'If the {enemyMelee} survived, they fought back straight away: players take turns picking units to fight. Check the battle log and the dice tray.',
      focus: [{ kind: 'element', id: 'dice-tray' }],
    },
  ],
};
