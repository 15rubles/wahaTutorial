import { create } from 'zustand';

/** UI-only state of the builder (server state lives in TanStack Query). */
export type Selection = { kind: 'entry'; id: number } | { kind: 'datasheet'; key: string } | null;
export type MobileTab = 'add' | 'list' | 'details';

type BuilderUi = {
  selection: Selection;
  mobileTab: MobileTab;
  select: (s: Selection) => void;
  setMobileTab: (t: MobileTab) => void;
};

export const useBuilderUi = create<BuilderUi>((set) => ({
  selection: null,
  mobileTab: 'list',
  select: (selection) => set((s) => ({ selection, mobileTab: selection ? 'details' : s.mobileTab })),
  setMobileTab: (mobileTab) => set({ mobileTab }),
}));
