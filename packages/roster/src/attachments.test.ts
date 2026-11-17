import { describe, expect, it } from 'vitest';
import { canAttach, cleanAttachments, suggestAttachments } from './attachments.js';
import { readRoster } from './importRoster.js';
import { resolveRoster } from './resolve.js';
import { fixtureLookup, rosterFile } from './testing.js';

const lookup = fixtureLookup();
const army = resolveRoster(
  readRoster('rust-pilgrims.ros', rosterFile('rust-pilgrims.ros')),
  lookup,
);
const key = (name: string) => army.units.find((u) => u.datasheetName === name)!.key;

describe('attachments', () => {
  it('suggests the Scrapwarden joins the Devotees', () => {
    expect(suggestAttachments(army, lookup.datasheet)).toEqual({
      [key('Pilgrim Scrapwarden')]: key('Rustbound Devotees'),
    });
  });

  it('refuses units the leader cannot lead and a second normal leader', () => {
    const warden = key('Pilgrim Scrapwarden');
    expect(canAttach(army, {}, warden, key('Cinder Lancers'), lookup.datasheet)).toBe(false);
    const twin = { ...army.units[0]!, key: 'twin' };
    const bigger = { ...army, units: [...army.units, twin] };
    const taken = { [warden]: key('Rustbound Devotees') };
    expect(canAttach(bigger, taken, 'twin', key('Rustbound Devotees'), lookup.datasheet)).toBe(
      false,
    );
  });

  it('cleans attachments to units that are gone', () => {
    const stale = { ...army, attachments: { [key('Pilgrim Scrapwarden')]: 'missing' } };
    expect(cleanAttachments(stale, lookup.datasheet)).toEqual({});
  });
});
