import { MAX_DEPTH, pop, push, truncate, type PopupEntry } from './stack';

const e = (id: string): PopupEntry => ({ id, label: id });

describe('popup stack', () => {
  it('pushes, skips duplicate consecutive entries and pops', () => {
    let s = push([], e('a'));
    s = push(s, e('b'));
    s = push(s, e('b'));
    expect(s.map((x) => x.id)).toEqual(['a', 'b']);
    s = push(s, e('a'));
    expect(s.map((x) => x.id)).toEqual(['a', 'b', 'a']);
    expect(pop(s).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('keeps at most 10 entries, dropping the oldest', () => {
    let s: PopupEntry[] = [];
    for (let i = 0; i < 14; i++) s = push(s, e(`k${i}`));
    expect(s).toHaveLength(MAX_DEPTH);
    expect(s[0]?.id).toBe('k4');
  });

  it('truncates to a breadcrumb', () => {
    const s = [e('a'), e('b'), e('c')];
    expect(truncate(s, 0).map((x) => x.id)).toEqual(['a']);
  });

  it('entries without id compare by label', () => {
    const s = push([{ id: undefined, label: 'Conversion' }], { id: undefined, label: 'conversion' });
    expect(s).toHaveLength(1);
  });
});
