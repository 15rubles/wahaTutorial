import { useQuery } from '@tanstack/react-query';
import { apiGet } from './client';

export type HealthStatus = 'UP' | 'DOWN';
export type HealthResponse = { status: HealthStatus; database: HealthStatus; checkedAt: string };

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => apiGet<HealthResponse>('/api/health', signal),
    refetchInterval: 30_000,
    retry: false,
  });
}
