import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
import { BATTLESCRIBE, WAHAPEDIA, apiClient, fixtureZip } from './api';

/**
 * Imports the invented fixture data (BattleScribe + Wahapedia), activates it, and registers a fresh
 * user for this run. Credentials of that user are written to e2e/.user.json (gitignored).
 */
export default async function globalSetup() {
  const base = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
  const admin = apiClient(base);
  await admin.req('POST', '/api/auth/login', {
    username: process.env.E2E_ADMIN_USER ?? 'admin',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'admin-password-1',
  });
  for (const [source, zip] of [
    ['battlescribe', fixtureZip('battlescribe', BATTLESCRIBE)],
    ['wahapedia', fixtureZip('wahapedia', WAHAPEDIA)],
  ] as const) {
    const form = new FormData();
    form.append('file', new Blob([Buffer.from(zip)]), `${source}.zip`);
    const res = await admin.req<{ versionId: number }>('POST', `/api/admin/imports/${source}`, form, true);
    if (source === 'wahapedia') await admin.req('POST', `/api/admin/data-versions/${res.versionId}/activate`);
  }
  const invite = await admin.req<{ code: string }>('POST', '/api/admin/invites', {});
  const username = `e2e${Date.now().toString(36)}`;
  const password = 'password-1234';
  await apiClient(base).req('POST', '/api/auth/register', { username, email: `${username}@example.test`, password, inviteCode: invite.code });
  writeFileSync(join(here, '.user.json'), JSON.stringify({ username, password }));
}
