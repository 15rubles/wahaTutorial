import { Navigate, type RouteObject } from 'react-router-dom';
import { AppShell } from '../components/AppShell/AppShell';
import { AdminLayout } from '../features/admin/AdminLayout';
import { InvitesPage } from '../features/admin/InvitesPage';
import { RedirectIfSignedIn, RequireAdmin, RequireAuth } from '../features/auth/guards';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { RosterListPage } from '../features/rosters/RosterListPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      {
        path: '/login',
        element: (
          <RedirectIfSignedIn>
            <LoginPage />
          </RedirectIfSignedIn>
        ),
      },
      {
        path: '/register',
        element: (
          <RedirectIfSignedIn>
            <RegisterPage />
          </RedirectIfSignedIn>
        ),
      },
      {
        index: true,
        element: (
          <RequireAuth>
            <RosterListPage />
          </RequireAuth>
        ),
      },
      {
        path: '/admin',
        element: (
          <RequireAuth>
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          </RequireAuth>
        ),
        children: [
          { index: true, element: <Navigate to="invites" replace /> },
          { path: 'invites', element: <InvitesPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
