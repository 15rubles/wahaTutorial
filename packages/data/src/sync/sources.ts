/** Where the data lives. URLs only, no content. */
export const WAHAPEDIA_ORIGIN = 'https://wahapedia.ru';
export const EDITION_PATH = '/wh40k11ed';

/** CSV export files, as listed in the 11th edition export spec (see docs/data-schema.md). */
export const CSV_FILES = [
  'Factions',
  'Source',
  'Datasheets',
  'Datasheets_abilities',
  'Datasheets_keywords',
  'Datasheets_models',
  'Datasheets_options',
  'Datasheets_wargear',
  'Datasheets_unit_composition',
  'Datasheets_models_cost',
  'Datasheets_stratagems',
  'Datasheets_enhancements',
  'Datasheets_detachment_abilities',
  'Datasheets_leader',
  'Stratagems',
  'Abilities',
  'Enhancements',
  'Enhancements_wargear',
  'Detachment_abilities',
  'Detachments',
  'Detachments_chapter_dp',
] as const;

export type CsvFile = (typeof CSV_FILES)[number];

export const LAST_UPDATE_FILE = 'Last_update';

export interface SourceFile {
  /** Stable key, also the file name under data-cache/raw/. */
  readonly key: string;
  readonly url: string;
}

export function csvSource(name: string, origin = WAHAPEDIA_ORIGIN): SourceFile {
  return { key: `${name}.csv`, url: `${origin}${EDITION_PATH}/${name}.csv` };
}

export function coreRulesSource(origin = WAHAPEDIA_ORIGIN): SourceFile {
  return { key: 'core-rules.html', url: `${origin}${EDITION_PATH}/the-rules/core-rules/` };
}

export function rulesAppendixSource(origin = WAHAPEDIA_ORIGIN): SourceFile {
  return { key: 'rules-appendix.html', url: `${origin}${EDITION_PATH}/the-rules/rules-appendix/` };
}

export function robotsSource(origin = WAHAPEDIA_ORIGIN): SourceFile {
  return { key: 'robots.txt', url: `${origin}/robots.txt` };
}

export function allContentSources(origin = WAHAPEDIA_ORIGIN): SourceFile[] {
  return [
    ...CSV_FILES.map((f) => csvSource(f, origin)),
    coreRulesSource(origin),
    rulesAppendixSource(origin),
  ];
}
