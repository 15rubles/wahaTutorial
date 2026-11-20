import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/renderApp';
import { mockApi, userMe } from '../../test/mockApi';
import type { RosterView } from '../rosters/api';

const roster: RosterView = {
  id: 7,
  name: 'Iron Pilgrims',
  factionKey: 'rust-pilgrims',
  factionName: 'Rust Pilgrims',
  version: { rosterVersion: 3, activeVersion: 3, outdated: false },
  battleSizeKey: 'battle-size:grand-clash',
  factionOptions: {},
  flags: { legends: false, unalignedForces: false, unalignedFortifications: false },
  detachments: ['rp:det:iron'],
  entries: [
    { id: 1, datasheetKey: 'rp:prophet', name: 'Rust Prophet', role: 'Infantry Character', sizeKey: 'rp:prophet:size:1', sizeName: '1 model', models: 1, wargear: [], warlord: true, sortOrder: 0, points: 80, pointsComplete: true, missing: false, enhancementName: 'Relic of Rust', enhancementKey: 'rp:det:iron:enh:relic', attachedTo: 2 },
    { id: 2, datasheetKey: 'rp:warband', name: 'Pilgrim Warband', role: 'Battleline', sizeKey: 'rp:warband:size:10', sizeName: '10 models', models: 10, wargear: [], warlord: false, sortOrder: 1, points: 100, pointsComplete: true, missing: false },
  ],
  totals: { points: 180, pointsComplete: true, pointsLimit: 2000, dp: 1, dpBudget: 3, enhancements: 1, enhancementLimit: 4, legal: false, errors: 1, warnings: 0 },
  violations: [{ severity: 'ERROR', code: 'X', message: 'Something is wrong with the warband', entryIds: [2] }],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const common = {
  'GET /api/me': userMe,
  'GET /api/me/prefs': { body: {} },
  'PUT /api/me/prefs': { body: {} },
  'GET /api/factions': { body: [{ key: 'rust-pilgrims', name: 'Rust Pilgrims', datasheetCount: 2 }] },
  'GET /api/factions/rust-pilgrims': { body: { faction: { key: 'rust-pilgrims', name: 'Rust Pilgrims' }, armyRules: [], factionOptions: [], detachments: [] } },
  'GET /api/factions/rust-pilgrims/detachments': {
    body: [{ detachment: { key: 'rp:det:iron', faction: 'rust-pilgrims', name: 'Pilgrimage of Iron', dpCost: 1, uniqueTags: [], ruleText: { plain: '', tokens: [] }, forceDispositions: [], dpByKeyword: {} }, rules: [], enhancements: [], stratagems: [] }],
  },
  'GET /api/factions/rust-pilgrims/datasheets': {
    body: [
      { key: 'rp:prophet', name: 'Rust Prophet', faction: 'rust-pilgrims', role: 'Infantry Character', legends: false, keywords: [], factionKeywords: [], sizes: [{ key: 'rp:prophet:size:1', datasheet: 'rp:prophet', name: '1 model', models: 1, points: 80 }] },
      { key: 'rp:warband', name: 'Pilgrim Warband', faction: 'rust-pilgrims', role: 'Battleline', legends: false, keywords: [], factionKeywords: [], sizes: [{ key: 'rp:warband:size:10', datasheet: 'rp:warband', name: '10 models', models: 10, points: 100 }] },
      { key: 'rp:walker', name: 'Scrap Walker', faction: 'rust-pilgrims', role: 'Vehicle', legends: true, keywords: [], factionKeywords: [], sizes: [] },
    ],
  },
  'GET /api/battle-sizes': { body: [{ key: 'battle-size:grand-clash', name: 'Grand Clash', pointsLimit: 2000, dpBudget: 3, limits: {} }] },
  'GET /api/force-dispositions': { body: [] },
  'GET /api/rosters/7': { body: roster },
};

describe('builder', () => {
  it('shows totals, sections by role and unit sub-lines', async () => {
    mockApi(common);
    renderApp('/rosters/7');
    expect(await screen.findByTestId('points-total')).toHaveTextContent('180');
    expect(screen.getByTestId('points-total')).toHaveTextContent('/ 2000');
    expect(screen.getByTestId('dp-total')).toHaveTextContent('1 / 3');
    expect(screen.getByTestId('legal-status')).toHaveTextContent('1 error');
    const prophet = screen.getByTestId('entry-rp:prophet');
    expect(within(prophet).getByText('WARLORD')).toBeInTheDocument();
    expect(prophet).toHaveTextContent('Enhancement: Relic of Rust');
    expect(prophet).toHaveTextContent('Leading: Pilgrim Warband');
    expect(screen.getByText('CHARACTERS · 1')).toBeInTheDocument();
    expect(screen.getByText('BATTLELINE · 1')).toBeInTheDocument();
    // Legends units stay hidden while the roster hides them.
    expect(screen.queryByRole('button', { name: 'Add Scrap Walker' })).not.toBeInTheDocument();
  });

  it('adds a unit with the + button and shows the new totals', async () => {
    const added: unknown[] = [];
    mockApi({
      ...common,
      'POST /api/rosters/7/entries': ({ body }) => {
        added.push(body);
        return { status: 201, body: { ...roster, totals: { ...roster.totals, points: 280 } } };
      },
    });
    renderApp('/rosters/7');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Add Pilgrim Warband' }));
    expect(await screen.findByText('280', { exact: false })).toBeInTheDocument();
    expect(added).toEqual([{ datasheetKey: 'rp:warband' }]);
  });

  it('filters the add list by search', async () => {
    mockApi(common);
    renderApp('/rosters/7');
    const search = await screen.findByPlaceholderText('Search datasheets');
    // jsdom loses focus inside the resizable panel group; real typing is covered by the Playwright test.
    fireEvent.change(search, { target: { value: 'warb' } });
    expect(search).toHaveValue('warb');
    expect(screen.getByRole('button', { name: 'Add Pilgrim Warband' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Rust Prophet' })).not.toBeInTheDocument();
  });

  it('shows violations for the selected unit in the details pane', async () => {
    mockApi({
      ...common,
      'GET /api/datasheets/rp%3Awarband': {
        body: {
          versionId: 3,
          datasheet: { key: 'rp:warband', faction: 'rust-pilgrims', name: 'Pilgrim Warband', role: 'Battleline', keywords: ['Infantry'], factionKeywords: ['Rust Pilgrims'], profiles: [], legends: false, leaderOf: [], support: false, wargearPoints: [] },
          sizes: [], weapons: [], abilities: [], wargear: [], leads: [], ledBy: [],
        },
      },
    });
    renderApp('/rosters/7');
    await userEvent.setup().click(await screen.findByTestId('entry-rp:warband'));
    const details = screen.getByRole('region', { name: 'Details' });
    expect(await within(details).findByText('Something is wrong with the warband')).toBeInTheDocument();
    expect(within(details).getByText('INFANTRY')).toBeInTheDocument();
  });
});
