import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv.js';
import { BOM } from './text.js';

describe('parseCsv', () => {
  it('handles BOM, trailing pipes and CRLF', () => {
    const t = parseCsv(`${BOM}id|name|\r\n1|Alpha|\r\n2|Beta|\r\n`);
    expect(t.header).toEqual(['id', 'name']);
    expect(t.rows.map((r) => r.values)).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
    ]);
    expect(t.malformed).toEqual([]);
  });

  it('keeps raw newlines inside fields and tracks line numbers', () => {
    const t = parseCsv('id|text|\n1|line one\nline two|\n2|x|\n');
    expect(t.rows[0]?.values['text']).toBe('line one\nline two');
    expect(t.rows[0]?.line).toBe(2);
    expect(t.rows[1]?.line).toBe(4);
  });

  it('keeps HTML untouched', () => {
    const t = parseCsv('id|d|\n1|<b>bold</b> &amp; more|\n');
    expect(t.rows[0]?.values['d']).toBe('<b>bold</b> &amp; more');
  });

  it('reports records with an extra field and recovers', () => {
    const t = parseCsv('id|name|\n1|a|extra|\n2|b|\n');
    expect(t.malformed).toEqual([{ line: 2, reason: 'more fields than header' }]);
    expect(t.rows.map((r) => r.values['id'])).toEqual(['2']);
  });

  it('reports a truncated last record', () => {
    const t = parseCsv('id|name|\n1|a|\n2|');
    expect(t.rows).toHaveLength(1);
    expect(t.malformed[0]?.reason).toBe('fewer fields than header');
  });
});
