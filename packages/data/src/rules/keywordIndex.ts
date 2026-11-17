/**
 * Links keywords and shared abilities to RuleSection ids.
 * Matching is by slug: a weapon keyword `lethal-hits` matches the core ability section whose title
 * slugs to `lethal-hits`. Combined boxes ("LEADER / SUPPORT") match each part. Unit keywords match a
 * section title, its plural, or a small alias table of section slugs (our own mapping, no rule text).
 */
import type { NormalizedData } from '../normalize.js';
import type { BuildReport, Keyword, RuleSection } from '../schema.js';
import { slugify } from '../weaponKeywords.js';
import { flattenRules } from './parseCoreRules.js';

/** Unit keyword slug -> candidate section title slugs, when the keyword is not a section title itself. */
export const UNIT_KEYWORD_ALIASES: Readonly<Record<string, readonly string[]>> = {
  monster: ['monsters-and-vehicles'],
  vehicle: ['monsters-and-vehicles'],
  walker: ['monsters-and-vehicles'],
  transport: ['transports', 'transport-capacity'],
  'dedicated-transport': ['transports'],
  fly: ['flying-models', 'flying-and-surging'],
  aircraft: ['aircraft'],
  'super-heavy-walker': ['super-heavy-walker'],
  psyker: ['psychic-abilities'],
};

export interface RulesIndex {
  anchors: Record<string, string>;
  codes: Record<string, string>;
  weaponKeywords: Record<string, string>;
  unitKeywords: Record<string, string>;
  /** Shared ability id (abilities.json) -> rule id. */
  abilities: Record<string, string>;
  /** Unresolved keyword slug -> sections that mention it as a keyword (up to 5), for "see also" links. */
  mentions: Record<string, string[]>;
}

export interface KeywordIndexResult {
  index: RulesIndex;
  keywords: Keyword[];
  unresolved: BuildReport['unresolvedKeywords'];
  identityKeywords: number;
}

export function buildKeywordIndex(
  roots: readonly RuleSection[],
  data: Pick<NormalizedData, 'keywords' | 'datasheets' | 'abilities'>,
  base: { anchors: Record<string, string>; codes: Record<string, string> },
): KeywordIndexResult {
  const flat = flattenRules(roots).filter((s) => s.kind !== 'group');
  const abilityBySlug = new Map<string, string>();
  const sectionBySlug = new Map<string, string>();
  for (const s of flat) {
    const parts = [s.title, ...s.title.split(' / ')].map(slugify).filter(Boolean);
    for (const slug of parts) {
      if (s.kind === 'ability' && !abilityBySlug.has(slug)) abilityBySlug.set(slug, s.id);
      if (!sectionBySlug.has(slug)) sectionBySlug.set(slug, s.id);
    }
  }

  const identity = new Set<string>();
  for (const d of data.datasheets) {
    identity.add(slugify(d.name));
    for (const k of d.keywords) if (k.isFactionKeyword) identity.add(slugify(k.keyword));
  }

  const resolveUnit = (slug: string): string | undefined => {
    const candidates = [slug, `${slug}s`, ...(UNIT_KEYWORD_ALIASES[slug] ?? [])];
    for (const c of candidates) {
      const hit = abilityBySlug.get(c) ?? sectionBySlug.get(c);
      if (hit) return hit;
    }
    return undefined;
  };

  const index: RulesIndex = {
    ...base,
    weaponKeywords: {},
    unitKeywords: {},
    abilities: {},
    mentions: {},
  };
  const unresolved: BuildReport['unresolvedKeywords'] = [];
  let identityKeywords = 0;
  const keywords: Keyword[] = data.keywords.map((k) => {
    const ruleId =
      k.kind === 'weapon'
        ? (abilityBySlug.get(k.id) ?? sectionBySlug.get(k.id))
        : resolveUnit(k.id);
    if (ruleId) {
      (k.kind === 'weapon' ? index.weaponKeywords : index.unitKeywords)[k.id] = ruleId;
      return { ...k, ruleId };
    }
    if (k.kind === 'unit' && identity.has(k.id)) identityKeywords += 1;
    else unresolved.push({ kind: k.kind, keyword: k.name, uses: k.uses });
    return k;
  });

  // Keyword mentions: section html marks keywords as <span class="kwb">WORD</span> (one span per word).
  const kwText = new Map<string, string>();
  for (const s of flat) {
    const words = [...s.html.matchAll(/<span class="kwb">([^<]*)<\/span>/g)].map((m) =>
      m[1]!.replace(/[[\]]/g, ''),
    );
    kwText.set(s.id, ` ${words.join(' ').toLowerCase()} `);
  }
  for (const u of unresolved) {
    const needle = ` ${u.keyword.toLowerCase()} `;
    const hits = flat.filter((s) => kwText.get(s.id)!.includes(needle)).map((s) => s.id);
    if (hits.length) index.mentions[slugify(u.keyword)] = hits.slice(0, 5);
  }

  for (const a of data.abilities) {
    const slug = slugify(a.name);
    const hit = abilityBySlug.get(slug) ?? abilityBySlug.get(slug.replace(/-\d+$/, ''));
    if (hit) index.abilities[a.id] = hit;
  }
  return { index, keywords, unresolved, identityKeywords };
}
