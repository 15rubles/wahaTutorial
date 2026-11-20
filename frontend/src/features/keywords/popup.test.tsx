import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RulesTextView } from '../../components/rules/RulesTextView';
import { KeywordRefButton } from '../../components/rules/KeywordRefButton';
import { mockApi, userMe, adminMe } from '../../test/mockApi';
import { KeywordPopupProvider } from './KeywordPopupProvider';

function gloss(key: string, term: string, kind: string, plain: string, tokens: unknown[] = [], referencedBy: unknown[] = []) {
  return { body: { entry: { key, term, aliases: [], kind, text: { plain, tokens }, seeAlso: [], referencedBy }, seeAlso: [] } };
}

function renderWith(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <KeywordPopupProvider version={1}>{ui}</KeywordPopupProvider>
    </QueryClientProvider>,
  );
}

describe('keyword popups', () => {
  it('opens, pushes nested terms, goes back and closes on Escape', async () => {
    mockApi({
      'GET /api/me': userMe,
      'GET /api/glossary/g%3Aa': gloss('g:a', 'Alpha', 'WEAPON_ABILITY', 'See Beta.', [
        { type: 'text', value: 'See ' },
        { type: 'ref', glossaryId: 'g:b', label: 'Beta' },
        { type: 'text', value: '.' },
      ]),
      'GET /api/glossary/g%3Ab': gloss('g:b', 'Beta', 'RULE_TERM', 'Beta rules.'),
    });
    renderWith(<RulesTextView text={{ plain: 'x', tokens: [{ type: 'ref', glossaryId: 'g:a', label: 'Alpha 2' }] }} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Alpha 2' }));
    expect(await screen.findByRole('heading', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByText('Printed as: Alpha 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Beta' }));
    expect(await screen.findByRole('heading', { name: 'Beta' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Rules breadcrumb' })).toHaveTextContent('Alpha 2 > Beta');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Alpha' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('explains plain keywords with the reverse index', async () => {
    mockApi({
      'GET /api/me': userMe,
      'GET /api/glossary/g%3Ainfantry': gloss('g:infantry', 'Infantry', 'UNIT_KEYWORD', '', [], [
        { type: 'ABILITY', key: 'a1', name: 'Volley' },
        { type: 'STRATAGEM', key: 's1', name: 'Iron Will' },
      ]),
    });
    renderWith(<KeywordRefButton glossaryId="g:infantry" label="INFANTRY" />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'INFANTRY' }));
    expect(await screen.findByText('Unit keyword, no rules of its own.')).toBeInTheDocument();
    expect(screen.getByText('Volley')).toBeInTheDocument();
    expect(screen.getByText('Stratagems')).toBeInTheDocument();
  });

  it('says when a definition is missing and lets admins add one', async () => {
    const saved: unknown[] = [];
    mockApi({
      'GET /api/me': adminMe,
      'PUT /api/admin/overrides': ({ body }) => {
        saved.push(body);
        return { body: [] };
      },
    });
    renderWith(<KeywordRefButton glossaryId={undefined} label="Conversion" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Conversion' }));
    expect(await screen.findByText('No definition in the database yet.')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Add definition' }));
    await user.type(screen.getByLabelText('Rules text for Conversion'), 'Invented definition.');
    await user.click(screen.getByRole('button', { name: 'Save definition' }));
    expect(await screen.findByText(/Saved/)).toBeInTheDocument();
    expect(saved).toEqual([
      [
        {
          type: 'GLOSSARY',
          key: 'g:conversion',
          field: '*',
          value: { term: 'Conversion', aliases: [], kind: 'RULE_TERM', text: { plain: 'Invented definition.' }, seeAlso: [] },
          note: 'Added from a keyword popup',
        },
      ],
    ]);
  });

  it('does not offer "Add definition" to regular users', async () => {
    mockApi({ 'GET /api/me': userMe });
    renderWith(<KeywordRefButton glossaryId={undefined} label="Conversion" />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Conversion' }));
    expect(await screen.findByText('No definition in the database yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add definition' })).not.toBeInTheDocument();
  });
});
