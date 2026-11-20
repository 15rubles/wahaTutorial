import { expect, test } from '@playwright/test';
import { apiClient } from './api';

test('a friend registers with an invite link and creates a list', async ({ page }) => {
  const base = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
  const admin = apiClient(base);
  await admin.req('POST', '/api/auth/login', {
    username: process.env.E2E_ADMIN_USER ?? 'admin',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'admin-password-1',
  });
  const invite = await admin.req<{ code: string }>('POST', '/api/admin/invites', { validDays: 1 });
  const name = `friend${Date.now().toString(36)}`;

  await page.goto(`/register?invite=${invite.code}`);
  await expect(page.getByLabel('Invite code')).toHaveValue(invite.code);
  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Email').fill(`${name}@example.test`);
  await page.getByLabel('Password').fill('password-1234');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'My lists' })).toBeVisible();
  await expect(page.getByText('You have no army lists yet.')).toBeVisible();

  await page.getByRole('button', { name: 'New list' }).click();
  await page.getByLabel('List name').fill('First list');
  await page.getByLabel('Faction').selectOption({ label: 'Rust Pilgrims' });
  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page.getByTestId('points-total')).toBeVisible();
});
