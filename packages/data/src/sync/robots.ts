/**
 * Minimal robots.txt support: groups, Allow / Disallow, `*` wildcards and `$` anchors,
 * longest match wins, Allow wins ties (as in RFC 9309).
 */
export interface RobotsRule {
  readonly allow: boolean;
  readonly pattern: string;
}

export interface RobotsGroup {
  readonly agents: readonly string[];
  readonly rules: readonly RobotsRule[];
}

export function parseRobots(text: string): RobotsGroup[] {
  const groups: { agents: string[]; rules: RobotsRule[] }[] = [];
  let current: { agents: string[]; rules: RobotsRule[] } | undefined;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === 'allow' || field === 'disallow') {
      if (field === 'disallow' && value === '') continue;
      current.rules.push({ allow: field === 'allow', pattern: value });
    }
  }
  return groups;
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`);
}

/** Picks the group for our agent token, falling back to `*`. */
export function groupFor(
  groups: readonly RobotsGroup[],
  agentToken: string,
): RobotsGroup | undefined {
  const token = agentToken.toLowerCase();
  return (
    groups.find((g) => g.agents.some((a) => a !== '*' && token.includes(a))) ??
    groups.find((g) => g.agents.includes('*'))
  );
}

export function isAllowed(
  groups: readonly RobotsGroup[],
  agentToken: string,
  path: string,
): boolean {
  const group = groupFor(groups, agentToken);
  if (!group) return true;
  let best: RobotsRule | undefined;
  for (const rule of group.rules) {
    if (!patternToRegExp(rule.pattern).test(path)) continue;
    if (
      !best ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow)
    ) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}
