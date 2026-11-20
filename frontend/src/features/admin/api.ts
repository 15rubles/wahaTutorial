import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiSend } from '../../api/client';

export type InviteStatus = 'ACTIVE' | 'USED' | 'EXPIRED';
export type Invite = {
  id: number;
  code: string;
  status: InviteStatus;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  usedBy?: string;
  usedAt?: string;
};

const invitesKey = ['admin', 'invites'] as const;

export function useInvites() {
  return useQuery({ queryKey: invitesKey, queryFn: ({ signal }) => apiGet<Invite[]>('/api/admin/invites', signal) });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (validDays: number) => apiSend<Invite>('POST', '/api/admin/invites', { validDays }),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitesKey }),
  });
}
