import type { Lesson } from '../types.js';

export const datasheetLesson: Lesson = {
  id: 'datasheet',
  title: '1. Reading a datasheet',
  summary: 'Characteristics, weapons, abilities and keywords, using your own units.',
  units: [
    { role: 'shooter', at: { x: 22, y: 8 } },
    { role: 'character', at: { x: 10, y: 8 } },
    { role: 'target', at: { x: 22, y: 24 } },
  ],
  steps: [
    {
      id: 'intro',
      ruleRefs: ['core.datasheets'],
      say: 'Every unit has a datasheet: its characteristics, weapons, abilities and keywords. Let us read the one for your {shooter}.',
    },
    {
      id: 'select',
      ruleRefs: [],
      say: 'Click your {shooter} on the battlefield to open its datasheet.',
      focus: [{ kind: 'unit', role: 'shooter' }],
      expect: { kind: 'ui', signal: 'unit-selected', role: 'shooter' },
    },
    {
      id: 'profile',
      ruleRefs: ['core.datasheets.profiles'],
      say: 'The profile row: M is how far it moves, T how hard it is to wound, Sv its armour save, W how much damage each model takes, Ld its nerve, OC how well it holds objectives. A number with ++ is an invulnerable save. Your {shooter} has T{shooter.toughness} and a {shooter.save} save.',
      focus: [{ kind: 'element', id: 'profile-table' }],
    },
    {
      id: 'weapons',
      ruleRefs: ['core.datasheets.weapons'],
      say: 'Each weapon has a range (or Melee), A for how many attacks, BS or WS for the roll needed to hit, S for strength, AP for how much it cuts armour, and D for damage. Find the {shooter.rangedWeapon} in the table.',
      focus: [{ kind: 'element', id: 'weapon-table' }],
    },
    {
      id: 'weapon-keywords',
      ruleRefs: ['core.core-abilities'],
      say: 'The small chips under a weapon are its abilities. Tap one to read its rule, then press Next. Abilities on your {shooter}: {shooter.weaponAbilities}.',
      focus: [
        { kind: 'element', id: 'weapon-table' },
        { kind: 'element', id: 'rule-popup' },
      ],
    },
    {
      id: 'abilities',
      ruleRefs: ['core.datasheets.abilities', 'core.datasheets.keywords'],
      say: 'Below the weapons: abilities (special rules for this unit) and keywords. Keywords such as INFANTRY or VEHICLE are what other rules look for.',
      focus: [{ kind: 'element', id: 'unit-card' }],
    },
    {
      id: 'character',
      ruleRefs: ['core.core-abilities.leader-support'],
      say: 'Now click your {character}. CHARACTER units are heroes; many can lead a bodyguard unit.',
      focus: [{ kind: 'unit', role: 'character' }],
      expect: { kind: 'ui', signal: 'unit-selected', role: 'character' },
    },
  ],
};
