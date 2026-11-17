import type { Lesson } from '../types.js';

export const battleRoundLesson: Lesson = {
  id: 'battle-round',
  title: '11. Deployment and a full battle round',
  summary: 'Set up your whole army and play a battle round against the drill opponent.',
  army: 'full',
  deployment: true,
  battleRounds: 2,
  units: [
    { role: 'enemyMelee', at: { x: 0, y: 0 } },
    { role: 'target', at: { x: 0, y: 0 } },
  ],
  steps: [
    {
      id: 'zones',
      ruleRefs: ['core.moving.set-up'],
      say: 'Before the battle each player sets up in their deployment zone (blue for you, along the top edge). Units must be wholly inside it.',
      focus: [{ kind: 'element', id: 'battlefield' }],
    },
    {
      id: 'deploy',
      ruleRefs: ['core.moving.set-up'],
      say: 'Deploy your units (or press Deploy all), then start the battle.',
      focus: [
        { kind: 'element', id: 'action-panel' },
        { kind: 'element', id: 'end-phase' },
        { kind: 'element', id: 'battlefield' },
      ],
      allow: ['deploy', 'endPhase'],
      expect: {
        kind: 'event',
        event: 'BattleRoundStarted',
        where: (e) => e.type === 'BattleRoundStarted' && e.round === 1,
      },
    },
    {
      id: 'structure',
      ruleRefs: ['core.the-battle-round', 'core.the-battle-round.player-turns'],
      say: 'A battle round is your turn then the opponent’s. Each turn: command, movement, shooting, charge, fight. Your army is yours to command now.',
    },
    {
      id: 'play',
      ruleRefs: ['core.the-battle-round'],
      say: 'Play your turn: move, shoot, charge and fight as you like, ending each phase. The drill opponent then plays its turn.',
      free: true,
      expect: {
        kind: 'event',
        event: 'BattleRoundStarted',
        where: (e) => e.type === 'BattleRoundStarted' && e.round === 2,
      },
    },
  ],
};
