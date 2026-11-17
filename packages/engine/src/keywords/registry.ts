import type { Weapon, WeaponKeyword } from '../types.js';
import { anti } from './anti.js';
import { blast } from './blast.js';
import { cleave } from './cleave.js';
import { devastatingWounds } from './devastatingWounds.js';
import { assault, closeQuarters, extraAttacks, indirectFire, oneShot, pistol } from './flags.js';
import { hazardous } from './hazardous.js';
import { heavy } from './heavy.js';
import { ignoresCover } from './ignoresCover.js';
import { lance } from './lance.js';
import { lethalHits } from './lethalHits.js';
import { melta } from './melta.js';
import { precision } from './precision.js';
import { psychic } from './psychic.js';
import { rapidFire } from './rapidFire.js';
import { sustainedHits } from './sustainedHits.js';
import { torrent } from './torrent.js';
import { twinLinked } from './twinLinked.js';
import type { KeywordModule } from './types.js';

const MODULES: readonly KeywordModule[] = [
  anti,
  assault,
  blast,
  cleave,
  closeQuarters,
  devastatingWounds,
  extraAttacks,
  hazardous,
  heavy,
  ignoresCover,
  indirectFire,
  lance,
  lethalHits,
  melta,
  oneShot,
  pistol,
  precision,
  psychic,
  rapidFire,
  sustainedHits,
  torrent,
  twinLinked,
];

const REGISTRY = new Map(MODULES.map((m) => [m.id, m]));

export function keywordModule(id: string): KeywordModule | undefined {
  return REGISTRY.get(id);
}

export const implementedKeywords: readonly string[] = MODULES.map((m) => m.id);

/** Keywords on a weapon that the engine does not implement (shown as "rules not simulated"). */
export function unimplementedKeywords(weapon: Weapon): WeaponKeyword[] {
  return weapon.keywords.filter((k) => !REGISTRY.has(k.id));
}

export function weaponHasFlag(
  weapon: Weapon,
  flag: NonNullable<KeywordModule['flags']>[number],
): boolean {
  return weapon.keywords.some((k) => REGISTRY.get(k.id)?.flags?.includes(flag));
}

export function hasKeywordId(weapon: Weapon, id: string): boolean {
  return weapon.keywords.some((k) => k.id === id);
}
