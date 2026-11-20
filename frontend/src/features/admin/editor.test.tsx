import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/renderApp';
import { adminMe, mockApi } from '../../test/mockApi';

const factions = { body: [{ key: 'rust-pilgrims', name: 'Rust Pilgrims', datasheetCount: 3 }] };

describe('admin editor', () => {
  it('shows provenance and saves a field as an override with a note', async () => {
    const saved: unknown[] = [];
    mockApi({
      'GET /api/me': adminMe,
      'GET /api/factions': factions,
      'GET /api/admin/entities': {
        body: [{ type: 'UNIT_SIZE', key: 'rp:pw:size:10', name: '10 models', source: 'MFM', parent: 'rp:pw' }],
      },
      'GET /api/admin/entities/UNIT_SIZE/rp%3Apw%3Asize%3A10': {
        body: {
          stored: {
            entity: { key: 'rp:pw:size:10', datasheet: 'rp:pw', name: '10 models', models: 10, points: 95 },
            source: 'WAHAPEDIA',
            provenance: { points: 'MFM', name: 'WAHAPEDIA' },
            externalIds: {},
          },
          overrides: [],
        },
      },
      'PUT /api/admin/overrides': ({ body }) => {
        saved.push(body);
        return { body: [] };
      },
    });
    renderApp('/admin/editor');
    await userEvent.setup().click(await screen.findByRole('button', { name: /10 models/ }));
    const pointsRow = (await screen.findByText('points')).closest('div')?.parentElement as HTMLElement;
    expect(within(pointsRow).getByText('mfm')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(within(pointsRow).getByRole('button', { name: 'Edit' }));
    const input = within(pointsRow).getByLabelText('points');
    await user.clear(input);
    await user.type(input, '100');
    await user.type(within(pointsRow).getByPlaceholderText('why this change'), 'new MFM');
    await user.click(within(pointsRow).getByRole('button', { name: 'Save' }));
    await screen.findByText('points');
    expect(saved).toEqual([[{ type: 'UNIT_SIZE', key: 'rp:pw:size:10', field: 'points', value: 100, note: 'new MFM' }]]);
  });

  it('rejects a non-number for a number field', async () => {
    mockApi({
      'GET /api/me': adminMe,
      'GET /api/factions': factions,
      'GET /api/admin/entities': { body: [{ type: 'UNIT_SIZE', key: 'k', name: 'Size', source: 'MFM' }] },
      'GET /api/admin/entities/UNIT_SIZE/k': {
        body: { stored: { entity: { key: 'k', name: 'Size', points: 5 }, source: 'MFM', provenance: {}, externalIds: {} }, overrides: [] },
      },
    });
    renderApp('/admin/editor');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Size/ }));
    const row = (await screen.findByText('points')).closest('div')?.parentElement as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    await user.clear(within(row).getByLabelText('points'));
    await user.type(within(row).getByLabelText('points'), 'lots');
    await user.click(within(row).getByRole('button', { name: 'Save' }));
    expect(await within(row).findByText('Enter a whole number')).toBeInTheDocument();
  });
});

describe('phase review', () => {
  it('confirms an edited tag', async () => {
    const confirmed: unknown[] = [];
    mockApi({
      'GET /api/me': adminMe,
      'GET /api/factions': factions,
      'GET /api/admin/review/phase-tags': {
        body: {
          total: 1,
          offset: 0,
          items: [
            {
              type: 'ABILITY',
              key: 'rp:pw:ab:volley',
              name: 'Volley',
              faction: 'rust-pilgrims',
              tags: { phases: ['SHOOTING'], timing: 'YOUR_TURN', inferred: true, confirmed: false },
              text: 'In your Shooting phase...',
            },
          ],
        },
      },
      'POST /api/admin/review/phase-tags/confirm': ({ body }) => {
        confirmed.push(body);
        return { status: 204 };
      },
    });
    renderApp('/admin/review');
    expect(await screen.findByText('Volley')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Fight'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(confirmed).toEqual([
      [{ type: 'ABILITY', key: 'rp:pw:ab:volley', tags: { phases: ['SHOOTING', 'FIGHT'], timing: 'YOUR_TURN', inferred: true, confirmed: false } }],
    ]);
  });
});
