/** Format independent result of reading a roster file, before matching against data. */
export interface DraftItem {
  readonly name: string;
  readonly count: number;
}

export interface DraftModel {
  readonly name: string;
  readonly count: number;
  readonly items: readonly DraftItem[];
}

export interface DraftUnit {
  readonly name: string;
  readonly points?: number;
  readonly models: readonly DraftModel[];
  /** Unit level selections: wargear, enhancements, the warlord marker... classified when resolving. */
  readonly items: readonly DraftItem[];
  /** Number of copies when the roster lists a unit as `2x Name`. */
  readonly copies?: number;
  /** Where the unit came from, for error messages. */
  readonly source?: string;
}

export interface RosterDraft {
  readonly format: 'ros' | 'rosz' | 'text';
  readonly name?: string;
  readonly points?: number;
  /** Strings that might name the faction (catalogue name, header lines). */
  readonly factionHints: readonly string[];
  /** Strings that might name the detachment. */
  readonly detachmentHints: readonly string[];
  readonly units: readonly DraftUnit[];
  readonly warnings: readonly string[];
}

export type MatchMethod = 'exact' | 'normalized' | 'fuzzy' | 'manual';

export interface ResolvedWeapon {
  /** Weapon profile name on the datasheet. */
  readonly name: string;
  readonly count: number;
}

export interface ResolvedUnit {
  readonly key: string;
  readonly rosterName: string;
  readonly datasheetId: string;
  readonly datasheetName: string;
  readonly factionId: string;
  readonly modelCount: number;
  readonly models: readonly DraftModel[];
  readonly weapons: readonly ResolvedWeapon[];
  /** True when the roster named no recognisable wargear and every datasheet weapon was assumed. */
  readonly wargearDefaulted: boolean;
  readonly enhancementIds: readonly string[];
  readonly isWarlord: boolean;
  readonly points: number | null;
  readonly match: { readonly method: MatchMethod; readonly score: number };
}

export interface Suggestion {
  readonly datasheetId: string;
  readonly name: string;
  readonly factionId: string;
  readonly score: number;
}

export interface UnresolvedUnit {
  readonly key: string;
  readonly draft: DraftUnit;
  readonly suggestions: readonly Suggestion[];
}

export interface ResolvedArmy {
  readonly name: string;
  readonly format: RosterDraft['format'];
  readonly factionId: string | null;
  readonly detachmentId: string | null;
  readonly points: number | null;
  readonly units: readonly ResolvedUnit[];
  readonly unresolved: readonly UnresolvedUnit[];
  readonly warnings: readonly string[];
  /** Leader unit key -> bodyguard unit key (attached units, 19). Missing on armies saved before this existed. */
  readonly attachments?: Readonly<Record<string, string>>;
}
