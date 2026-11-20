import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
import { zipSync } from 'fflate';

/** Minimal cookie-aware API client for seeding (Node fetch). */
export function apiClient(base: string) {
  const jar = new Map<string, string>();
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  async function raw(method: string, path: string, body?: unknown, form = false) {
    const headers: Record<string, string> = { Cookie: cookie(), Accept: 'application/json' };
    const token = jar.get('XSRF-TOKEN');
    if (token) headers['X-XSRF-TOKEN'] = token;
    let payload: BodyInit | undefined;
    if (form) payload = body as FormData;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(base + path, { method, headers, ...(payload ? { body: payload } : {}) });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const [k, ...v] = (kv ?? '').split('=');
      if (k) jar.set(k, v.join('='));
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
    return text ? (JSON.parse(text) as unknown) : undefined;
  }
  return {
    async req<T>(method: string, path: string, body?: unknown, form = false): Promise<T> {
      if (!jar.has('XSRF-TOKEN')) await raw('GET', '/api/auth/csrf');
      return (await raw(method, path, body, form)) as T;
    },
  };
}

const FIXTURES = join(here, '..', '..', 'backend', 'src', 'test', 'resources', 'fixtures');

export function fixtureZip(dir: string, files: string[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f] = new Uint8Array(readFileSync(join(FIXTURES, dir, f)));
  return zipSync(entries);
}

export const BATTLESCRIBE = ['Testing Grounds.gst', 'Imperium - Rust Pilgrims.cat', 'Rust Pilgrims Library.cat', 'Imperium - Ember Wardens.cat'];
export const WAHAPEDIA = [
  'Last_update.csv', 'Factions.csv', 'Source.csv', 'Datasheets.csv', 'Datasheets_keywords.csv', 'Datasheets_models.csv',
  'Datasheets_abilities.csv', 'Abilities.csv', 'Datasheets_wargear.csv', 'Datasheets_options.csv', 'Datasheets_unit_composition.csv',
  'Datasheets_models_cost.csv', 'Datasheets_enhancements.csv', 'Datasheets_leader.csv', 'Datasheets_stratagems.csv',
  'Datasheets_detachment_abilities.csv', 'Detachments.csv', 'Detachments_chapter_dp.csv', 'Detachment_abilities.csv',
  'Enhancements.csv', 'Stratagems.csv', 'Enhancements_wargear.csv', 'core-rules.html',
];
