import { useQueries } from '@tanstack/react-query';
import { apiGet } from '../../api/client';
import type { DatasheetSummary } from '../../api/gameTypes';
import { useDatasheets, useFactions } from '../game/api';
import type { RosterView } from '../rosters/api';

/** The army's datasheets plus unaligned units when the roster's show/hide options allow them. */
export function useAvailableDatasheets(roster: RosterView | undefined) {
  const version = roster?.version.rosterVersion;
  const own = useDatasheets(roster?.factionKey, version);
  const factions = useFactions(version);
  const wantUnaligned = !!roster && (roster.flags.unalignedForces || roster.flags.unalignedFortifications);
  const unaligned = (factions.data ?? []).filter((f) => f.allegiance === 'UNALIGNED' && f.key !== roster?.factionKey);
  const extra = useQueries({
    queries: unaligned.map((f) => ({
      queryKey: ['game', 'datasheets', f.key, version ?? 'active'],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiGet<DatasheetSummary[]>(`/api/factions/${encodeURIComponent(f.key)}/datasheets${version !== undefined ? `?version=${version}` : ''}`, signal),
      enabled: wantUnaligned,
      staleTime: 5 * 60_000,
    })),
  });
  const extras: DatasheetSummary[] = wantUnaligned
    ? extra
        .flatMap((q) => q.data ?? [])
        .filter((d) => {
          const fort = (d.role ?? '').toLowerCase().includes('fortification');
          return fort ? roster.flags.unalignedFortifications : roster.flags.unalignedForces;
        })
    : [];
  return { data: [...(own.data ?? []), ...extras], isPending: own.isPending, error: own.error };
}
