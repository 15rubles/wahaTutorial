import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiSend } from '../../api/client';

export type Severity = 'ERROR' | 'WARNING' | 'INFO';
export type Violation = { severity: Severity; code: string; message: string; entryIds: number[] };
export type RosterFlags = { legends: boolean; unalignedForces: boolean; unalignedFortifications: boolean };
export type WargearChoice = { option: string; choice: string; count: number };

export type EntryView = {
  id: number;
  datasheetKey: string;
  name: string;
  role?: string;
  sizeKey: string;
  sizeName?: string;
  models: number;
  wargear: WargearChoice[];
  enhancementKey?: string;
  enhancementName?: string;
  warlord: boolean;
  attachedTo?: number;
  sortOrder: number;
  points: number;
  pointsComplete: boolean;
  missing: boolean;
};

export type Totals = {
  points: number;
  pointsComplete: boolean;
  pointsLimit?: number;
  dp: number;
  dpBudget?: number;
  enhancements: number;
  enhancementLimit?: number;
  legal: boolean;
  errors: number;
  warnings: number;
};

export type RosterView = {
  id: number;
  name: string;
  factionKey: string;
  factionName: string;
  version: { rosterVersion: number; activeVersion?: number; outdated: boolean };
  battleSizeKey?: string;
  factionOptions: Record<string, string>;
  forceDisposition?: string;
  flags: RosterFlags;
  detachments: string[];
  entries: EntryView[];
  totals: Totals;
  violations: Violation[];
  createdAt: string;
  updatedAt: string;
};

export type RosterSummary = {
  id: number;
  name: string;
  factionKey: string;
  factionName: string;
  battleSizeKey?: string;
  points: number;
  legal: boolean;
  outdated: boolean;
  updatedAt: string;
};

export type DataUpdatePreview = {
  rosterVersion: number;
  activeVersion: number;
  totalBefore: number;
  totalAfter: number;
  changes: { entryId: number; name: string; before: number; after: number }[];
  removedUnits: string[];
};

export const rosterListKey = ['rosters'] as const;
export const rosterKey = (id: number) => ['roster', id] as const;

export function useRosterList() {
  return useQuery({
    queryKey: rosterListKey,
    queryFn: ({ signal }) => apiGet<RosterSummary[]>('/api/rosters', signal),
  });
}

export function useRoster(id: number) {
  return useQuery({
    queryKey: rosterKey(id),
    queryFn: ({ signal }) => apiGet<RosterView>(`/api/rosters/${id}`, signal),
    enabled: Number.isFinite(id),
  });
}

export function useCreateRoster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; factionKey: string; battleSizeKey?: string }) =>
      apiSend<RosterView>('POST', '/api/rosters', input),
    onSuccess: (view) => {
      qc.setQueryData(rosterKey(view.id), view);
      void qc.invalidateQueries({ queryKey: rosterListKey });
    },
  });
}

export function useDuplicateRoster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiSend<RosterView>('POST', `/api/rosters/${id}/duplicate`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: rosterListKey }),
  });
}

export function useDeleteRoster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiSend<void>('DELETE', `/api/rosters/${id}`),
    onSuccess: (_v, id) => {
      qc.removeQueries({ queryKey: rosterKey(id) });
      void qc.invalidateQueries({ queryKey: rosterListKey });
    },
  });
}

export type ConfigPatch = {
  name?: string;
  battleSizeKey?: string;
  factionOptions?: Record<string, string>;
  forceDisposition?: string;
  clearForceDisposition?: boolean;
  flags?: RosterFlags;
};

export type EntryPatch = {
  sizeKey?: string;
  wargear?: WargearChoice[];
  enhancementKey?: string;
  clearEnhancement?: boolean;
  warlord?: boolean;
  attachedTo?: number;
  detach?: boolean;
  sortOrder?: number;
};

/** All roster mutations: each answers with the full roster, which replaces the cached copy. */
export function useRosterMutations(id: number) {
  const qc = useQueryClient();
  const apply = (view: RosterView) => {
    qc.setQueryData(rosterKey(id), view);
    void qc.invalidateQueries({ queryKey: rosterListKey });
  };
  return {
    config: useMutation({ mutationFn: (p: ConfigPatch) => apiSend<RosterView>('PATCH', `/api/rosters/${id}/config`, p), onSuccess: apply }),
    detachments: useMutation({
      mutationFn: (keys: string[]) => apiSend<RosterView>('PUT', `/api/rosters/${id}/detachments`, { detachmentKeys: keys }),
      onSuccess: apply,
    }),
    addEntry: useMutation({
      mutationFn: (input: { datasheetKey: string; sizeKey?: string }) => apiSend<RosterView>('POST', `/api/rosters/${id}/entries`, input),
      onSuccess: apply,
    }),
    updateEntry: useMutation({
      mutationFn: ({ entryId, patch }: { entryId: number; patch: EntryPatch }) =>
        apiSend<RosterView>('PATCH', `/api/rosters/${id}/entries/${entryId}`, patch),
      onSuccess: apply,
    }),
    deleteEntry: useMutation({
      mutationFn: (entryId: number) => apiSend<RosterView>('DELETE', `/api/rosters/${id}/entries/${entryId}`),
      onSuccess: apply,
    }),
    applyDataUpdate: useMutation({
      mutationFn: () => apiSend<RosterView>('POST', `/api/rosters/${id}/data-update`),
      onSuccess: (view) => {
        apply(view);
        void qc.invalidateQueries({ queryKey: ['roster', id, 'data-update'] });
      },
    }),
  };
}

export function useDataUpdatePreview(id: number, enabled: boolean) {
  return useQuery({
    queryKey: ['roster', id, 'data-update'],
    queryFn: ({ signal }) => apiGet<DataUpdatePreview>(`/api/rosters/${id}/data-update`, signal),
    enabled,
  });
}
