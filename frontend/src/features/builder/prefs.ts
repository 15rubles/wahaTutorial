import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { apiGet, apiSend } from '../../api/client';

export type Prefs = { panes?: number[]; lastRosterId?: number };

export const DEFAULT_PANES = [22, 48, 30];
const LOCAL_KEY = 'muster.panes';

export function readLocalPanes(): number[] | undefined {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return undefined;
    const v: unknown = JSON.parse(raw);
    return validPanes(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

export function writeLocalPanes(sizes: number[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(sizes));
  } catch {
    /* storage may be unavailable (private mode); server prefs still work */
  }
}

export function validPanes(v: unknown): v is number[] {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && n >= 0 && n <= 100);
}

export function usePrefs() {
  return useQuery({ queryKey: ['prefs'], queryFn: ({ signal }) => apiGet<Prefs>('/api/me/prefs', signal), staleTime: Infinity });
}

/** Saves prefs to the server, debounced, merging with what the server has. */
export function useSavePrefs() {
  const prefs = usePrefs();
  const save = useMutation({ mutationFn: (p: Prefs) => apiSend<Prefs>('PUT', '/api/me/prefs', p) });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Prefs>({});
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (patch: Prefs) => {
    latest.current = { ...(prefs.data ?? {}), ...latest.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save.mutate(latest.current), 600);
  };
}
