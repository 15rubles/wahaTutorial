import {
  type ResolvedArmy,
  assignDatasheet,
  dropUnresolved,
  factionsToLoad,
  readRoster,
  resolveRoster,
} from '@battle-drill/roster';
import { create } from 'zustand';
import { rosterLookup, useData } from '../data/store.js';

const KEY = 'battle-drill.army';

function save(army: ResolvedArmy | null) {
  try {
    if (army) window.localStorage.setItem(KEY, JSON.stringify(army));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage may be unavailable; the army just will not survive a reload.
  }
}

function restore(): ResolvedArmy | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ResolvedArmy) : null;
  } catch {
    return null;
  }
}

interface ArmyState {
  army: ResolvedArmy | null;
  importing: boolean;
  importError?: string;
  importFile(name: string, content: Uint8Array | string): Promise<ResolvedArmy | null>;
  assign(key: string, datasheetId: string): Promise<void>;
  drop(key: string): void;
  setDetachment(id: string | null): void;
  clear(): void;
  /** Makes sure the datasheets the army uses are loaded. */
  hydrate(): Promise<void>;
}

export const useArmy = create<ArmyState>((set, get) => ({
  army: restore(),
  importing: false,
  async importFile(name, content) {
    set({ importing: true, importError: undefined });
    try {
      const draft = readRoster(name, content);
      const { game, ensureFactions } = useData.getState();
      if (!game) throw new Error('Rules data is not loaded yet');
      await ensureFactions(factionsToLoad(draft, game));
      const army = resolveRoster(draft, rosterLookup());
      save(army);
      set({ army, importing: false });
      return army;
    } catch (e) {
      set({ importing: false, importError: e instanceof Error ? e.message : String(e) });
      return null;
    }
  },
  async assign(key, datasheetId) {
    const { army } = get();
    if (!army) return;
    const entry = useData.getState().game?.catalog.find((c) => c.id === datasheetId);
    if (entry) await useData.getState().ensureFactions([entry.factionId]);
    const next = assignDatasheet(army, key, datasheetId, rosterLookup());
    save(next);
    set({ army: next });
  },
  drop(key) {
    const { army } = get();
    if (!army) return;
    const next = dropUnresolved(army, key);
    save(next);
    set({ army: next });
  },
  setDetachment(id) {
    const { army } = get();
    if (!army) return;
    const next = { ...army, detachmentId: id };
    save(next);
    set({ army: next });
  },
  clear() {
    save(null);
    set({ army: null });
  },
  async hydrate() {
    const { army } = get();
    if (!army) return;
    await useData.getState().ensureFactions(army.units.map((u) => u.factionId));
  },
}));
