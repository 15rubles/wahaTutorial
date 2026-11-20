import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockApi } from '../../test/mockApi';
import { ExportDialog } from './ExportDialog';
import type { ExportData, ExportSettings } from './types';

const data = {
  roster: { id: 7, name: 'Iron Pilgrims', entries: [], totals: { points: 0, dp: 0 }, factionOptions: {} },
  faction: { key: 'rp', name: 'Rust Pilgrims' },
  factionOptions: [],
  armyRules: [],
  armyRuleAbilities: [],
  selectedDetachments: [],
  otherDetachments: [],
  coreStratagems: [],
  datasheets: {},
  glossary: {},
  dataVersion: { id: 1, createdAt: '2026-01-01T00:00:00Z' },
};

function setup(generate: (d: ExportData, s: ExportSettings) => Promise<Blob>) {
  const presets: unknown[] = [];
  mockApi({
    'GET /api/rosters/7/export-data': { body: data },
    'GET /api/me/export-presets': () => ({ body: presets }),
    'POST /api/me/export-presets': ({ body }) => {
      const p = { id: presets.length + 1, updatedAt: 'x', ...(body as object) };
      presets.push(p);
      return { status: 201, body: p };
    },
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <ExportDialog rosterId={7} onClose={onClose} generate={generate} />
    </QueryClientProvider>,
  );
  return { onClose, presets };
}

describe('export dialog', () => {
  beforeEach(() => localStorage.clear());

  it('passes the chosen options to the PDF and remembers them', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    const generate = vi.fn(async (_d: ExportData, _s: ExportSettings) => new Blob(["%PDF"]));
    setup(generate);
    expect(await screen.findByTestId('page-estimate')).toHaveTextContent('about 7 pages');
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Letter'));
    await user.click(screen.getByLabelText('Include points'));
    await user.click(screen.getByLabelText('Keyword glossary'));
    await user.click(screen.getByRole('button', { name: 'Move Phase cheat sheet up' }));
    expect(screen.getByTestId('page-estimate')).toHaveTextContent('about 6 pages');
    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(await screen.findByText('Downloaded iron-pilgrims.pdf')).toBeInTheDocument();
    const settings = generate.mock.calls[0]?.[1] as ExportSettings;
    expect(settings.paper).toBe('LETTER');
    expect(settings.includePoints).toBe(false);
    expect(settings.sections.find((s) => s.id === 'glossary')?.on).toBe(false);
    expect(settings.sections.map((s) => s.id).indexOf('cheatsheet')).toBe(4);
    expect(JSON.parse(localStorage.getItem('muster.export.last') ?? '{}').paper).toBe('LETTER');
  });

  it('saves presets and closes on Escape', async () => {
    const { onClose, presets } = setup(async () => new Blob());
    const user = userEvent.setup();
    await screen.findByTestId('page-estimate');
    await user.type(screen.getByLabelText('Preset name'), 'Tournament');
    await user.click(screen.getByRole('button', { name: 'Save as preset' }));
    expect(await screen.findByText('Preset saved')).toBeInTheDocument();
    expect(presets).toHaveLength(1);
    expect(await within(screen.getByLabelText('Load a preset')).findByText('Tournament')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('cannot export with every section off', async () => {
    setup(async () => new Blob());
    await screen.findByTestId('page-estimate');
    const user = userEvent.setup();
    for (const label of ['Summary', 'Army and detachment rules', 'Unit cards', 'Enhancements', 'Stratagems', 'Phase cheat sheet', 'Keyword glossary']) {
      await user.click(screen.getByLabelText(label));
    }
    expect(screen.getByTestId('page-estimate')).toHaveTextContent('nothing selected');
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
  });
});
