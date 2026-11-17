import type { Datasheet } from '@battle-drill/data';
import type { ResolvedArmy, ResolvedUnit } from './types.js';

type Lookup = (id: string) => Datasheet | undefined;

/** Bodyguard units a leader unit can join, from its datasheet's leader list. */
export function bodyguardOptions(
  army: ResolvedArmy,
  leaderKey: string,
  datasheet: Lookup,
): ResolvedUnit[] {
  const leader = army.units.find((u) => u.key === leaderKey);
  const ds = leader ? datasheet(leader.datasheetId) : undefined;
  if (!leader || !ds || ds.canLead.length === 0) return [];
  return army.units.filter((u) => u.key !== leaderKey && ds.canLead.includes(u.datasheetId));
}

/**
 * Checks one attachment against the others: a bodyguard takes one leader, plus one more when
 * exactly one of them is a support leader.
 * RULES-QUESTION: RQ-7 leader limits beyond one leader plus one support leader are not modelled.
 */
export function canAttach(
  army: ResolvedArmy,
  attachments: Readonly<Record<string, string>>,
  leaderKey: string,
  bodyguardKey: string,
  datasheet: Lookup,
): boolean {
  if (!bodyguardOptions(army, leaderKey, datasheet).some((u) => u.key === bodyguardKey))
    return false;
  if (Object.values(attachments).includes(leaderKey)) return false;
  const support = (key: string) => {
    const u = army.units.find((x) => x.key === key);
    return !!u && !!datasheet(u.datasheetId)?.isSupport;
  };
  const others = Object.entries(attachments).filter(
    ([l, b]) => b === bodyguardKey && l !== leaderKey,
  );
  if (others.length === 0) return true;
  if (others.length > 1) return false;
  return support(others[0]![0]) !== support(leaderKey);
}

/** Default attachments: each leader joins the first unit it can lead that still has room. */
export function suggestAttachments(army: ResolvedArmy, datasheet: Lookup): Record<string, string> {
  const out: Record<string, string> = {};
  for (const u of army.units) {
    const target = bodyguardOptions(army, u.key, datasheet).find(
      (b) => !(b.key in out) && canAttach(army, out, u.key, b.key, datasheet),
    );
    if (target) out[u.key] = target.key;
  }
  return out;
}

/** Drops attachments whose units are gone or no longer allowed. */
export function cleanAttachments(army: ResolvedArmy, datasheet: Lookup): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [l, b] of Object.entries(army.attachments ?? {})) {
    if (canAttach(army, out, l, b, datasheet)) out[l] = b;
  }
  return out;
}
