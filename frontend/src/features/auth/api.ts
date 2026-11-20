import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiSend } from '../../api/client';

export type Role = 'USER' | 'ADMIN';
export type Me = { id: number; username: string; email: string; role: Role };

export const meKey = ['me'] as const;

async function fetchMe(signal?: AbortSignal): Promise<Me | null> {
  try {
    return await apiGet<Me>('/api/me', signal);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export function useMe() {
  return useQuery({ queryKey: meKey, queryFn: ({ signal }) => fetchMe(signal), staleTime: 60_000, retry: false });
}

export type LoginInput = { username: string; password: string };
export type RegisterInput = { username: string; email: string; password: string; inviteCode: string };

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => apiSend<Me>('POST', '/api/auth/login', input),
    onSuccess: (me) => {
      qc.clear();
      qc.setQueryData(meKey, me);
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => apiSend<Me>('POST', '/api/auth/register', input),
    onSuccess: (me) => {
      qc.clear();
      qc.setQueryData(meKey, me);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiSend<void>('POST', '/api/auth/logout'),
    onSettled: () => {
      qc.clear();
      qc.setQueryData(meKey, null);
    },
  });
}
