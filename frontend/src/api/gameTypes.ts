/** TypeScript mirrors of the backend game data records (app.muster.gamedata.model). */

export type Phase = 'COMMAND' | 'MOVEMENT' | 'SHOOTING' | 'CHARGE' | 'FIGHT' | 'ANY';
export type Timing = 'YOUR_TURN' | 'OPPONENT_TURN' | 'EITHER_TURN' | 'PRE_GAME' | 'ANY';
export type Source = 'BATTLESCRIBE' | 'WAHAPEDIA' | 'MFM' | 'MANUAL';
export type Allegiance = 'IMPERIUM' | 'CHAOS' | 'XENOS' | 'UNALIGNED';
export type GlossaryKind = 'CORE_ABILITY' | 'WEAPON_ABILITY' | 'UNIT_KEYWORD' | 'FACTION_KEYWORD' | 'RULE_TERM';
export type EntityType =
  | 'FACTION'
  | 'ARMY_RULE'
  | 'FACTION_OPTION'
  | 'DATASHEET'
  | 'UNIT_SIZE'
  | 'WEAPON'
  | 'WARGEAR_OPTION'
  | 'ABILITY'
  | 'DETACHMENT'
  | 'ENHANCEMENT'
  | 'STRATAGEM'
  | 'BATTLE_SIZE'
  | 'FORCE_DISPOSITION'
  | 'GLOSSARY';

export type Token = { type: 'text'; value: string } | { type: 'ref'; glossaryId: string; label: string };
export type RulesText = { plain: string; tokens: Token[] };
export type PhaseTags = { phases: Phase[]; timing: Timing; inferred: boolean; confirmed: boolean };
export type KeywordRef = { label: string; glossaryId?: string };

export type Faction = { key: string; name: string; parentKey?: string; allegiance?: Allegiance };
export type FactionSummary = Faction & { datasheetCount: number };

export type StatProfile = { name: string; m: string; t: string; sv: string; invuln?: string; w: string; ld: string; oc: string };

export type Datasheet = {
  key: string;
  faction: string;
  name: string;
  role?: string;
  keywords: string[];
  factionKeywords: string[];
  profiles: StatProfile[];
  legends: boolean;
  leaderOf: string[];
  maxCopies?: number;
  composition?: string;
  loadout?: string;
  support: boolean;
  wargearPoints: { name: string; points: number }[];
};

export type PointsTier = { fromCopy: number; toCopy?: number; points: number; context?: string };
export type UnitSizeOption = { key: string; datasheet: string; name: string; models: number; points?: number; tiers?: PointsTier[] };

export type Weapon = {
  key: string;
  datasheet: string;
  name: string;
  weaponType: 'RANGED' | 'MELEE';
  range: string;
  a: string;
  skill: string;
  s: string;
  ap: string;
  d: string;
  abilities: KeywordRef[];
};

export type WargearOption = {
  key: string;
  datasheet: string;
  name: string;
  description: string;
  choices: string[];
  min?: number;
  max?: number;
  perModels?: number;
  pointsDelta?: number;
};

export type Ability = {
  key: string;
  owner: 'DATASHEET' | 'DETACHMENT' | 'ARMY_RULE' | 'CORE';
  ownerKey: string;
  faction?: string;
  name: string;
  text: RulesText;
  tags: PhaseTags;
  glossaryId?: string;
};

export type Detachment = {
  key: string;
  faction: string;
  name: string;
  dpCost?: number;
  uniqueTags: string[];
  ruleName?: string;
  ruleText: RulesText;
  restrictions?: string;
  forceDispositions: string[];
  dpByKeyword: Record<string, number>;
};

export type Enhancement = {
  key: string;
  detachment: string;
  faction: string;
  name: string;
  points?: number;
  requiredKeywords: string[];
  forbiddenKeywords: string[];
  text: RulesText;
  tags: PhaseTags;
  upgrade: boolean;
  eligibleDatasheets: string[];
  grantsLeaderOf: string[];
};

export type Stratagem = {
  key: string;
  detachment?: string;
  faction?: string;
  name: string;
  cpCost?: number;
  category?: string;
  tags: PhaseTags;
  when: RulesText;
  target: RulesText;
  effect: RulesText;
  restrictions: RulesText;
  fullText: RulesText;
};

export type BattleSize = {
  key: string;
  name: string;
  pointsLimit?: number;
  dpBudget?: number;
  limits: Record<string, number>;
};

export type ForceDisposition = { key: string; name: string; text: RulesText };
export type ArmyRule = { key: string; faction: string; name: string; text: RulesText };
export type FactionOption = { key: string; faction: string; name: string; values: { name: string; text: RulesText }[] };

export type GlossaryReference = { type: EntityType; key: string; name: string };
export type GlossaryEntry = {
  key: string;
  term: string;
  aliases: string[];
  kind: GlossaryKind;
  text: RulesText;
  seeAlso: string[];
  referencedBy: GlossaryReference[];
};

export type NamedRef = { key: string; name: string };

export type DatasheetSummary = {
  key: string;
  name: string;
  faction: string;
  role?: string;
  legends: boolean;
  keywords: string[];
  factionKeywords: string[];
  sizes: UnitSizeOption[];
};

export type DatasheetDetail = {
  versionId: number;
  datasheet: Datasheet;
  sizes: UnitSizeOption[];
  weapons: Weapon[];
  abilities: Ability[];
  wargear: WargearOption[];
  leads: NamedRef[];
  ledBy: NamedRef[];
};

export type DetachmentDetail = {
  detachment: Detachment;
  rules: Ability[];
  enhancements: Enhancement[];
  stratagems: Stratagem[];
};

export type FactionConfig = {
  faction: Faction;
  armyRules: ArmyRule[];
  factionOptions: FactionOption[];
  detachments: Detachment[];
};

export type GlossaryDetail = { entry: GlossaryEntry; seeAlso: NamedRef[] };
export type GlossaryHit = { key: string; term: string; kind: GlossaryKind };

// ---- admin: imports and versions ----

export type IssueLevel = 'ERROR' | 'WARNING' | 'INFO';
export type Issue = { level: IssueLevel; category: string; message: string; faction?: string; ref?: string };
export type Change = { type: EntityType; key: string; name: string; faction?: string };
export type PointsChange = Change & { before?: number; after?: number };
export type VersionReport = {
  sourceImports: Record<string, number>;
  counts: Record<string, Record<string, number>>;
  issues: Issue[];
  diff: { comparedToVersion?: number; added: Change[]; removed: Change[]; changed: Change[]; points: PointsChange[] };
  phaseTagsToReview: number;
  overridesApplied: number;
};
export type DataVersionStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type DataVersionRow = {
  id: number;
  createdAt: string;
  createdBy?: string;
  status: DataVersionStatus;
  activatedAt?: string;
  sourceFiles: string[];
  importIds: Record<string, number>;
};
export type VersionSummary = {
  version: DataVersionRow;
  entities: number;
  errors: number;
  warnings: number;
  phaseTagsToReview: number;
};
export type ImportResult = { versionId: number; importId: number; version: VersionSummary };
export type SourceImportSummary = {
  id: number;
  source: Source;
  createdAt: string;
  files: string[];
  report: { counts: Record<string, Record<string, number>>; issues: Issue[] };
};
