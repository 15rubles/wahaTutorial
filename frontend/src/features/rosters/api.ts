import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../api/client';

export type RosterSummary = { id: number; name: string; createdAt: string; updatedAt: string };

export const rosterListKey = ['rosters'] as const;

export function useRosterList() {
  return useQuery({
    queryKey: rosterListKey,
    queryFn: ({ signal }) => apiGet<RosterSummary[]>('/api/rosters', signal),
  });
}
