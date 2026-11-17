import type {
  Ability,
  BuildMeta,
  CatalogEntry,
  Datasheet,
  Detachment,
  DetachmentAbility,
  Enhancement,
  Faction,
  RuleSection,
  Stratagem,
} from '@battle-drill/data';
import type { RosterLookup } from '@battle-drill/roster';
import { create } from 'zustand';
import {
  DataMissingError,
  type DataSource,
  fetchJson,
  initialDataSource,
  rememberDataSource,
} from './source.js';

export interface RulesIndex {
  anchors: Record<string, string>;
  codes: Record<string, string>;
  weaponKeywords: Record<string, string>;
  unitKeywords: Record<string, string>;
  abilities: Record<string, string>;
  mentions: Record<string, string[]>;
}

export interface RulesData {
  roots: RuleSection[];
  byId: Map<string, RuleSection>;
  parentOf: Map<string, string>;
  index: RulesIndex;
}

export interface GameData {
  factions: Faction[];
  catalog: CatalogEntry[];
  detachments: Detachment[];
  enhancements: Enhancement[];
  stratagems: Stratagem[];
  abilities: Ability[];
  detachmentAbilities: DetachmentAbility[];
}

type Status = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

interface DataState {
  source: DataSource;
  status: Status;
  error?: string;
  meta?: BuildMeta;
  rules?: RulesData;
  game?: GameData;
  datasheets: Map<string, Datasheet>;
  loadedFactions: Set<string>;
  setSource(source: DataSource): void;
  load(): Promise<void>;
  ensureFactions(ids: readonly string[]): Promise<void>;
}

export function indexRules(roots: RuleSection[], index: RulesIndex): RulesData {
  const byId = new Map<string, RuleSection>();
  const parentOf = new Map<string, string>();
  const walk = (n: RuleSection, parent?: string) => {
    byId.set(n.id, n);
    if (parent) parentOf.set(n.id, parent);
    n.children.forEach((c) => walk(c, n.id));
  };
  roots.forEach((r) => walk(r));
  return { roots, byId, parentOf, index };
}

export const useData = create<DataState>((set, get) => ({
  source: initialDataSource(),
  status: 'idle',
  datasheets: new Map(),
  loadedFactions: new Set(),
  setSource(source) {
    rememberDataSource(source);
    set({
      source,
      status: 'idle',
      meta: undefined,
      rules: undefined,
      game: undefined,
      error: undefined,
      datasheets: new Map(),
      loadedFactions: new Set(),
    });
    void get().load();
  },
  async load() {
    const { source } = get();
    set({ status: 'loading' });
    try {
      const meta = await fetchJson<BuildMeta>(source, 'meta.json');
      const [
        roots,
        index,
        factions,
        catalog,
        detachments,
        enhancements,
        stratagems,
        abilities,
        detachmentAbilities,
      ] = await Promise.all([
        fetchJson<RuleSection[]>(source, 'rules.json'),
        fetchJson<RulesIndex>(source, 'rules-index.json'),
        fetchJson<Faction[]>(source, 'factions.json'),
        fetchJson<CatalogEntry[]>(source, 'catalog.json'),
        fetchJson<Detachment[]>(source, 'detachments.json'),
        fetchJson<Enhancement[]>(source, 'enhancements.json'),
        fetchJson<Stratagem[]>(source, 'stratagems.json'),
        fetchJson<Ability[]>(source, 'abilities.json'),
        fetchJson<DetachmentAbility[]>(source, 'detachment-abilities.json'),
      ]);
      if (get().source !== source) return;
      set({
        status: 'ready',
        meta,
        rules: indexRules(roots, index),
        game: {
          factions,
          catalog,
          detachments,
          enhancements,
          stratagems,
          abilities,
          detachmentAbilities,
        },
      });
    } catch (e) {
      if (get().source !== source) return;
      set({
        status: e instanceof DataMissingError ? 'missing' : 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
  async ensureFactions(ids) {
    const { source, loadedFactions } = get();
    const missing = [...new Set(ids)].filter((id) => !loadedFactions.has(id));
    if (missing.length === 0) return;
    const lists = await Promise.all(
      missing.map((id) =>
        fetchJson<Datasheet[]>(source, `datasheets/${id || '_none'}.json`).catch(
          () => [] as Datasheet[],
        ),
      ),
    );
    if (get().source !== source) return;
    const datasheets = new Map(get().datasheets);
    for (const d of lists.flat()) datasheets.set(d.id, d);
    set({ datasheets, loadedFactions: new Set([...get().loadedFactions, ...missing]) });
  },
}));

/** Roster lookup over whatever is loaded right now. */
export function rosterLookup(): RosterLookup {
  const { game, datasheets } = useData.getState();
  if (!game) throw new Error('Data not loaded');
  return { ...game, datasheet: (id) => datasheets.get(id) };
}
