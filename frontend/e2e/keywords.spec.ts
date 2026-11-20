import { expect, test } from '@playwright/test';
import { createList, details as detailsPane, openTab, signIn } from './helpers';

test('weapon ability popup, nested 3-level chain, back and escape', async ({ page }) => {
  await signIn(page);
  await createList(page, `Keywords ${Date.now()}`);
  await openTab(page, 'Add');
  await page.getByRole('button', { name: 'Add Rust Prophet' }).click();
  await openTab(page, 'List');
  await page.getByTestId('entry-rust-pilgrims:rust-prophet').click();

  const details = detailsPane(page);
  await details.getByRole('button', { name: 'Rending Edge 2' }).click();
  const popup = page.getByRole('dialog', { name: 'Rules' });
  await expect(popup.getByRole('heading', { name: 'Rending Edge' })).toBeVisible();
  await expect(popup.getByText('Weapon ability')).toBeVisible();

  await popup.getByRole('button', { name: 'Critical Strike' }).click();
  await expect(popup.getByRole('heading', { name: 'Critical Strike' })).toBeVisible();
  await popup.getByRole('button', { name: 'Hit Roll' }).click();
  await expect(popup.getByRole('heading', { name: 'Hit Roll' })).toBeVisible();
  const crumbs = popup.getByRole('navigation', { name: 'Rules breadcrumb' });
  await expect(crumbs).toContainText('Rending Edge 2 > Critical Strike > Hit Roll');

  await popup.getByRole('button', { name: 'Back' }).click();
  await expect(popup.getByRole('heading', { name: 'Critical Strike' })).toBeVisible();
  await crumbs.getByRole('button', { name: 'Rending Edge 2' }).click();
  await expect(popup.getByRole('heading', { name: 'Rending Edge' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);

  // Plain unit keywords explain themselves and list where they are used.
  await details.getByRole('button', { name: 'INFANTRY' }).click();
  await expect(page.getByRole('dialog', { name: 'Rules' })).toContainText('Unit keyword, no rules of its own.');
});
