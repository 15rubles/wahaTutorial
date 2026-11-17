import type { RuleSection } from '@battle-drill/data';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { indexRules, type RulesIndex, useData } from '../data/store.js';
import { RulesPage, search } from './RulesPage.js';

const dir = resolve(import.meta.dirname, '../../../../fixtures/normalized');
const roots = JSON.parse(readFileSync(resolve(dir, 'rules.json'), 'utf8')) as RuleSection[];
const index = JSON.parse(readFileSync(resolve(dir, 'rules-index.json'), 'utf8')) as RulesIndex;
const rules = indexRules(roots, index);

describe('RulesPage (fixture rules)', () => {
  beforeEach(() => {
    useData.setState({ status: 'ready', rules, source: 'fixture' });
  });

  it('searches titles and text', () => {
    expect(search(rules, 'hit roll')[0]?.id).toBe('core.attack-sequence.hit-roll');
    expect(search(rules, '05.02')[0]?.id).toBe('core.attack-sequence.wound-roll');
    expect(search(rules, 'zzzz')).toEqual([]);
  });

  it('shows a selected section with breadcrumbs', () => {
    render(<RulesPage selectedId="core.attack-sequence.hit-roll" />);
    const content = screen.getByTestId('rule-content');
    expect(content).toHaveTextContent('Hit Roll');
    expect(content).toHaveTextContent('Attack Sequence');
    expect(content).toHaveTextContent('Fixture text for 1. Hit Roll');
  });

  it('filters while typing', () => {
    render(<RulesPage />);
    fireEvent.change(screen.getByLabelText('Search rules'), { target: { value: 'lethal' } });
    expect(screen.getByTestId('rule-search-results')).toHaveTextContent('LETHAL HITS');
  });
});
