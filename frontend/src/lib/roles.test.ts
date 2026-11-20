import { groupByRole, roleGroup } from './roles';

describe('role groups', () => {
  it('maps data roles to sections', () => {
    expect(roleGroup('Infantry Character').id).toBe('characters');
    expect(roleGroup('Monster Epic Hero').id).toBe('characters');
    expect(roleGroup('Battleline').id).toBe('battleline');
    expect(roleGroup('Dedicated Transports').id).toBe('dedicated-transports');
    expect(roleGroup('Infantry').id).toBe('infantry');
    expect(roleGroup('Walker').id).toBe('vehicles');
    expect(roleGroup(undefined).id).toBe('other');
  });

  it('groups in section order', () => {
    const grouped = groupByRole(
      [{ r: 'Vehicle' }, { r: 'Infantry' }, { r: 'Infantry Character' }, { r: 'Infantry' }],
      (x) => x.r,
    );
    expect(grouped.map((g) => g.group.id)).toEqual(['characters', 'infantry', 'vehicles']);
    expect(grouped[1]?.items).toHaveLength(2);
  });
});
