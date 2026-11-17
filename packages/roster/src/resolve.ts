/**
 * Matches a RosterDraft against normalized data: faction, detachment, and for each unit the
 * datasheet, model count, weapons, enhancements and warlord. Never throws on bad input: anything
 * that does not match ends up in `unresolved` (with suggestions) or `warnings`.
 */
import type { CatalogEntry, Datasheet, Detachment, Enhancement, Faction } from '@battle-drill/data';
import { normalizeName, similarity } from './names.js';
import type {
  DraftItem,
  DraftModel,
  DraftUnit,
  ResolvedArmy,
  ResolvedUnit,
  ResolvedWeapon,
  RosterDraft,
  Suggestion,
  UnresolvedUnit,
} from './types.js';

export interface RosterLookup {
  readonly factions: readonly Faction[];
  readonly catalog: readonly CatalogEntry[];
  readonly detachments: readonly Detachment[];
  readonly enhancements: readonly Enhancement[];
  /** Full datasheet by id, or undefined if not loaded. */
  readonly datasheet: (id: string) => Datasheet | undefined;
}

export const FUZZY_THRESHOLD = 0.85;

function bestFaction(draft: RosterDraft, lookup: RosterLookup): string | null {
  let best: { id: string; score: number } | null = null;
  for (const hint of draft.factionHints) {
    const h = normalizeName(hint);
    for (const f of lookup.factions) {
      const n = normalizeName(f.name);
      if (!n) continue;
      const score =
        h === n ? 1 : h.endsWith(` ${n}`) || h.includes(n) ? 0.9 : similarity(hint, f.name);
      if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) best = { id: f.id, score };
    }
  }
  return best?.id ?? null;
}

function rankDatasheets(
  name: string,
  lookup: RosterLookup,
  factionId: string | null,
): Suggestion[] {
  const n = normalizeName(name);
  const out: Suggestion[] = [];
  for (const c of lookup.catalog) {
    const score = normalizeName(c.name) === n ? 1 : similarity(name, c.name);
    if (score < 0.5) continue;
    // Small tie breakers: same faction, real (non virtual) datasheets.
    const bonus = (factionId && c.factionId === factionId ? 0.02 : 0) + (c.virtual ? -0.01 : 0);
    out.push({
      datasheetId: c.id,
      name: c.name,
      factionId: c.factionId,
      score: Math.min(1, score) + bonus,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

function stripEnhancementPrefix(name: string): string {
  return name.replace(/^enhancements?\s*:\s*/i, '').trim();
}

function matchWeapons(ds: Datasheet, names: readonly DraftItem[]): ResolvedWeapon[] {
  const counts = new Map<string, number>();
  for (const item of names) {
    const n = normalizeName(item.name);
    for (const w of ds.weapons) {
      const wn = normalizeName(w.name);
      // Multi-profile weapons are named "Group - Profile"; the roster usually lists "Group".
      const group = normalizeName(w.name.split(' - ')[0] ?? '');
      if (wn === n || group === n || similarity(w.name, item.name) >= 0.92) {
        counts.set(w.name, (counts.get(w.name) ?? 0) + item.count);
      }
    }
  }
  return [...counts].map(([name, count]) => ({ name, count }));
}

/**
 * No model lines in the roster (common in compact text exports). Use, in order: the datasheet cost
 * line with the same points, the largest wargear count, the first priced cost line, 1.
 */
function inferModelCount(ds: Datasheet, unit: DraftUnit, items: readonly DraftItem[]): number {
  const countOf = (description: string) => Number(/(\d+)/.exec(description)?.[1] ?? 0);
  const byPoints =
    unit.points !== undefined ? ds.costs.find((c) => c.points === unit.points) : undefined;
  if (byPoints && countOf(byPoints.description) > 0) return countOf(byPoints.description);
  const weaponCounts = matchWeapons(ds, items).map((w) => w.count);
  if (weaponCounts.length) return Math.max(...weaponCounts);
  const first = ds.costs.find((c) => c.points !== null);
  return Math.max(1, first ? countOf(first.description) : 1);
}

function isWeaponName(ds: Datasheet, name: string): boolean {
  return matchWeapons(ds, [{ name, count: 1 }]).length > 0;
}

function resolveUnit(
  key: string,
  unit: DraftUnit,
  ds: Datasheet,
  match: ResolvedUnit['match'],
  lookup: RosterLookup,
  detachmentId: string | null,
  warnings: string[],
): ResolvedUnit {
  // Counted lines that are really weapons (text rosters of single model units) move to items.
  const models: DraftModel[] = [];
  const loose: DraftItem[] = [...unit.items];
  for (const m of unit.models) {
    if (
      m.items.length === 0 &&
      isWeaponName(ds, m.name) &&
      normalizeName(m.name) !== normalizeName(ds.name)
    ) {
      loose.push({ name: m.name, count: m.count });
    } else models.push(m);
  }
  const allItems = [...loose, ...models.flatMap((m) => m.items)];

  const warlord = allItems.some((i) => normalizeName(i.name) === 'warlord');
  const enhancementIds: string[] = [];
  for (const item of allItems) {
    const name = stripEnhancementPrefix(item.name);
    const candidates = lookup.enhancements.filter(
      (e) => normalizeName(e.name) === normalizeName(name),
    );
    const pick =
      candidates.find((e) => e.detachmentId === detachmentId) ??
      candidates.find((e) => e.factionId === ds.factionId) ??
      candidates[0];
    if (pick && !enhancementIds.includes(pick.id)) enhancementIds.push(pick.id);
    else if (!pick && /^enhancements?\s*:/i.test(item.name))
      warnings.push(`${unit.name}: enhancement "${name}" not found in the data`);
  }

  const modelCount =
    models.length > 0
      ? Math.max(
          1,
          models.reduce((n, m) => n + m.count, 0),
        )
      : inferModelCount(ds, unit, allItems);
  let weapons = matchWeapons(ds, allItems);
  const wargearDefaulted = weapons.length === 0;
  if (wargearDefaulted) weapons = ds.weapons.map((w) => ({ name: w.name, count: modelCount }));

  let points = unit.points ?? null;
  if (points === null) {
    const cost = ds.costs.find(
      (c) => c.points !== null && new RegExp(`\\b${modelCount}\\b`).test(c.description),
    );
    points = cost?.points ?? ds.costs.find((c) => c.points !== null)?.points ?? null;
  }

  return {
    key,
    rosterName: unit.name,
    datasheetId: ds.id,
    datasheetName: ds.name,
    factionId: ds.factionId,
    modelCount,
    models,
    weapons,
    wargearDefaulted,
    enhancementIds,
    isWarlord: warlord,
    points,
    match,
  };
}

export function resolveRoster(draft: RosterDraft, lookup: RosterLookup): ResolvedArmy {
  const warnings = [...draft.warnings];
  let factionId = bestFaction(draft, lookup);

  // Expand "2x Unit" lines.
  const expanded: DraftUnit[] = draft.units.flatMap((u) =>
    Array.from({ length: Math.max(1, u.copies ?? 1) }, () => ({
      ...u,
      ...(u.points && u.copies ? { points: Math.round(u.points / u.copies) } : {}),
    })),
  );

  // Faction by majority vote of confident matches if the hints did not name it.
  if (!factionId) {
    const votes = new Map<string, number>();
    for (const u of expanded) {
      const top = rankDatasheets(u.name, lookup, null)[0];
      if (top && top.score >= 0.99) votes.set(top.factionId, (votes.get(top.factionId) ?? 0) + 1);
    }
    factionId = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    if (!factionId) warnings.push('Could not tell which faction this roster is for.');
  }

  let detachmentId: string | null = null;
  const pool = lookup.detachments.filter((d) => !factionId || d.factionId === factionId);
  const hintSources = [
    ...draft.detachmentHints,
    ...draft.units.flatMap((u) => u.items.map((i) => i.name)),
  ];
  let bestDet = 0;
  for (const hint of hintSources) {
    for (const d of pool) {
      const s =
        normalizeName(hint) === normalizeName(d.name)
          ? 1
          : normalizeName(hint).includes(normalizeName(d.name))
            ? 0.95
            : similarity(hint, d.name);
      if (s >= 0.9 && s > bestDet) {
        bestDet = s;
        detachmentId = d.id;
      }
    }
  }
  if (!detachmentId) warnings.push('No detachment recognised. Pick one on the army screen.');

  const units: ResolvedUnit[] = [];
  const unresolved: UnresolvedUnit[] = [];
  expanded.forEach((u, i) => {
    const key = `u${i + 1}`;
    const suggestions = rankDatasheets(u.name, lookup, factionId);
    const top = suggestions[0];
    const exact = top && normalizeName(top.name) === normalizeName(u.name);
    const ds =
      top && (exact || top.score >= FUZZY_THRESHOLD)
        ? lookup.datasheet(top.datasheetId)
        : undefined;
    if (!top || !ds) {
      unresolved.push({ key, draft: u, suggestions });
      return;
    }
    const method = top.name === u.name ? 'exact' : exact ? 'normalized' : 'fuzzy';
    if (method === 'fuzzy')
      warnings.push(`"${u.name}" matched to "${top.name}" by similarity. Check it.`);
    units.push(
      resolveUnit(
        key,
        u,
        ds,
        { method, score: Math.min(1, top.score) },
        lookup,
        detachmentId,
        warnings,
      ),
    );
  });

  return {
    name: draft.name ?? 'Imported roster',
    format: draft.format,
    factionId,
    detachmentId,
    points: draft.points ?? (units.length ? units.reduce((n, u) => n + (u.points ?? 0), 0) : null),
    units,
    unresolved,
    warnings,
  };
}

/** "Fix me" screen: the user picked a datasheet for an unresolved unit. */
export function assignDatasheet(
  army: ResolvedArmy,
  key: string,
  datasheetId: string,
  lookup: RosterLookup,
): ResolvedArmy {
  const entry = army.unresolved.find((u) => u.key === key);
  const ds = lookup.datasheet(datasheetId);
  if (!entry || !ds) return army;
  const warnings: string[] = [];
  const unit = resolveUnit(
    key,
    entry.draft,
    ds,
    { method: 'manual', score: 1 },
    lookup,
    army.detachmentId,
    warnings,
  );
  const order = (k: string) => Number(k.slice(1));
  return {
    ...army,
    units: [...army.units, unit].sort((a, b) => order(a.key) - order(b.key)),
    unresolved: army.unresolved.filter((u) => u.key !== key),
    warnings: [...army.warnings, ...warnings],
  };
}

/** Removes an unresolved unit the user does not want to fix. */
export function dropUnresolved(army: ResolvedArmy, key: string): ResolvedArmy {
  return { ...army, unresolved: army.unresolved.filter((u) => u.key !== key) };
}

/** Datasheet ids of every faction file a draft might need (for lazy loading in the browser). */
export function factionsToLoad(
  draft: RosterDraft,
  lookup: Omit<RosterLookup, 'datasheet'>,
): string[] {
  const ids = new Set<string>();
  const f = bestFaction(draft, { ...lookup, datasheet: () => undefined });
  if (f) ids.add(f);
  for (const u of draft.units) {
    const top = rankDatasheets(u.name, { ...lookup, datasheet: () => undefined }, f)[0];
    if (top) ids.add(top.factionId);
  }
  return [...ids];
}
