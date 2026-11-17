import { create } from 'zustand';

/** Which rule section the popup shows (null = closed). Opened from keyword chips anywhere. */
export const useRulePopup = create<{
  ruleId: string | null;
  open(id: string): void;
  close(): void;
}>((set) => ({
  ruleId: null,
  open: (ruleId) => set({ ruleId }),
  close: () => set({ ruleId: null }),
}));
