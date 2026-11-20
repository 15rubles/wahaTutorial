import { expect, test } from '@playwright/test';
import { createList, details, noHorizontalScroll, openTab, signIn } from './helpers';

test('create list, add 3 units, set warlord, see points update', async ({ page }) => {
  await signIn(page);
  await createList(page, `E2E ${Date.now()}`);
  const points = page.getByTestId('points-total');
  await expect(points).toContainText('0');
  await openTab(page, 'Add');

  await page.getByPlaceholder('Search datasheets').fill('prophet');
  await expect(page.getByRole('button', { name: 'Add Pilgrim Warband' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Rust Prophet' }).click();
  await expect(points).toContainText('75');
  await page.getByPlaceholder('Search datasheets').fill('');
  await page.getByRole('button', { name: 'Add Pilgrim Warband' }).click();
  await expect(points).toContainText('170');
  await page.getByRole('button', { name: 'Add Pilgrim Warband' }).click();
  await expect(points).toContainText('265');
  await openTab(page, 'List');
  await expect(page.locator('[data-testid^="entry-"]')).toHaveCount(3);
  await noHorizontalScroll(page);

  await expect(page.getByText('Choose a warlord')).toBeVisible();
  await page.getByTestId('entry-rust-pilgrims:rust-prophet').click();
  // Selecting a unit shows its details (on phones it switches to the Details tab).
  await details(page).getByLabel('Warlord').check();
  await noHorizontalScroll(page);
  await openTab(page, 'List');
  await expect(page.getByTestId('entry-rust-pilgrims:rust-prophet')).toContainText('WARLORD');
  await expect(page.getByText('Choose a warlord')).toHaveCount(0);
});

test('panes resize, collapse and survive a reload together with the list', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones show one pane at a time');
  await signIn(page);
  await createList(page, `Panes ${Date.now()}`);
  await page.getByRole('button', { name: 'Add Rust Prophet' }).click();
  await expect(page.locator('[data-testid^="entry-"]')).toHaveCount(1);

  const addPane = page.locator('[data-panel-id="pane-add"]');
  const before = (await addPane.boundingBox())?.width ?? 0;
  const handle = page.locator('[data-panel-resize-handle-id]').first();
  const box = await handle.boundingBox();
  if (!box) throw new Error('no handle');
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 200, { steps: 8 });
  await page.mouse.up();
  const after = (await addPane.boundingBox())?.width ?? 0;
  expect(after).toBeGreaterThan(before + 60);

  await page.getByRole('button', { name: 'Collapse Details' }).click();
  await expect(page.getByRole('button', { name: 'Expand Details' })).toBeVisible();
  await page.waitForTimeout(1000); // prefs are saved debounced

  await page.reload();
  await expect(page.locator('[data-testid^="entry-"]')).toHaveCount(1);
  const reloaded = (await addPane.boundingBox())?.width ?? 0;
  expect(Math.abs(reloaded - after)).toBeLessThan(12);
  await expect(page.getByRole('button', { name: 'Expand Details' })).toBeVisible();
});
