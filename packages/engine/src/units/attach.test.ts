import { describe, expect, it } from 'vitest';
import { flat } from '../dice/diceExpr.js';
import { model, unit, weapon } from '../testing.js';
import { unitToughness } from '../attack/woundRoll.js';
import { attachUnits, liveKeywords } from './attach.js';

const pistol = weapon({ name: 'Rust pistol', range: 12 });
const bodyguard = unit(
  'scrappers',
  5,
  { weapons: [pistol], keywords: ['INFANTRY', 'SCRAPPERS'] },
  { toughness: 4 },
  'p1',
);
const leader = {
  ...unit(
    'deacon',
    1,
    {
      weapons: [{ ...pistol, attacks: flat(3) }],
      keywords: ['INFANTRY', 'CHARACTER', 'DEACON'],
      abilities: ['leader', 'deep-strike'],
    },
    { toughness: 6, isCharacter: true, wounds: 4 },
    'p1',
  ),
};

describe('attachUnits', () => {
  const merged = attachUnits({ ...bodyguard, abilities: ['deep-strike'] }, [leader]);

  it('forms one unit with both sets of models, bodyguard first', () => {
    expect(merged.models).toHaveLength(6);
    expect(merged.models[0]!.attachedRole).toBe('bodyguard');
    expect(merged.models[5]!.attachedRole).toBe('leader');
    expect(merged.startingStrength).toBe(6);
    expect(merged.name).toBe('deacon + scrappers');
    expect(merged.components?.map((c) => c.role)).toEqual(['bodyguard', 'leader']);
  });

  it('merges keywords and keeps only abilities every unit has', () => {
    expect(merged.keywords).toEqual(expect.arrayContaining(['SCRAPPERS', 'DEACON', 'CHARACTER']));
    expect(merged.abilities).toEqual(['deep-strike']);
  });

  it('renames a conflicting weapon profile of the same name', () => {
    expect(merged.weapons.map((w) => w.name)).toEqual(['Rust pistol', 'Rust pistol (deacon)']);
  });

  it('uses the bodyguard toughness while bodyguard models are alive', () => {
    expect(unitToughness(merged)).toBe(4);
  });

  it('drops keywords of a destroyed component', () => {
    const bodyguardDead = {
      ...merged,
      models: merged.models.map((m) =>
        m.attachedRole === 'bodyguard' ? { ...m, destroyed: true } : m,
      ),
    };
    expect(liveKeywords(bodyguardDead)).not.toContain('SCRAPPERS');
    expect(liveKeywords(bodyguardDead)).toContain('DEACON');
    expect(unitToughness(bodyguardDead)).toBe(6);
  });

  it('leaves a unit without components alone', () => {
    expect(liveKeywords(bodyguard)).toEqual(bodyguard.keywords);
    expect(model('x').attachedRole).toBeUndefined();
  });
});
