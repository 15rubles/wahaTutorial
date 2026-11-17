import { describe, expect, it } from 'vitest';
import { parseWeaponKeywords, slugify } from './weaponKeywords.js';

describe('parseWeaponKeywords', () => {
  it('normalizes case and extracts parameters', () => {
    expect(parseWeaponKeywords('Rapid Fire 1, sustained hits D3, TWIN-LINKED')).toEqual([
      { id: 'rapid-fire', param: '1', raw: 'Rapid Fire 1' },
      { id: 'sustained-hits', param: 'd3', raw: ' sustained hits D3' },
      { id: 'twin-linked', raw: ' TWIN-LINKED' },
    ]);
  });

  it('parses anti with targets and conditional forms', () => {
    const [anti, lethal] = parseWeaponKeywords(
      'ANTI-MONSTER/VEHICLE 4+, LETHAL HITS: non-MONSTER/VEHICLE',
    );
    expect(anti).toMatchObject({ id: 'anti', target: 'monster/vehicle', param: '4+' });
    expect(lethal).toMatchObject({ id: 'lethal-hits', condition: 'non-MONSTER/VEHICLE' });
  });

  it('ignores empty input and html', () => {
    expect(parseWeaponKeywords('')).toEqual([]);
    expect(parseWeaponKeywords('<b>blast</b>')).toMatchObject([{ id: 'blast' }]);
  });

  it('slugifies names', () => {
    expect(slugify("Pilgrim's Toll")).toBe('pilgrims-toll');
    expect(slugify('Close-Quarters')).toBe('close-quarters');
  });
});
