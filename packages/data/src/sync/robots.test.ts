import { describe, expect, it } from 'vitest';
import { isAllowed, parseRobots } from './robots.js';

const robots = `
User-agent: SomeBot
Disallow: /

User-agent: *
Disallow: /old/
Disallow: /mirror_/
Allow: /old/keep$
Disallow: /secret*/
`;

describe('robots', () => {
  const groups = parseRobots(robots);

  it('uses the * group for unknown agents', () => {
    expect(isAllowed(groups, 'BattleDrill', '/new/file.csv')).toBe(true);
    expect(isAllowed(groups, 'BattleDrill', '/old/file.csv')).toBe(false);
    expect(isAllowed(groups, 'BattleDrill', '/mirror_/x')).toBe(false);
    expect(isAllowed(groups, 'BattleDrill', '/mirror/x')).toBe(true);
  });

  it('supports wildcards, $ anchors and longest match', () => {
    expect(isAllowed(groups, 'BattleDrill', '/secret-vault/a/')).toBe(false);
    expect(isAllowed(groups, 'BattleDrill', '/old/keep')).toBe(true);
    expect(isAllowed(groups, 'BattleDrill', '/old/keeper')).toBe(false);
  });

  it('uses a matching named group', () => {
    expect(isAllowed(groups, 'SomeBot/1.0', '/new/file.csv')).toBe(false);
  });
});
