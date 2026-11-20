import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createList, openConfig, openTab, signIn } from './helpers';

/** react-pdf writes page objects uncompressed, so pages can be counted from the bytes. */
function pageCount(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

async function download(page: Page): Promise<Buffer> {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()]);
  return readFileSync((await dl.path()) ?? '');
}

test('export a PDF with all sections, then with sections turned off', async ({ page }) => {
  await signIn(page);
  await createList(page, `Export ${Date.now()}`);
  await openConfig(page);
  await page.getByRole('button', { name: 'Change Detachment' }).click();
  await page.getByLabel(/Pilgrimage of Iron/).check();
  await page.getByRole('button', { name: 'Save detachments' }).click();
  await openTab(page, 'Add');
  await page.getByRole('button', { name: 'Add Rust Prophet' }).click();
  await page.getByRole('button', { name: 'Add Pilgrim Warband' }).click();

  await page.getByRole('button', { name: 'Export PDF' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export PDF' });
  await expect(dialog.getByTestId('page-estimate')).toContainText('pages');
  // Start from the defaults so earlier runs do not matter.
  for (const label of ['Summary', 'Army and detachment rules', 'Unit cards', 'Enhancements', 'Stratagems', 'Phase cheat sheet', 'Keyword glossary']) {
    await dialog.getByRole('checkbox', { name: label, exact: true }).check();
  }
  const full = await download(page);
  expect(full.subarray(0, 4).toString()).toBe('%PDF');
  const fullPages = pageCount(full);
  expect(fullPages).toBeGreaterThanOrEqual(7);

  for (const label of ['Stratagems', 'Phase cheat sheet', 'Keyword glossary']) await dialog.getByRole('checkbox', { name: label, exact: true }).uncheck();
  const small = await download(page);
  expect(pageCount(small)).toBe(fullPages - 3);
});
