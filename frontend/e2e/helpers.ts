import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
import { expect, type Page } from '@playwright/test';

export function e2eUser(): { username: string; password: string } {
  return JSON.parse(readFileSync(join(here, '.user.json'), 'utf8')) as { username: string; password: string };
}

export async function signIn(page: Page) {
  const { username, password } = e2eUser();
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'My lists' })).toBeVisible();
}

export async function createList(page: Page, name: string) {
  await page.getByRole('button', { name: 'New list' }).click();
  await page.getByLabel('List name').fill(name);
  await page.getByLabel('Faction').selectOption({ label: 'Rust Pilgrims' });
  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page.getByTestId('points-total')).toBeVisible();
}

/** On phones the builder shows one pane at a time: switch to it when the tab bar is there. */
export async function openTab(page: Page, name: 'Add' | 'List' | 'Details') {
  const tab = page.getByRole('tab', { name });
  if (await tab.isVisible()) await tab.click();
}

/** The Details pane (a region on desktop, a tab panel on phones). */
export function details(page: Page) {
  return page.locator('section[aria-label="Details"]');
}

/** The configuration panel starts collapsed on phones. */
export async function openConfig(page: Page) {
  const expand = page.getByRole('button', { name: 'Expand configuration' });
  if (await expand.isVisible()) await expand.click();
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
