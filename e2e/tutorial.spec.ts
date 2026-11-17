import { expect, test } from '@playwright/test';
import { dragUnit, importFixtureArmy } from './helpers.js';

test('M8: the 3-step demo lesson runs end to end', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await importFixtureArmy(page);
  await page.goto('/?data=fixture#/learn/demo');
  await expect(page.getByTestId('tutorial-step')).toHaveText('Step 1 of 3');

  // The player's own unit is used for the role.
  const shooter = page.locator('[data-testid^="unit-shooter-"]');
  await expect(shooter).toHaveCount(1);
  await expect(page.getByTestId('tutorial-say')).toContainText('Furnace Walker');

  // Clicking something else is blocked and gives a hint.
  await page.getByTestId('end-phase').click({ force: true });
  await expect(page.getByTestId('tutorial-hint')).toBeVisible();
  await expect(page.getByTestId('phase')).toHaveText('Command phase');

  // Step 1: select the unit.
  await shooter.click();
  await expect(page.getByTestId('tutorial-step')).toHaveText('Step 2 of 3');

  // Step 2: end the command phase.
  await page.getByTestId('end-phase').click();
  await expect(page.getByTestId('phase')).toHaveText('Movement phase');
  await expect(page.getByTestId('tutorial-step')).toHaveText('Step 3 of 3');

  // Step 3: normal move by dragging, then confirm.
  const shooterId = (await shooter.getAttribute('data-testid'))!.replace('unit-', '');
  await page.locator('[data-tutorial-id="move-normal"]').click();
  await dragUnit(page, shooterId, 0, 4);
  await page.getByTestId('confirm-move').click();
  await expect(page.getByTestId('tutorial-done')).toBeVisible();

  // Progress is saved.
  const saved = await page.evaluate(() => localStorage.getItem('battle-drill.tutorial'));
  expect(JSON.parse(saved!).completed).toContain('demo');
  expect(errors).toEqual([]);
});
