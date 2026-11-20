import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/renderApp';
import { adminMe, mockApi } from '../../test/mockApi';

describe('admin invites', () => {
  it('creates an invite and lists codes', async () => {
    const invites = [
      {
        id: 1,
        code: 'AAAA-BBBB-CCCC',
        status: 'USED',
        createdBy: 'boss',
        createdAt: '2026-01-01T00:00:00Z',
        expiresAt: '2026-01-08T00:00:00Z',
        usedBy: 'friend',
      },
    ];
    mockApi({
      'GET /api/me': adminMe,
      'GET /api/admin/invites': () => ({ body: invites }),
      'POST /api/admin/invites': ({ body }) => {
        expect(body).toEqual({ validDays: 14 });
        const created = {
          id: 2,
          code: 'DDDD-EEEE-FFFF',
          status: 'ACTIVE',
          createdBy: 'boss',
          createdAt: '2026-01-02T00:00:00Z',
          expiresAt: '2026-01-16T00:00:00Z',
        };
        invites.unshift(created as (typeof invites)[number]);
        return { status: 201, body: created };
      },
    });
    renderApp('/admin/invites');
    expect(await screen.findByText('AAAA-BBBB-CCCC')).toBeInTheDocument();
    expect(screen.getByText('friend')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Valid for'), '14');
    await user.click(screen.getByRole('button', { name: 'Create invite' }));
    expect(await screen.findAllByText('DDDD-EEEE-FFFF')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });
});
