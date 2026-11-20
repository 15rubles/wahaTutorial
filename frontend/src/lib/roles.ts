/**
 * Roster sections by unit role (DESIGN.md 7.1): Characters lilac, Battleline sage, Infantry peach,
 * other roles muted tints in the same style. Roles come from the data ("Infantry Character",
 * "Dedicated Transports"...); this maps them to a section.
 */
export type RoleGroup = {
  id: string;
  label: string;
  tone: 'lilac' | 'sage' | 'peach' | 'sky' | 'sand' | 'rose' | 'stone';
};

const GROUPS: { match: (r: string) => boolean; group: RoleGroup }[] = [
  { match: (r) => r.includes('character') || r.includes('epic hero'), group: { id: 'characters', label: 'Characters', tone: 'lilac' } },
  { match: (r) => r.includes('battleline'), group: { id: 'battleline', label: 'Battleline', tone: 'sage' } },
  { match: (r) => r.includes('dedicated transport'), group: { id: 'dedicated-transports', label: 'Dedicated Transports', tone: 'sky' } },
  { match: (r) => r.includes('infantry'), group: { id: 'infantry', label: 'Infantry', tone: 'peach' } },
  { match: (r) => r.includes('mounted') || r.includes('beast') || r.includes('swarm'), group: { id: 'mounted', label: 'Mounted and Beasts', tone: 'sand' } },
  { match: (r) => r.includes('monster'), group: { id: 'monsters', label: 'Monsters', tone: 'rose' } },
  {
    match: (r) => r.includes('vehicle') || r.includes('walker') || r.includes('transport') || r.includes('artillery') || r.includes('titanic'),
    group: { id: 'vehicles', label: 'Vehicles', tone: 'sky' },
  },
  { match: (r) => r.includes('aircraft'), group: { id: 'aircraft', label: 'Aircraft', tone: 'stone' } },
  { match: (r) => r.includes('fortification'), group: { id: 'fortifications', label: 'Fortifications', tone: 'stone' } },
];

export const OTHER: RoleGroup = { id: 'other', label: 'Other', tone: 'stone' };
export const GROUP_ORDER = ['characters', 'battleline', 'dedicated-transports', 'infantry', 'mounted', 'monsters', 'vehicles', 'aircraft', 'fortifications', 'other'];

export function roleGroup(role: string | undefined): RoleGroup {
  const r = (role ?? '').toLowerCase();
  return GROUPS.find((g) => g.match(r))?.group ?? OTHER;
}

/** Groups items by role section, in section order, keeping item order within a section. */
export function groupByRole<T>(items: T[], roleOf: (t: T) => string | undefined): { group: RoleGroup; items: T[] }[] {
  const map = new Map<string, { group: RoleGroup; items: T[] }>();
  for (const item of items) {
    const g = roleGroup(roleOf(item));
    const bucket = map.get(g.id) ?? { group: g, items: [] };
    bucket.items.push(item);
    map.set(g.id, bucket);
  }
  return [...map.values()].sort((a, b) => GROUP_ORDER.indexOf(a.group.id) - GROUP_ORDER.indexOf(b.group.id));
}
