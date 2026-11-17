/**
 * Splits a weapon's keyword list (the `description` column of Datasheets_wargear) into structured
 * keywords. Only the shape is parsed here; what a keyword does lives in the engine.
 *
 * Seen shapes: `lethal hits`, `Rapid Fire 1`, `sustained hits d3`, `anti-infantry 4+`,
 * `ANTI-MONSTER/VEHICLE 4+`, and conditional forms `KEYWORD: non-MONSTER/VEHICLE`.
 */
export interface WeaponKeyword {
  /** Slug of the keyword name, for example `sustained-hits`, `anti`. */
  readonly id: string;
  /** Numeric or dice parameter as written, for example `1`, `d3`, `4+`. */
  readonly param?: string;
  /** For `anti-X`: the target keyword(s), lower case, for example `monster/vehicle`. */
  readonly target?: string;
  /** Text after a `:` that limits when the keyword applies, for example `non-MONSTER/VEHICLE`. */
  readonly condition?: string;
  readonly raw: string;
}

const PARAM = /^(\d+\+?|\d*d\d+(?:\+\d+)?)$/i;

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseWeaponKeyword(raw: string): WeaponKeyword | undefined {
  const text = raw.replace(/<[^>]+>/g, '').trim();
  if (!text) return undefined;
  let main = text;
  let condition: string | undefined;
  const colon = text.indexOf(':');
  if (colon >= 0) {
    main = text.slice(0, colon).trim();
    condition = text.slice(colon + 1).trim() || undefined;
  }
  const words = main.split(/\s+/);
  let param: string | undefined;
  if (words.length > 1 && PARAM.test(words.at(-1)!)) param = words.pop()!.toLowerCase();
  const name = words.join(' ');

  const anti = /^anti-(.+)$/i.exec(name);
  if (anti) {
    return {
      id: 'anti',
      target: anti[1]!.toLowerCase(),
      ...(param ? { param } : {}),
      ...(condition ? { condition } : {}),
      raw,
    };
  }
  const id = slugify(name);
  if (!id) return undefined;
  return { id, ...(param ? { param } : {}), ...(condition ? { condition } : {}), raw };
}

export function parseWeaponKeywords(description: string): WeaponKeyword[] {
  if (!description.trim()) return [];
  return description
    .split(',')
    .map(parseWeaponKeyword)
    .filter((k): k is WeaponKeyword => k !== undefined);
}
