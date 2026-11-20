import type {
  Ability,
  ArmyRule,
  BattleSize,
  DatasheetDetail,
  DetachmentDetail,
  Faction,
  FactionOption,
  ForceDisposition,
  GlossaryEntry,
  Stratagem,
} from '../../api/gameTypes';
import type { RosterView } from '../rosters/api';

/** GET /api/rosters/{id}/export-data */
export type ExportData = {
  roster: RosterView;
  faction: Faction;
  battleSize?: BattleSize;
  forceDisposition?: ForceDisposition;
  factionOptions: FactionOption[];
  armyRules: ArmyRule[];
  armyRuleAbilities: Ability[];
  selectedDetachments: DetachmentDetail[];
  otherDetachments: DetachmentDetail[];
  coreStratagems: Stratagem[];
  datasheets: Record<string, DatasheetDetail>;
  glossary: Record<string, GlossaryEntry>;
  dataVersion: { id: number; createdAt: string; activatedAt?: string };
};

export type SectionId = 'summary' | 'rules' | 'units' | 'enhancements' | 'stratagems' | 'cheatsheet' | 'glossary';

export type ExportSettings = {
  paper: 'A4' | 'LETTER';
  textSize: 'normal' | 'large';
  includePoints: boolean;
  sections: { id: SectionId; on: boolean }[];
  leadersBeforeUnit: boolean;
  hideUntakenWargear: boolean;
  includeCoreStratagems: boolean;
  includeOtherDetachments: boolean;
};
