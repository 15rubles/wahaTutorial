import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../api/client';
import type {
  BattleSize,
  DatasheetDetail,
  DatasheetSummary,
  DetachmentDetail,
  FactionConfig,
  FactionSummary,
  ForceDisposition,
  GlossaryDetail,
} from '../../api/gameTypes';

/** Game data reads. `version` pins an older data version (rosters built on it); default is the active one. */
function v(version?: number): string {
  return version === undefined ? '' : `version=${version}`;
}

function qs(...parts: string[]): string {
  const p = parts.filter(Boolean).join('&');
  return p ? `?${p}` : '';
}

export function useFactions(version?: number) {
  return useQuery({
    queryKey: ['game', 'factions', version ?? 'active'],
    queryFn: ({ signal }) => apiGet<FactionSummary[]>(`/api/factions${qs(v(version))}`, signal),
    staleTime: 5 * 60_000,
  });
}

export function useFactionConfig(faction: string | undefined, version?: number) {
  return useQuery({
    queryKey: ['game', 'faction', faction, version ?? 'active'],
    queryFn: ({ signal }) => apiGet<FactionConfig>(`/api/factions/${encodeURIComponent(faction ?? '')}${qs(v(version))}`, signal),
    enabled: !!faction,
    staleTime: 5 * 60_000,
  });
}

export function useDatasheets(faction: string | undefined, version?: number) {
  return useQuery({
    queryKey: ['game', 'datasheets', faction, version ?? 'active'],
    queryFn: ({ signal }) =>
      apiGet<DatasheetSummary[]>(`/api/factions/${encodeURIComponent(faction ?? '')}/datasheets${qs(v(version))}`, signal),
    enabled: !!faction,
    staleTime: 5 * 60_000,
  });
}

export function useDetachments(faction: string | undefined, version?: number) {
  return useQuery({
    queryKey: ['game', 'detachments', faction, version ?? 'active'],
    queryFn: ({ signal }) =>
      apiGet<DetachmentDetail[]>(`/api/factions/${encodeURIComponent(faction ?? '')}/detachments${qs(v(version))}`, signal),
    enabled: !!faction,
    staleTime: 5 * 60_000,
  });
}

export function useDatasheet(key: string | undefined, version?: number) {
  return useQuery({
    queryKey: ['game', 'datasheet', key, version ?? 'active'],
    queryFn: ({ signal }) => apiGet<DatasheetDetail>(`/api/datasheets/${encodeURIComponent(key ?? '')}${qs(v(version))}`, signal),
    enabled: !!key,
    staleTime: 5 * 60_000,
  });
}

export function useBattleSizes(version?: number) {
  return useQuery({
    queryKey: ['game', 'battle-sizes', version ?? 'active'],
    queryFn: ({ signal }) => apiGet<BattleSize[]>(`/api/battle-sizes${qs(v(version))}`, signal),
    staleTime: 5 * 60_000,
  });
}

export function useForceDispositions(version?: number) {
  return useQuery({
    queryKey: ['game', 'force-dispositions', version ?? 'active'],
    queryFn: ({ signal }) => apiGet<ForceDisposition[]>(`/api/force-dispositions${qs(v(version))}`, signal),
    staleTime: 5 * 60_000,
  });
}

export function useGlossary(key: string | undefined, version?: number) {
  return useQuery({
    queryKey: ['game', 'glossary', key, version ?? 'active'],
    queryFn: ({ signal }) => apiGet<GlossaryDetail>(`/api/glossary/${encodeURIComponent(key ?? '')}${qs(v(version))}`, signal),
    enabled: !!key,
    staleTime: 5 * 60_000,
  });
}
