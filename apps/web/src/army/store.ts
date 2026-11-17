import {
  type ResolvedArmy,
  assignDatasheet,
  canAttach,
  cleanAttachments,
  dropUnresolved,
  factionsToLoad,
  readRoster,
  resolveRoster,
  suggestAttachments,
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
  /** Attach a leader unit to a bodyguard unit, or detach it with null. */
  setAttachment(leaderKey: string, bodyguardKey: string | null): void;
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
      const lookup = rosterLookup();
      const resolved = resolveRoster(draft, lookup);
      const army = { ...resolved, attachments: suggestAttachments(resolved, lookup.datasheet) };
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
    const lookup = rosterLookup();
    const assigned = assignDatasheet(army, key, datasheetId, lookup);
    const next = { ...assigned, attachments: cleanAttachments(assigned, lookup.datasheet) };
    save(next);
    set({ army: next });
  },
  drop(key) {
    const { army } = get();
    if (!army) return;
    const dropped = dropUnresolved(army, key);
    const next = { ...dropped, attachments: cleanAttachments(dropped, rosterLookup().datasheet) };
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
  setAttachment(leaderKey, bodyguardKey) {
    const { army } = get();
    if (!army) return;
    const { datasheet } = rosterLookup();
    const rest = Object.fromEntries(
      Object.entries(army.attachments ?? {}).filter(([l]) => l !== leaderKey),
    );
    if (bodyguardKey && !canAttach(army, rest, leaderKey, bodyguardKey, datasheet)) return;
    const next = {
      ...army,
      attachments: bodyguardKey ? { ...rest, [leaderKey]: bodyguardKey } : rest,
    };
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
    // Armies saved before attachments existed get the suggested ones once.
    if (!army.attachments) {
      const next = { ...army, attachments: suggestAttachments(army, rosterLookup().datasheet) };
      save(next);
      set({ army: next });
    }
  },
}));
