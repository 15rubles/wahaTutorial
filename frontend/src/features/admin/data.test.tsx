import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/renderApp';
import { adminMe, mockApi } from '../../test/mockApi';
import type { VersionReport, VersionSummary } from '../../api/gameTypes';

const draft: VersionSummary = {
  version: { id: 3, createdAt: '2026-01-02T00:00:00Z', createdBy: 'boss', status: 'DRAFT', sourceFiles: ['tg.zip'], importIds: { BATTLESCRIBE: 5 } },
  entities: 120,
  errors: 0,
  warnings: 2,
  phaseTagsToReview: 7,
};
const active: VersionSummary = { ...draft, version: { ...draft.version, id: 2, status: 'ACTIVE' } };

const report: VersionReport = {
  sourceImports: { BATTLESCRIBE: 5 },
  counts: { 'rust-pilgrims': { datasheet: 4, detachment: 2 } },
  issues: [
    { level: 'WARNING', category: 'unmatched', message: 'MFM unit size Ghost matches no datasheet', faction: 'rust-pilgrims' },
    { level: 'INFO', category: 'library', message: 'imports 1 root entry' },
  ],
  diff: {
    comparedToVersion: 2,
    added: [],
    removed: [],
    changed: [],
    points: [{ type: 'UNIT_SIZE', key: 'rp:pw:size:10', name: '10 models', before: 90, after: 95 }],
  },
  phaseTagsToReview: 7,
  overridesApplied: 1,
};

describe('admin data', () => {
  it('lists versions and activates a draft', async () => {
    let activated = false;
    mockApi({
      'GET /api/me': adminMe,
      'GET /api/admin/data-versions': () => ({ body: activated ? [{ ...draft, version: { ...draft.version, status: 'ACTIVE' } }] : [draft, active] }),
      'POST /api/admin/data-versions/3/activate': () => {
        activated = true;
        return { body: draft };
      },
    });
    renderApp('/admin/data');
    const row = (await screen.findByRole('link', { name: '#3' })).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('draft')).toBeInTheDocument();
    await userEvent.setup().click(within(row as HTMLElement).getByRole('button', { name: 'Activate' }));
    expect(await screen.findByText('active')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument();
  });

  it('shows the import report with counts, points changes and issues', async () => {
    mockApi({
      'GET /api/me': adminMe,
      'GET /api/admin/data-versions': { body: [draft] },
      'GET /api/admin/data-versions/3/report': { body: report },
    });
    renderApp('/admin/data/versions/3');
    expect(await screen.findByText('rust-pilgrims')).toBeInTheDocument();
    expect(screen.getByText('Points changes', { selector: 'summary' })).toBeInTheDocument();
    expect(screen.getByText('rp:pw:size:10')).toBeInTheDocument();
    expect(screen.getByText(/unmatched \(1\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate this version' })).toBeInTheDocument();
  });
});
