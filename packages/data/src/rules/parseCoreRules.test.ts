import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXTURE_RAW_DIR, readFixtureFiles } from '../fixtures.js';
import { normalize } from '../normalize.js';
import { addCoreRules } from './buildRules.js';
import { buildKeywordIndex } from './keywordIndex.js';
import { flattenRules, parseCoreRules } from './parseCoreRules.js';

const PAGE = 'https://wahapedia.ru/wh40k11ed/the-rules/core-rules/';
const html = readFileSync(`${FIXTURE_RAW_DIR}/core-rules.html`, 'utf8');

describe('parseCoreRules', () => {
  const rules = parseCoreRules(html, { pageUrl: PAGE });
  const flat = flattenRules(rules.roots);
  const byId = new Map(flat.map((s) => [s.id, s]));

  it('builds groups and a hierarchy from the dotted codes', () => {
    expect(rules.roots.map((r) => r.id)).toEqual([
      'core.group.basic-rules',
      'core.group.the-battle-round',
      'core.group.battlefields-and-tactics',
      'core.group.advanced-rules',
      'core.group.reference',
    ]);
    const seq = byId.get('core.attack-sequence')!;
    expect(seq.number).toBe('05');
    expect(seq.children.map((c) => c.id)).toEqual([
      'core.attack-sequence.hit-roll',
      'core.attack-sequence.wound-roll',
      'core.attack-sequence.save-rolls',
      'core.attack-sequence.inflict-damage',
    ]);
    expect(byId.get('core.attack-sequence.hit-roll')!.children[0]!.id).toBe(
      'core.attack-sequence.hit-roll.critical-hits-and-critical-wounds',
    );
  });

  it('recognises every marker type', () => {
    expect(rules.codes['08']).toBe('core.command-phase'); // h_number_red2 top level
    expect(rules.codes['09.05']).toBe('core.movement-phase.normal-move'); // str11Name box
    expect(byId.get('core.core-abilities.lethal-hits')?.kind).toBe('ability'); // abName box
    expect(byId.get('core.moving.moving-units.ending-a-move')?.number).toBe(''); // uncoded heading
  });

  it('places a box that appears before its parent under the right code', () => {
    expect(rules.codes['24.22']).toBe('core.core-abilities.leader-support');
  });

  it('ignores tooltip templates, scripts and the footer', () => {
    expect(flat.filter((s) => s.number === '24.23')).toHaveLength(1);
    const text = flat.map((s) => s.html).join('\n');
    expect(text).not.toContain('Tooltip copy');
    expect(text).not.toContain('<script');
    expect(text).not.toContain('Disable Ads');
    expect(text).not.toContain('style=');
  });

  it('cleans bodies: FAQ as details, dice icons as text, links rewritten', () => {
    const hit = byId.get('core.attack-sequence.hit-roll')!;
    expect(hit.html).toContain('<details class="rule-faq"><summary>FAQ</summary>');
    expect(byId.get('core.core-concepts.dice')!.html).toContain('<span class="die">6</span>');
    const wound = byId.get('core.attack-sequence.wound-roll')!.html;
    expect(wound).toContain('href="#rule:core.attack-sequence.hit-roll"');
    expect(wound).toContain('href="https://wahapedia.ru/wh40k11ed/factions/example/"');
    expect(hit.sourceUrl).toBe(`${PAGE}#1.-Hit-Roll`);
  });

  it('drops unsafe links', () => {
    const evil = html.replace('href="/wh40k11ed/factions/example/"', 'href="javascript:alert(1)"');
    const out = flattenRules(parseCoreRules(evil, { pageUrl: PAGE }).roots)
      .map((s) => s.html)
      .join('');
    expect(out).not.toContain('javascript:');
  });
});

describe('keyword index', () => {
  const data = normalize(readFixtureFiles());
  const rules = parseCoreRules(html, { pageUrl: PAGE });
  const result = buildKeywordIndex(rules.roots, data, rules);

  it('resolves weapon keywords to core ability sections', () => {
    expect(result.index.weaponKeywords['lethal-hits']).toBe('core.core-abilities.lethal-hits');
    expect(result.index.weaponKeywords['anti']).toBe('core.core-abilities.anti');
  });

  it('resolves unit keywords through aliases and shared abilities by name', () => {
    expect(result.index.unitKeywords['vehicle']).toBe('core.monsters-and-vehicles');
    expect(result.index.abilities['900000101']).toBe('core.core-abilities.leader-support');
  });

  it('lists every other keyword as unresolved, except identity keywords', () => {
    const all = data.keywords.length;
    const resolved = result.keywords.filter((k) => k.ruleId).length;
    expect(resolved + result.unresolved.length + result.identityKeywords).toBe(all);
    expect(result.unresolved.map((u) => u.keyword)).toContain('Infantry');
    expect(result.index.mentions['infantry']).toEqual(['core.datasheets.keywords']);
  });

  it('records a missing rules page as an error', () => {
    const d = normalize(readFixtureFiles());
    expect(addCoreRules(d, {})).toEqual({});
    expect(d.report.errors[0]?.category).toBe('missing-file');
  });
});
