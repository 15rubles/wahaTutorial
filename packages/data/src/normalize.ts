/**
 * Raw export CSV text -> normalized entities + a validation report. Pure: no file system access.
 */
import type { z } from 'zod';
import { type CsvRow, parseCsv } from './csv.js';
import {
  type Ability,
  AbilitySchema,
  type BuildReport,
  type CatalogEntry,
  type Datasheet,
  DatasheetSchema,
  type Detachment,
  type DetachmentAbility,
  DetachmentAbilitySchema,
  DetachmentSchema,
  type DiceExpr,
  type Enhancement,
  EnhancementSchema,
  type Faction,
  FactionSchema,
  type Keyword,
  type ModelProfile,
  type Publication,
  PublicationSchema,
  type ReportIssue,
  type Stratagem,
  StratagemSchema,
  type WeaponProfile,
} from './schema.js';
import { isEmptyValue, parseBool, parseDice, parseLeadingInt, parseRange } from './values.js';
import { parseWeaponKeywords, slugify } from './weaponKeywords.js';

export const EXPLANATIONS: Record<string, string> = {
  'malformed-record': 'A record in the CSV had the wrong number of fields and was skipped.',
  'missing-file': 'An expected CSV file is not in the raw cache. Run npm run data:sync.',
  'invalid-row': 'A row failed schema validation after parsing and was dropped.',
  'orphan-reference':
    'A row refers to a parent id (datasheet, detachment, enhancement) that does not exist. The row is ignored.',
  'unparsed-value':
    'A characteristic could not be parsed (for example a symbol instead of a number). A safe default was used.',
  'wargear-without-profile':
    'A wargear row has no Ranged / Melee type. These are notes or non-weapon wargear and are not weapons.',
  'model-without-profile':
    'A model row has no usable Toughness / Wounds. Usually a placeholder model line. It is dropped.',
  'duplicate-id': 'Two rows have the same id. The first one is kept.',
};

export interface NormalizedData {
  factions: Faction[];
  publications: Publication[];
  datasheets: Datasheet[];
  abilities: Ability[];
  stratagems: Stratagem[];
  enhancements: Enhancement[];
  detachmentAbilities: DetachmentAbility[];
  detachments: Detachment[];
  keywords: Keyword[];
  catalog: CatalogEntry[];
  report: BuildReport;
}

export interface NormalizeOptions {
  readonly origin?: string;
  readonly now?: string;
}

type Files = Readonly<Record<string, string | undefined>>;

class Reporter {
  readonly errors: ReportIssue[] = [];
  readonly warnings: ReportIssue[] = [];
  error(issue: ReportIssue) {
    this.errors.push(issue);
  }
  warn(issue: ReportIssue) {
    this.warnings.push(issue);
  }
}

function groupBy<T>(items: readonly T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

const v = (row: CsvRow, name: string): string => (row.values[name] ?? '').trim();
const vRaw = (row: CsvRow, name: string): string => row.values[name] ?? '';
const int = (row: CsvRow, name: string): number => parseLeadingInt(v(row, name)) ?? 0;

export function normalize(files: Files, options: NormalizeOptions = {}): NormalizedData {
  const origin = options.origin ?? 'https://wahapedia.ru';
  const report = new Reporter();
  const tables = new Map<string, readonly CsvRow[]>();

  const table = (name: string): readonly CsvRow[] => {
    const cached = tables.get(name);
    if (cached) return cached;
    const file = `${name}.csv`;
    const text = files[file];
    if (text === undefined) {
      report.error({ file, line: 0, category: 'missing-file', message: 'file not found' });
      tables.set(name, []);
      return [];
    }
    const parsed = parseCsv(text);
    for (const m of parsed.malformed)
      report.error({ file, line: m.line, category: 'malformed-record', message: m.reason });
    tables.set(name, parsed.rows);
    return parsed.rows;
  };

  function validate<T>(
    schema: z.ZodType<T>,
    value: unknown,
    file: string,
    row: CsvRow,
    id: string,
  ): T | undefined {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    const message = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    report.error({ file, line: row.line, id, category: 'invalid-row', message });
    return undefined;
  }

  function dedupe<T extends { id: string }>(items: (T | undefined)[], file: string): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of items) {
      if (!item) continue;
      if (seen.has(item.id)) {
        report.warn({
          file,
          line: 0,
          id: item.id,
          category: 'duplicate-id',
          message: 'duplicate id',
        });
        continue;
      }
      seen.add(item.id);
      out.push(item);
    }
    return out;
  }

  // Factions
  const factionRows = table('Factions');
  const factionLinks = new Map(factionRows.map((r) => [v(r, 'id'), v(r, 'link')]));

  // Publications
  const publications = dedupe(
    table('Source').map((r) =>
      validate(
        PublicationSchema,
        {
          id: v(r, 'id'),
          sourceId: v(r, 'id'),
          sourceUrl: v(r, 'errata_link'),
          name: v(r, 'name'),
          type: v(r, 'type'),
          edition: v(r, 'edition'),
          version: v(r, 'version'),
          errataDate: v(r, 'errata_date'),
        },
        'Source.csv',
        r,
        v(r, 'id'),
      ),
    ),
    'Source.csv',
  );

  // Shared abilities. The same id appears once per faction that has the ability: merge them.
  const abilityRows = groupBy(table('Abilities'), (r) => v(r, 'id'));
  const abilities: Ability[] = [];
  for (const [id, rows] of abilityRows) {
    const r = rows[0]!;
    const factionIds = [...new Set(rows.map((x) => v(x, 'faction_id')).filter(Boolean))];
    const ability = validate(
      AbilitySchema,
      {
        id,
        sourceId: id,
        sourceUrl:
          factionLinks.get(factionIds[0] ?? '') ?? `${origin}/wh40k11ed/the-rules/core-rules/`,
        name: v(r, 'name'),
        factionIds,
        legendHtml: vRaw(r, 'legend'),
        descriptionHtml: vRaw(r, 'description'),
      },
      'Abilities.csv',
      r,
      id,
    );
    if (ability) abilities.push(ability);
  }

  const stratagems = dedupe(
    table('Stratagems').map((r) =>
      validate(
        StratagemSchema,
        {
          id: v(r, 'id'),
          sourceId: v(r, 'id'),
          sourceUrl:
            factionLinks.get(v(r, 'faction_id')) ?? `${origin}/wh40k11ed/the-rules/core-rules/`,
          name: v(r, 'name'),
          factionId: v(r, 'faction_id'),
          type: v(r, 'type'),
          cpCost: parseLeadingInt(v(r, 'cp_cost')) ?? null,
          legendHtml: vRaw(r, 'legend'),
          turn: v(r, 'turn'),
          phase: v(r, 'phase'),
          detachment: v(r, 'detachment'),
          detachmentId: v(r, 'detachment_id'),
          descriptionHtml: vRaw(r, 'description'),
        },
        'Stratagems.csv',
        r,
        v(r, 'id'),
      ),
    ),
    'Stratagems.csv',
  );

  // Weapons (shared by datasheets and enhancements)
  function weapon(r: CsvRow, file: string): WeaponProfile | undefined {
    const typeRaw = v(r, 'type').toLowerCase();
    if (typeRaw !== 'ranged' && typeRaw !== 'melee') {
      report.warn({
        file,
        line: r.line,
        category: 'wargear-without-profile',
        message: `type "${v(r, 'type')}"`,
      });
      return undefined;
    }
    const dice = (field: string, fallback: number): DiceExpr => {
      const raw = v(r, field);
      const parsed = parseDice(raw);
      if (parsed) return parsed;
      if (!isEmptyValue(raw))
        report.warn({
          file,
          line: r.line,
          category: 'unparsed-value',
          message: `${field} "${raw}"`,
        });
      return { dice: 0, sides: 0, plus: fallback, raw };
    };
    const skillRaw = v(r, 'BS_WS');
    const skill = isEmptyValue(skillRaw) ? null : (parseLeadingInt(skillRaw) ?? null);
    const range = typeRaw === 'melee' ? null : (parseRange(v(r, 'range')) ?? null);
    const apRaw = v(r, 'AP');
    const ap = isEmptyValue(apRaw) ? 0 : parseLeadingInt(apRaw);
    if (ap === undefined)
      report.warn({ file, line: r.line, category: 'unparsed-value', message: `AP "${apRaw}"` });
    return {
      line: int(r, 'line'),
      lineInWargear: int(r, 'line_in_wargear'),
      name: v(r, 'name'),
      type: typeRaw,
      range,
      attacks: dice('A', 1),
      skill: skill !== null && skill >= 2 && skill <= 6 ? skill : null,
      strength: dice('S', 1),
      ap: Math.min(0, ap ?? 0),
      damage: dice('D', 1),
      keywords: parseWeaponKeywords(v(r, 'description')),
      keywordsRaw: v(r, 'description'),
      dice: v(r, 'dice'),
    };
  }

  const enhancementWeapons = groupBy(table('Enhancements_wargear'), (r) => v(r, 'enhancement_id'));
  const enhancements = dedupe(
    table('Enhancements').map((r) =>
      validate(
        EnhancementSchema,
        {
          id: v(r, 'id'),
          sourceId: v(r, 'id'),
          sourceUrl: factionLinks.get(v(r, 'faction_id')) ?? '',
          name: v(r, 'name'),
          factionId: v(r, 'faction_id'),
          legendHtml: vRaw(r, 'legend'),
          descriptionHtml: vRaw(r, 'description'),
          points: parseLeadingInt(v(r, 'cost')) ?? null,
          detachment: v(r, 'detachment'),
          detachmentId: v(r, 'detachment_id'),
          upgrade: parseBool(v(r, 'upgrade')),
          supportLeader: v(r, 'support_leader'),
          weapons: (enhancementWeapons.get(v(r, 'id')) ?? [])
            .map((w) => weapon(w, 'Enhancements_wargear.csv'))
            .filter((w): w is WeaponProfile => w !== undefined),
        },
        'Enhancements.csv',
        r,
        v(r, 'id'),
      ),
    ),
    'Enhancements.csv',
  );
  const enhancementIds = new Set(enhancements.map((e) => e.id));
  for (const [id, rows] of enhancementWeapons) {
    if (!enhancementIds.has(id)) {
      for (const r of rows)
        report.warn({
          file: 'Enhancements_wargear.csv',
          line: r.line,
          id,
          category: 'orphan-reference',
          message: 'unknown enhancement',
        });
    }
  }

  const detachmentAbilities = dedupe(
    table('Detachment_abilities').map((r) =>
      validate(
        DetachmentAbilitySchema,
        {
          id: v(r, 'id'),
          sourceId: v(r, 'id'),
          sourceUrl: factionLinks.get(v(r, 'faction_id')) ?? '',
          name: v(r, 'name'),
          factionId: v(r, 'faction_id'),
          legendHtml: vRaw(r, 'legend'),
          descriptionHtml: vRaw(r, 'description'),
          detachment: v(r, 'detachment'),
          detachmentId: v(r, 'detachment_id'),
        },
        'Detachment_abilities.csv',
        r,
        v(r, 'id'),
      ),
    ),
    'Detachment_abilities.csv',
  );

  const chapterDp = groupBy(table('Detachments_chapter_dp'), (r) => v(r, 'detachment_id'));
  const byDetachment = <T extends { detachmentId: string; id: string }>(items: T[]) =>
    groupBy(items, (i) => i.detachmentId);
  const abilitiesByDet = byDetachment(detachmentAbilities);
  const stratsByDet = byDetachment(stratagems);
  const enhByDet = byDetachment(enhancements);
  const detachments = dedupe(
    table('Detachments').map((r) =>
      validate(
        DetachmentSchema,
        {
          id: v(r, 'id'),
          sourceId: v(r, 'id'),
          sourceUrl: factionLinks.get(v(r, 'faction_id')) ?? '',
          name: v(r, 'name'),
          factionId: v(r, 'faction_id'),
          legendHtml: vRaw(r, 'legend'),
          type: v(r, 'type'),
          detachmentPoints: parseLeadingInt(v(r, 'dp')) ?? null,
          forceDispositions: v(r, 'force_disposition')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          keywordPoints: (chapterDp.get(v(r, 'id')) ?? []).map((c) => ({
            keyword: v(c, 'keyword'),
            points: int(c, 'dp'),
          })),
          abilityIds: (abilitiesByDet.get(v(r, 'id')) ?? []).map((a) => a.id),
          stratagemIds: (stratsByDet.get(v(r, 'id')) ?? []).map((a) => a.id),
          enhancementIds: (enhByDet.get(v(r, 'id')) ?? []).map((a) => a.id),
        },
        'Detachments.csv',
        r,
        v(r, 'id'),
      ),
    ),
    'Detachments.csv',
  );

  // Datasheet children
  const datasheetRows = table('Datasheets');
  const datasheetIds = new Set(datasheetRows.map((r) => v(r, 'id')));
  const child = (name: string, key = 'datasheet_id') => {
    const rows = table(name);
    const grouped = groupBy(rows, (r) => v(r, key));
    for (const [id, list] of grouped) {
      if (!datasheetIds.has(id)) {
        for (const r of list)
          report.warn({
            file: `${name}.csv`,
            line: r.line,
            id,
            category: 'orphan-reference',
            message: 'unknown datasheet',
          });
      }
    }
    return grouped;
  };
  const models = child('Datasheets_models');
  const wargear = child('Datasheets_wargear');
  const dsAbilities = child('Datasheets_abilities');
  const dsKeywords = child('Datasheets_keywords');
  const composition = child('Datasheets_unit_composition');
  const costs = child('Datasheets_models_cost');
  const wargearOptions = child('Datasheets_options');
  const dsStrats = child('Datasheets_stratagems');
  const dsEnh = child('Datasheets_enhancements');
  const dsDetAb = child('Datasheets_detachment_abilities');
  const leaders = table('Datasheets_leader');
  const canLead = groupBy(leaders, (r) => v(r, 'leader_id'));
  const ledBy = groupBy(leaders, (r) => v(r, 'attached_id'));

  function model(r: CsvRow): ModelProfile | undefined {
    const file = 'Datasheets_models.csv';
    const t = parseLeadingInt(v(r, 'T'));
    const w = parseLeadingInt(v(r, 'W'));
    if (!t || !w) {
      report.warn({
        file,
        line: r.line,
        id: v(r, 'datasheet_id'),
        category: 'model-without-profile',
        message: `T "${v(r, 'T')}" W "${v(r, 'W')}"`,
      });
      return undefined;
    }
    const num = (field: string, fallback: number, min: number, max: number): number => {
      const raw = v(r, field);
      // A dash means the model has no value for this characteristic (for example OC on a fortification).
      if (raw === '-') return fallback;
      const n = parseLeadingInt(raw);
      if (n === undefined || n < min || n > max) {
        report.warn({
          file,
          line: r.line,
          id: v(r, 'datasheet_id'),
          category: 'unparsed-value',
          message: `${field} "${raw}"`,
        });
        return fallback;
      }
      return n;
    };
    const invRaw = v(r, 'inv_sv');
    const inv = isEmptyValue(invRaw) ? null : (parseLeadingInt(invRaw) ?? null);
    return {
      line: int(r, 'line'),
      name: v(r, 'name'),
      movement: isEmptyValue(v(r, 'M')) ? null : (parseLeadingInt(v(r, 'M')) ?? null),
      movementRaw: v(r, 'M'),
      toughness: t,
      save: num('Sv', 7, 2, 7),
      invuln: inv !== null && inv >= 2 && inv <= 6 ? inv : null,
      invulnNoteHtml: vRaw(r, 'inv_sv_descr'),
      wounds: w,
      leadership: num('Ld', 7, 2, 12),
      objectiveControl: num('OC', 0, 0, 99),
      baseSize: v(r, 'base_size'),
      baseSizeNote: v(r, 'base_size_descr'),
    };
  }

  const sortByLine = <T extends { line: number }>(items: T[]) =>
    items.sort((a, b) => a.line - b.line);
  const ids = (rows: CsvRow[] | undefined, field: string) => [
    ...new Set((rows ?? []).map((r) => v(r, field))),
  ];

  const datasheets = dedupe(
    datasheetRows.map((r) => {
      const id = v(r, 'id');
      const damagedW = v(r, 'damaged_w');
      return validate(
        DatasheetSchema,
        {
          id,
          sourceId: id,
          sourceUrl: v(r, 'link'),
          name: v(r, 'name'),
          factionId: v(r, 'faction_id'),
          publicationId: v(r, 'source_id'),
          role: v(r, 'role'),
          legendHtml: vRaw(r, 'legend'),
          loadoutHtml: vRaw(r, 'loadout'),
          transportHtml: vRaw(r, 'transport'),
          virtual: parseBool(v(r, 'virtual')),
          isSupport: parseBool(v(r, 'is_support')),
          leaderHeadHtml: vRaw(r, 'leader_head'),
          leaderFooterHtml: vRaw(r, 'leader_footer'),
          damaged: damagedW
            ? { wounds: damagedW, descriptionHtml: vRaw(r, 'damaged_description') }
            : null,
          models: sortByLine(
            (models.get(id) ?? []).map(model).filter((m): m is ModelProfile => m !== undefined),
          ),
          weapons: sortByLine(
            (wargear.get(id) ?? [])
              .map((w) => weapon(w, 'Datasheets_wargear.csv'))
              .filter((w): w is WeaponProfile => w !== undefined),
          ),
          abilities: sortByLine(
            (dsAbilities.get(id) ?? []).map((a) => ({
              line: int(a, 'line'),
              ...(v(a, 'ability_id') ? { abilityId: v(a, 'ability_id') } : {}),
              model: v(a, 'model'),
              name: v(a, 'name'),
              descriptionHtml: vRaw(a, 'description'),
              type: v(a, 'type'),
              parameter: v(a, 'parameter'),
            })),
          ),
          keywords: (dsKeywords.get(id) ?? [])
            .filter((k) => v(k, 'keyword'))
            .map((k) => ({
              keyword: v(k, 'keyword'),
              model: v(k, 'model'),
              isFactionKeyword: parseBool(v(k, 'is_faction_keyword')),
            })),
          composition: sortByLine(
            (composition.get(id) ?? []).map((c) => ({
              line: int(c, 'line'),
              html: vRaw(c, 'description'),
            })),
          ),
          costs: sortByLine(
            (costs.get(id) ?? []).map((c) => ({
              line: int(c, 'line'),
              description: v(c, 'description'),
              points: parseLeadingInt(v(c, 'cost')) ?? null,
            })),
          ),
          options: sortByLine(
            (wargearOptions.get(id) ?? []).map((o) => ({
              line: int(o, 'line'),
              html: vRaw(o, 'description'),
            })),
          ),
          canLead: ids(canLead.get(id), 'attached_id'),
          ledBy: ids(ledBy.get(id), 'leader_id'),
          stratagemIds: ids(dsStrats.get(id), 'stratagem_id'),
          enhancementIds: ids(dsEnh.get(id), 'enhancement_id'),
          detachmentAbilityIds: ids(dsDetAb.get(id), 'detachment_ability_id'),
        },
        'Datasheets.csv',
        r,
        id,
      );
    }),
    'Datasheets.csv',
  );

  // Shared ability references
  const abilityIds = new Set(abilities.map((a) => a.id));
  for (const ds of datasheets) {
    for (const a of ds.abilities) {
      if (a.abilityId && !abilityIds.has(a.abilityId)) {
        report.warn({
          file: 'Datasheets_abilities.csv',
          line: 0,
          id: ds.id,
          category: 'orphan-reference',
          message: `unknown ability ${a.abilityId}`,
        });
      }
    }
  }

  const perFaction = groupBy(datasheets, (d) => d.factionId);
  const factions = dedupe(
    factionRows.map((r) =>
      validate(
        FactionSchema,
        {
          id: v(r, 'id'),
          sourceId: v(r, 'id'),
          sourceUrl: v(r, 'link'),
          name: v(r, 'name'),
          datasheetCount: perFaction.get(v(r, 'id'))?.length ?? 0,
        },
        'Factions.csv',
        r,
        v(r, 'id'),
      ),
    ),
    'Factions.csv',
  );

  // Keyword vocabulary
  const unitKw = new Map<string, { name: string; uses: number }>();
  const weaponKw = new Map<string, { name: string; uses: number }>();
  for (const ds of datasheets) {
    for (const k of ds.keywords) {
      const id = slugify(k.keyword);
      const e = unitKw.get(id) ?? { name: k.keyword, uses: 0 };
      e.uses += 1;
      unitKw.set(id, e);
    }
  }
  for (const w of [
    ...datasheets.flatMap((d) => d.weapons),
    ...enhancements.flatMap((e) => e.weapons),
  ]) {
    for (const k of w.keywords) {
      const e = weaponKw.get(k.id) ?? { name: k.id, uses: 0 };
      e.uses += 1;
      weaponKw.set(k.id, e);
    }
  }
  const keywords: Keyword[] = [
    ...[...unitKw].map(([id, e]) => ({ id, name: e.name, kind: 'unit' as const, uses: e.uses })),
    ...[...weaponKw].map(([id, e]) => ({
      id,
      name: e.name,
      kind: 'weapon' as const,
      uses: e.uses,
    })),
  ].sort((a, b) => b.uses - a.uses);

  const catalog: CatalogEntry[] = datasheets.map((d) => ({
    id: d.id,
    name: d.name,
    factionId: d.factionId,
    role: d.role,
    keywords: [...new Set(d.keywords.map((k) => k.keyword))],
    virtual: d.virtual,
  }));

  const counts = {
    factions: factions.length,
    publications: publications.length,
    datasheets: datasheets.length,
    models: datasheets.reduce((n, d) => n + d.models.length, 0),
    weapons: datasheets.reduce((n, d) => n + d.weapons.length, 0),
    abilities: abilities.length,
    stratagems: stratagems.length,
    enhancements: enhancements.length,
    detachmentAbilities: detachmentAbilities.length,
    detachments: detachments.length,
    keywords: keywords.length,
  };

  const used = new Set([...report.errors, ...report.warnings].map((i) => i.category));
  const explanations = Object.fromEntries(
    Object.entries(EXPLANATIONS).filter(([k]) => used.has(k)),
  );

  return {
    factions,
    publications,
    datasheets,
    abilities,
    stratagems,
    enhancements,
    detachmentAbilities,
    detachments,
    keywords,
    catalog,
    report: {
      builtAt: options.now ?? new Date().toISOString(),
      counts,
      errors: report.errors,
      warnings: report.warnings,
      explanations,
      unresolvedKeywords: [],
    },
  };
}
