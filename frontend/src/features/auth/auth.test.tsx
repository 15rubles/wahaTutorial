import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/renderApp';
import { adminMe, anon, mockApi, userMe } from '../../test/mockApi';

describe('auth flow', () => {
  it('sends anonymous visitors to the login page', async () => {
    mockApi({ 'GET /api/me': anon });
    const { router } = renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?next=%2F');
  });

  it('signs in and lands on the empty list page', async () => {
    let signedIn = false;
    const fetchSpy = mockApi({
      'GET /api/me': () => (signedIn ? userMe : anon),
      'POST /api/auth/login': ({ body }) => {
        expect(body).toEqual({ username: 'friend', password: 'secret-password' });
        signedIn = true;
        return userMe;
      },
      'GET /api/rosters': { body: [] },
    });
    renderApp('/login');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Username'), ' friend ');
    await user.type(screen.getByLabelText('Password'), 'secret-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('You have no army lists yet.')).toBeInTheDocument();
    expect(screen.getByText('friend')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();

    const loginCall = fetchSpy.mock.calls.find(([u]) => u === '/api/auth/login');
    expect((loginCall?.[1]?.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('test-token');
  });

  it('shows the lockout message from the server', async () => {
    mockApi({
      'GET /api/me': anon,
      'POST /api/auth/login': {
        status: 423,
        body: { code: 'ACCOUNT_LOCKED', message: 'Too many failed logins. Try again in 15 minutes.', fieldErrors: [] },
      },
    });
    renderApp('/login');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Username'), 'x');
    await user.type(screen.getByLabelText('Password'), 'y');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in 15 minutes');
  });

  it('prefills the invite code from the link and shows field errors', async () => {
    mockApi({
      'GET /api/me': anon,
      'POST /api/auth/register': ({ body }) => {
        expect((body as { inviteCode: string }).inviteCode).toBe('ABCD-EFGH-JKMN');
        return {
          status: 400,
          body: {
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed',
            fieldErrors: [{ field: 'password', message: 'size must be between 10 and 128' }],
          },
        };
      },
    });
    renderApp('/register?invite=ABCD-EFGH-JKMN');
    expect(await screen.findByLabelText('Invite code')).toHaveValue('ABCD-EFGH-JKMN');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), 'newbie');
    await user.type(screen.getByLabelText('Email'), 'n@example.test');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('size must be between 10 and 128')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps regular users out of the admin pages', async () => {
    mockApi({ 'GET /api/me': userMe, 'GET /api/rosters': { body: [] } });
    const { router } = renderApp('/admin/invites');
    await screen.findByText('You have no army lists yet.');
    expect(router.state.location.pathname).toBe('/');
  });

  it('signs out and returns to login', async () => {
    let signedIn = true;
    mockApi({
      'GET /api/me': () => (signedIn ? adminMe : anon),
      'GET /api/rosters': { body: [] },
      'POST /api/auth/logout': () => {
        signedIn = false;
        return { status: 204 };
      },
    });
    const { router } = renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});

describe('status pill', () => {
  it('stays hidden while the server is healthy', async () => {
    mockApi({ 'GET /api/me': anon });
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(screen.queryByText('Server unreachable')).not.toBeInTheDocument();
  });

  it('warns when the database is down', async () => {
    mockApi({
      'GET /api/me': anon,
      'GET /api/health': { status: 503, body: { status: 'DOWN', database: 'DOWN', checkedAt: 'x' } },
    });
    renderApp('/login');
    expect(await screen.findByText('Database offline')).toBeInTheDocument();
  });
});
