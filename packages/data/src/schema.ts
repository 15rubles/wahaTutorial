/**
 * Our own normalized schema. Browser safe (Zod only, no Node APIs).
 * Every entity keeps `sourceId` (Wahapedia id) and `sourceUrl` (a page on Wahapedia).
 * Text fields ending in `Html` hold the HTML from the export as is. That text is GW content and
 * only ever lives in the local data cache.
 */
import { z } from 'zod';

export const DiceExprSchema = z.object({
  dice: z.number().int().min(0),
  sides: z.number().int().min(0),
  plus: z.number().int(),
  raw: z.string(),
});
export type DiceExpr = z.infer<typeof DiceExprSchema>;

const Source = {
  sourceId: z.string().min(1),
  sourceUrl: z.string(),
};

export const FactionSchema = z.object({
  id: z.string().min(1),
  ...Source,
  name: z.string().min(1),
  datasheetCount: z.number().int().min(0),
});
export type Faction = z.infer<typeof FactionSchema>;

export const PublicationSchema = z.object({
  id: z.string().min(1),
  ...Source,
  name: z.string(),
  type: z.string(),
  edition: z.string(),
  version: z.string(),
  errataDate: z.string(),
});
export type Publication = z.infer<typeof PublicationSchema>;

export const ModelProfileSchema = z.object({
  line: z.number().int(),
  name: z.string(),
  /** Inches. null when the profile has no movement value. */
  movement: z.number().nullable(),
  movementRaw: z.string(),
  toughness: z.number().int().positive(),
  /** Save target, e.g. 3 for 3+. */
  save: z.number().int().min(2).max(7),
  /** Invulnerable save target, null if none. */
  invuln: z.number().int().min(2).max(6).nullable(),
  invulnNoteHtml: z.string(),
  wounds: z.number().int().positive(),
  /** Leadership target, e.g. 6 for 6+. */
  leadership: z.number().int().min(2).max(12),
  objectiveControl: z.number().int().min(0),
  baseSize: z.string(),
  baseSizeNote: z.string(),
});
export type ModelProfile = z.infer<typeof ModelProfileSchema>;

export const WeaponKeywordSchema = z.object({
  id: z.string().min(1),
  param: z.string().optional(),
  target: z.string().optional(),
  condition: z.string().optional(),
  raw: z.string(),
});
export type WeaponKeywordRef = z.infer<typeof WeaponKeywordSchema>;

export const WeaponProfileSchema = z.object({
  line: z.number().int(),
  lineInWargear: z.number().int(),
  name: z.string().min(1),
  type: z.enum(['ranged', 'melee']),
  /** Inches; null for melee weapons. */
  range: z.number().nullable(),
  attacks: DiceExprSchema,
  /** BS or WS target (3 for 3+); null when the weapon has no skill value. */
  skill: z.number().int().min(2).max(6).nullable(),
  strength: DiceExprSchema,
  /** AP as a non-positive integer, e.g. -2. */
  ap: z.number().int().max(0),
  damage: DiceExprSchema,
  keywords: z.array(WeaponKeywordSchema),
  keywordsRaw: z.string(),
  dice: z.string(),
});
export type WeaponProfile = z.infer<typeof WeaponProfileSchema>;

export const DatasheetAbilitySchema = z.object({
  line: z.number().int(),
  /** Link into abilities.json for shared (core / faction) abilities. */
  abilityId: z.string().optional(),
  model: z.string(),
  name: z.string(),
  descriptionHtml: z.string(),
  type: z.string(),
  parameter: z.string(),
});
export type DatasheetAbility = z.infer<typeof DatasheetAbilitySchema>;

export const UnitKeywordSchema = z.object({
  keyword: z.string().min(1),
  model: z.string(),
  isFactionKeyword: z.boolean(),
});
export type UnitKeyword = z.infer<typeof UnitKeywordSchema>;

export const LineHtmlSchema = z.object({ line: z.number().int(), html: z.string() });

export const CostLineSchema = z.object({
  line: z.number().int(),
  description: z.string(),
  points: z.number().int().min(0).nullable(),
});
export type CostLine = z.infer<typeof CostLineSchema>;

export const DatasheetSchema = z.object({
  id: z.string().min(1),
  ...Source,
  name: z.string().min(1),
  factionId: z.string(),
  publicationId: z.string(),
  role: z.string(),
  legendHtml: z.string(),
  loadoutHtml: z.string(),
  transportHtml: z.string(),
  virtual: z.boolean(),
  isSupport: z.boolean(),
  leaderHeadHtml: z.string(),
  leaderFooterHtml: z.string(),
  damaged: z.object({ wounds: z.string(), descriptionHtml: z.string() }).nullable(),
  models: z.array(ModelProfileSchema),
  weapons: z.array(WeaponProfileSchema),
  abilities: z.array(DatasheetAbilitySchema),
  keywords: z.array(UnitKeywordSchema),
  composition: z.array(LineHtmlSchema),
  costs: z.array(CostLineSchema),
  options: z.array(LineHtmlSchema),
  /** Datasheets this one can lead (attach to). */
  canLead: z.array(z.string()),
  /** Datasheets that can lead this one. */
  ledBy: z.array(z.string()),
  stratagemIds: z.array(z.string()),
  enhancementIds: z.array(z.string()),
  detachmentAbilityIds: z.array(z.string()),
});
export type Datasheet = z.infer<typeof DatasheetSchema>;

export const AbilitySchema = z.object({
  id: z.string().min(1),
  ...Source,
  name: z.string(),
  /** Shared abilities can belong to several factions (same id in several rows). */
  factionIds: z.array(z.string()),
  legendHtml: z.string(),
  descriptionHtml: z.string(),
});
export type Ability = z.infer<typeof AbilitySchema>;

export const StratagemSchema = z.object({
  id: z.string().min(1),
  ...Source,
  name: z.string().min(1),
  factionId: z.string(),
  type: z.string(),
  cpCost: z.number().int().min(0).nullable(),
  legendHtml: z.string(),
  turn: z.string(),
  phase: z.string(),
  detachment: z.string(),
  detachmentId: z.string(),
  descriptionHtml: z.string(),
});
export type Stratagem = z.infer<typeof StratagemSchema>;

export const EnhancementSchema = z.object({
  id: z.string().min(1),
  ...Source,
  name: z.string().min(1),
  factionId: z.string(),
  legendHtml: z.string(),
  descriptionHtml: z.string(),
  points: z.number().int().min(0).nullable(),
  detachment: z.string(),
  detachmentId: z.string(),
  upgrade: z.boolean(),
  supportLeader: z.string(),
  weapons: z.array(WeaponProfileSchema),
});
export type Enhancement = z.infer<typeof EnhancementSchema>;

export const DetachmentAbilitySchema = z.object({
  id: z.string().min(1),
  ...Source,
  name: z.string(),
  factionId: z.string(),
  legendHtml: z.string(),
  descriptionHtml: z.string(),
  detachment: z.string(),
  detachmentId: z.string(),
});
export type DetachmentAbility = z.infer<typeof DetachmentAbilitySchema>;

export const DetachmentSchema = z.object({
  id: z.string().min(1),
  ...Source,
  name: z.string().min(1),
  factionId: z.string(),
  legendHtml: z.string(),
  type: z.string(),
  /** Detachment points; null when not given. */
  detachmentPoints: z.number().int().min(0).nullable(),
  forceDispositions: z.array(z.string()),
  /** Per keyword overrides of detachment points. */
  keywordPoints: z.array(z.object({ keyword: z.string(), points: z.number().int().min(0) })),
  abilityIds: z.array(z.string()),
  stratagemIds: z.array(z.string()),
  enhancementIds: z.array(z.string()),
});
export type Detachment = z.infer<typeof DetachmentSchema>;

export const KeywordSchema = z.object({
  /** Slug, e.g. `infantry` or `sustained-hits`. */
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['unit', 'weapon']),
  uses: z.number().int().min(0),
  /** RuleSection id this keyword resolves to (filled in M3). */
  ruleId: z.string().optional(),
});
export type Keyword = z.infer<typeof KeywordSchema>;

export interface RuleSection {
  /** Stable id we generate, e.g. `core.attack-sequence.hit-roll`. */
  id: string;
  /** Section code from the source, e.g. `05.01`; empty for FAQ / errata blocks. */
  number: string;
  title: string;
  kind: 'section' | 'ability' | 'faq' | 'errata' | 'group';
  html: string;
  text: string;
  anchor: string;
  sourceUrl: string;
  keywords: string[];
  children: RuleSection[];
}

export const RuleSectionSchema: z.ZodType<RuleSection> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    number: z.string(),
    title: z.string(),
    kind: z.enum(['section', 'ability', 'faq', 'errata', 'group']),
    html: z.string(),
    text: z.string(),
    anchor: z.string(),
    sourceUrl: z.string(),
    keywords: z.array(z.string()),
    children: z.array(RuleSectionSchema),
  }),
);

/** Light entry used for roster name matching and pickers. */
export const CatalogEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  factionId: z.string(),
  role: z.string(),
  keywords: z.array(z.string()),
  virtual: z.boolean(),
});
export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

export const BuildMetaSchema = z.object({
  schemaVersion: z.literal(1),
  builtAt: z.string(),
  sourceLastUpdate: z.string().optional(),
  rawFetchedAt: z.string().optional(),
  fixture: z.boolean(),
});
export type BuildMeta = z.infer<typeof BuildMetaSchema>;

export interface ReportIssue {
  file: string;
  line: number;
  id?: string;
  category: string;
  message: string;
}

export interface BuildReport {
  builtAt: string;
  counts: Record<string, number>;
  errors: ReportIssue[];
  warnings: ReportIssue[];
  /** Explanation per category, so every reported issue is explained. */
  explanations: Record<string, string>;
  unresolvedKeywords: { kind: 'unit' | 'weapon'; keyword: string; uses: number }[];
}
