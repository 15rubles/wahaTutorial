import type { BuildMeta, RuleSection } from '@battle-drill/data';
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

type Status = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

interface DataState {
  source: DataSource;
  status: Status;
  error?: string;
  meta?: BuildMeta;
  rules?: RulesData;
  setSource(source: DataSource): void;
  load(): Promise<void>;
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
  setSource(source) {
    rememberDataSource(source);
    set({ source, status: 'idle', meta: undefined, rules: undefined, error: undefined });
    void get().load();
  },
  async load() {
    const { source } = get();
    set({ status: 'loading' });
    try {
      const meta = await fetchJson<BuildMeta>(source, 'meta.json');
      const [roots, index] = await Promise.all([
        fetchJson<RuleSection[]>(source, 'rules.json'),
        fetchJson<RulesIndex>(source, 'rules-index.json'),
      ]);
      if (get().source !== source) return;
      set({ status: 'ready', meta, rules: indexRules(roots, index) });
    } catch (e) {
      if (get().source !== source) return;
      const missing = e instanceof DataMissingError;
      set({
        status: missing ? 'missing' : 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
}));
