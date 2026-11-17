/**
 * Builds engine UnitState from a normalized datasheet plus roster choices. Type-only dependency on
 * the data package: no rule text is read here, only characteristics and keyword ids.
 */
import type { Datasheet, ModelProfile, WeaponProfile } from '@battle-drill/data';
import type { ModelState, PlayerId, UnitState, Weapon } from '../types.js';

export interface UnitChoices {
  readonly id: string;
  readonly player: PlayerId;
  readonly modelCount?: number;
  /** Model lines from the roster: profile name and count. */
  readonly models?: readonly { readonly name: string; readonly count: number }[];
  /** Weapons and how many models carry each. Defaults to every weapon on every model. */
  readonly weapons?: readonly { readonly name: string; readonly count: number }[];
  /** Name of a shared ability by id, used to spot Feel No Pain. */
  readonly abilityName?: (id: string) => string | undefined;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function toWeapon(w: WeaponProfile): Weapon {
  return {
    name: w.name,
    type: w.type,
    range: w.range,
    attacks: w.attacks,
    skill: w.skill,
    strength: w.strength,
    ap: w.ap,
    damage: w.damage,
    keywords: w.keywords.map((k) => ({
      id: k.id,
      ...(k.param !== undefined ? { param: k.param } : {}),
      ...(k.target !== undefined ? { target: k.target } : {}),
      ...(k.condition !== undefined ? { condition: k.condition } : {}),
    })),
  };
}

/** Base size like `32mm`, `60mm oval`, `Use model` -> radius in inches. */
export function baseRadius(baseSize: string, keywords: readonly string[]): number {
  const mm = /(\d+(?:\.\d+)?)\s*(?:x\s*(\d+(?:\.\d+)?))?\s*mm/i.exec(baseSize);
  if (mm) {
    const a = Number(mm[1]);
    const b = mm[2] ? Number(mm[2]) : a;
    return Math.max(a, b) / 25.4 / 2;
  }
  if (keywords.includes('VEHICLE') || keywords.includes('MONSTER')) return 2;
  return 0.6;
}

function feelNoPain(
  ds: Datasheet,
  abilityName?: (id: string) => string | undefined,
): number | null {
  for (const a of ds.abilities) {
    const name = a.name || (a.abilityId ? abilityName?.(a.abilityId) : '') || '';
    if (!/feel no pain/i.test(name)) continue;
    const m = /(\d)\+/.exec(a.parameter) ?? /(\d)\+/.exec(name);
    if (m) return Number(m[1]);
  }
  return null;
}

/** Core abilities the engine knows about, as slugs. */
const CORE_ABILITIES = [
  'deep-strike',
  'infiltrators',
  'scouts',
  'stealth',
  'lone-operative',
  'fights-first',
  'leader',
  'support',
];

function coreAbilities(ds: Datasheet, abilityName?: (id: string) => string | undefined): string[] {
  const out = new Set<string>();
  for (const a of ds.abilities) {
    const name = (a.name || (a.abilityId ? abilityName?.(a.abilityId) : '') || '').toLowerCase();
    const slug = name.replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
    for (const c of CORE_ABILITIES) if (slug === c || slug.startsWith(`${c}-`)) out.add(c);
  }
  return [...out];
}

/** Transport capacity from the datasheet text: the first number of models it mentions. */
function transportOf(ds: Datasheet, keywords: readonly string[]): Pick<UnitState, 'transport'> {
  if (!keywords.includes('TRANSPORT') || !ds.transportHtml) return {};
  const text = ds.transportHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const m = /capacity of (\d+)/i.exec(text) ?? /(\d+)\s+[^.]*?models?/i.exec(text);
  return m ? { transport: { capacity: Number(m[1]), text } } : {};
}

function pickProfile(profiles: readonly ModelProfile[], name: string): ModelProfile {
  const n = norm(name);
  return (
    profiles.find((p) => norm(p.name) === n) ??
    profiles.find((p) => n.includes(norm(p.name)) || norm(p.name).includes(n)) ??
    profiles[profiles.length > 1 ? profiles.length - 1 : 0]!
  );
}

export function unitFromDatasheet(ds: Datasheet, choices: UnitChoices): UnitState {
  const keywords = [
    ...new Set(ds.keywords.filter((k) => !k.model).map((k) => k.keyword.toUpperCase())),
  ];
  const weapons = ds.weapons.map(toWeapon);
  const profiles = ds.models.length > 0 ? ds.models : [];
  if (profiles.length === 0) throw new Error(`Datasheet ${ds.id} has no model profiles`);

  const lines =
    choices.models && choices.models.length > 0
      ? choices.models.map((m) => ({ profile: pickProfile(profiles, m.name), count: m.count }))
      : [{ profile: profiles[0]!, count: Math.max(1, choices.modelCount ?? 1) }];
  const isCharacter = keywords.includes('CHARACTER');
  const fnp = feelNoPain(ds, choices.abilityName);

  const models: ModelState[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.count; i++) {
      const p = line.profile;
      models.push({
        id: `${choices.id}-m${models.length + 1}`,
        name: p.name || ds.name,
        toughness: p.toughness,
        save: p.save,
        invuln: p.invuln,
        wounds: p.wounds,
        woundsLeft: p.wounds,
        leadership: p.leadership,
        objectiveControl: p.objectiveControl,
        movement: p.movement,
        isCharacter,
        feelNoPain: fnp,
        weapons: [],
        baseRadius: baseRadius(p.baseSize, keywords),
        position: null,
        destroyed: false,
      });
    }
  }

  // Hand out weapons: each weapon goes to as many models as its count, in model order.
  const loadout = choices.weapons ?? weapons.map((w) => ({ name: w.name, count: models.length }));
  const carried = models.map(() => [] as string[]);
  for (const w of loadout) {
    if (!weapons.some((x) => x.name === w.name)) continue;
    for (let i = 0; i < Math.min(w.count, models.length); i++) carried[i]!.push(w.name);
  }
  return {
    id: choices.id,
    name: ds.name,
    player: choices.player,
    datasheetId: ds.id,
    keywords,
    weapons,
    models: models.map((m, i) => ({ ...m, weapons: carried[i]! })),
    startingStrength: models.length,
    abilities: coreAbilities(ds, choices.abilityName),
    ...transportOf(ds, keywords),
  };
}
