import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiSend } from '../../api/client';
import type {
  EntityType,
  ImportResult,
  PhaseTags,
  Source,
  SourceImportSummary,
  VersionReport,
  VersionSummary,
} from '../../api/gameTypes';

export const versionsKey = ['admin', 'versions'] as const;

export function useDataVersions() {
  return useQuery({
    queryKey: versionsKey,
    queryFn: ({ signal }) => apiGet<VersionSummary[]>('/api/admin/data-versions', signal),
  });
}

export function useSourceImports() {
  return useQuery({
    queryKey: ['admin', 'imports'],
    queryFn: ({ signal }) => apiGet<SourceImportSummary[]>('/api/admin/imports', signal),
  });
}

export function useVersionReport(id: number) {
  return useQuery({
    queryKey: ['admin', 'versions', id, 'report'],
    queryFn: ({ signal }) => apiGet<VersionReport>(`/api/admin/data-versions/${id}/report`, signal),
  });
}

function useInvalidateData() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['admin'] });
    // Game data reads (factions, datasheets...) may have changed.
    void qc.invalidateQueries({ queryKey: ['game'] });
  };
}

export type ImportSource = 'battlescribe' | 'wahapedia' | 'mfm';

export function useImport(source: ImportSource) {
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiSend<ImportResult>('POST', `/api/admin/imports/${source}`, form);
    },
    onSuccess: invalidate,
  });
}

export function useActivateVersion() {
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: (id: number) => apiSend<VersionSummary>('POST', `/api/admin/data-versions/${id}/activate`),
    onSuccess: invalidate,
  });
}

export function useRebuildDraft() {
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: () => apiSend<VersionSummary>('POST', '/api/admin/data-versions/rebuild'),
    onSuccess: invalidate,
  });
}

// ---- editor, overrides, phase review ----


export type Listing = { type: EntityType; key: string; name: string; faction?: string; parent?: string; source: Source };
export type OverrideRow = {
  id: number;
  type: EntityType;
  key: string;
  field: string;
  value: unknown;
  note: string;
  createdBy?: string;
  updatedAt: string;
};
export type EntityDetail = {
  stored: { entity: Record<string, unknown>; source: Source; provenance: Record<string, Source>; externalIds: Record<string, string> };
  overrides: OverrideRow[];
};
export type OverrideInput = { type: EntityType; key: string; field: string; value: unknown; note: string };

export function useEntityList(params: { type?: EntityType; faction?: string; q?: string }) {
  const search = new URLSearchParams();
  if (params.type) search.set('type', params.type);
  if (params.faction) search.set('faction', params.faction);
  if (params.q) search.set('q', params.q);
  search.set('limit', '300');
  return useQuery({
    queryKey: ['admin', 'entities', params],
    queryFn: ({ signal }) => apiGet<Listing[]>(`/api/admin/entities?${search.toString()}`, signal),
  });
}

export function useEntity(type: EntityType | undefined, key: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'entity', type, key],
    queryFn: ({ signal }) => apiGet<EntityDetail>(`/api/admin/entities/${type}/${encodeURIComponent(key ?? '')}`, signal),
    enabled: !!type && !!key,
  });
}

export function useSaveOverrides() {
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: (edits: OverrideInput[]) => apiSend<OverrideRow[]>('PUT', '/api/admin/overrides', edits),
    onSuccess: invalidate,
  });
}

export function useDeleteOverride() {
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: (id: number) => apiSend<void>('DELETE', `/api/admin/overrides/${id}`),
    onSuccess: invalidate,
  });
}

export type ReviewItem = { type: EntityType; key: string; name: string; faction?: string; tags: PhaseTags; text: string };
export type ReviewPage = { total: number; offset: number; items: ReviewItem[] };
export type ReviewState = 'all' | 'inferred' | 'empty';

export function usePhaseReview(params: { faction?: string; type?: EntityType; state: ReviewState; offset: number }) {
  const search = new URLSearchParams({ state: params.state, offset: String(params.offset), limit: '25' });
  if (params.faction) search.set('faction', params.faction);
  if (params.type) search.set('type', params.type);
  return useQuery({
    queryKey: ['admin', 'review', params],
    queryFn: ({ signal }) => apiGet<ReviewPage>(`/api/admin/review/phase-tags?${search.toString()}`, signal),
  });
}

export function useConfirmPhaseTags() {
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: (items: { type: EntityType; key: string; tags: PhaseTags }[]) =>
      apiSend<void>('POST', '/api/admin/review/phase-tags/confirm', items),
    onSuccess: invalidate,
  });
}

export type FetchResult = { imported: ImportResult; files: { name: string; downloaded: boolean; fetchedAt: string }[] };

export function useFetchWahapedia() {
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: (refresh: boolean) => apiSend<FetchResult>('POST', `/api/admin/imports/wahapedia/fetch?refresh=${refresh}`),
    onSuccess: invalidate,
  });
}
