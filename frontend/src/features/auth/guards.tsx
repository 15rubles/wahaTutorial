import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMe } from './api';
import { LoadingState, ErrorState } from '../../components/ui/States';

export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <LoadingState label="Checking your session" />;
  if (me.isError) return <ErrorState error={me.error} />;
  if (!me.data) {
    const next = location.pathname + location.search;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.isPending) return <LoadingState label="Checking your session" />;
  if (me.data?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** For /login and /register: signed-in users go straight to their lists. */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.isPending) return <LoadingState label="Checking your session" />;
  if (me.data) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Only allow same-site relative redirects after login. */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}
