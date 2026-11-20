import { screen } from '@testing-library/react';
import { mockFetchJson, renderApp } from '../../test/renderApp';

describe('AppShell', () => {
  it('calls /api/health and shows the server as online', async () => {
    const fetchSpy = mockFetchJson(200, { status: 'UP', database: 'UP', checkedAt: '2026-01-01T00:00:00Z' });

    renderApp();

    expect(await screen.findByText('Server online')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith('/api/health', expect.objectContaining({ method: 'GET' }));
    expect(screen.getByText('Muster')).toBeInTheDocument();
  });

  it('shows the database as offline when health reports DOWN', async () => {
    mockFetchJson(503, { status: 'DOWN', database: 'DOWN', checkedAt: '2026-01-01T00:00:00Z' });

    renderApp();

    expect(await screen.findByText('Database offline')).toBeInTheDocument();
  });

  it('shows the server as unreachable when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network down'));

    renderApp();

    expect(await screen.findByText('Server unreachable')).toBeInTheDocument();
  });

  it('renders the three empty panes', async () => {
    mockFetchJson(200, { status: 'UP', database: 'UP', checkedAt: '2026-01-01T00:00:00Z' });

    renderApp();

    expect(screen.getByRole('heading', { name: 'Add units' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your lists' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
    await screen.findByText('Server online');
  });

  it('shows a not found page for unknown routes', async () => {
    mockFetchJson(200, { status: 'UP', database: 'UP', checkedAt: '2026-01-01T00:00:00Z' });

    renderApp('/nope');

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    await screen.findByText('Server online');
  });
});
