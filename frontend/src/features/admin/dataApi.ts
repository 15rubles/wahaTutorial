import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiSend } from '../../api/client';
import type { ImportResult, SourceImportSummary, VersionReport, VersionSummary } from '../../api/gameTypes';

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
