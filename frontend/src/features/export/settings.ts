import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiSend } from '../../api/client';
import type { ExportSettings, SectionId } from './types';

export const SECTION_LABELS: Record<SectionId, string> = {
  summary: 'Summary',
  rules: 'Army and detachment rules',
  units: 'Unit cards',
  enhancements: 'Enhancements',
  stratagems: 'Stratagems',
  cheatsheet: 'Phase cheat sheet',
  glossary: 'Keyword glossary',
};

export const DEFAULT_SETTINGS: ExportSettings = {
  paper: 'A4',
  textSize: 'normal',
  includePoints: true,
  sections: (['summary', 'rules', 'units', 'enhancements', 'stratagems', 'cheatsheet', 'glossary'] as SectionId[]).map((id) => ({ id, on: true })),
  leadersBeforeUnit: true,
  hideUntakenWargear: true,
  includeCoreStratagems: true,
  includeOtherDetachments: false,
};

const LAST_KEY = 'muster.export.last';

/** Fills in anything missing (older presets, new sections) so settings are always complete. */
export function normalize(raw: unknown): ExportSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ExportSettings>;
  const known = new Set(DEFAULT_SETTINGS.sections.map((s) => s.id));
  const sections = Array.isArray(r.sections)
    ? r.sections.filter((s): s is { id: SectionId; on: boolean } => !!s && known.has(s.id as SectionId)).map((s) => ({ id: s.id, on: !!s.on }))
    : [];
  for (const s of DEFAULT_SETTINGS.sections) if (!sections.some((x) => x.id === s.id)) sections.push({ ...s });
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  return {
    paper: r.paper === 'LETTER' ? 'LETTER' : 'A4',
    textSize: r.textSize === 'large' ? 'large' : 'normal',
    includePoints: bool(r.includePoints, DEFAULT_SETTINGS.includePoints),
    sections,
    leadersBeforeUnit: bool(r.leadersBeforeUnit, DEFAULT_SETTINGS.leadersBeforeUnit),
    hideUntakenWargear: bool(r.hideUntakenWargear, DEFAULT_SETTINGS.hideUntakenWargear),
    includeCoreStratagems: bool(r.includeCoreStratagems, DEFAULT_SETTINGS.includeCoreStratagems),
    includeOtherDetachments: bool(r.includeOtherDetachments, DEFAULT_SETTINGS.includeOtherDetachments),
  };
}

export function loadLast(): ExportSettings {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return normalize(raw ? JSON.parse(raw) : undefined);
  } catch {
    return normalize(undefined);
  }
}

export function saveLast(s: ExportSettings) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: settings simply are not remembered */
  }
}

export function moveSection(s: ExportSettings, from: number, to: number): ExportSettings {
  if (to < 0 || to >= s.sections.length || from === to) return s;
  const sections = [...s.sections];
  const [item] = sections.splice(from, 1);
  if (item) sections.splice(to, 0, item);
  return { ...s, sections };
}

export type Preset = { id: number; name: string; settings: unknown; updatedAt: string };

export function usePresets() {
  return useQuery({ queryKey: ['export-presets'], queryFn: ({ signal }) => apiGet<Preset[]>('/api/me/export-presets', signal) });
}

export function useSavePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { name: string; settings: ExportSettings }) => apiSend<Preset>('POST', '/api/me/export-presets', p),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['export-presets'] }),
  });
}

export function useDeletePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiSend<void>('DELETE', `/api/me/export-presets/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['export-presets'] }),
  });
}

export function useExportData(rosterId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['roster', rosterId, 'export-data'],
    queryFn: ({ signal }) => apiGet<import('./types').ExportData>(`/api/rosters/${rosterId}/export-data`, signal),
    enabled,
    staleTime: 0,
  });
}
