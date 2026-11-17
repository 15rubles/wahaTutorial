import { expect, test } from '@playwright/test';
import { FIXTURE, dragUnit, endPhase, importFixtureArmy } from './helpers.js';

test('M7: import a roster and play one full turn against the practice dummies', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await importFixtureArmy(page);
  await page.goto('/?data=fixture&seed=42#/sandbox');
  await expect(page.getByTestId('phase')).toHaveText('Command phase');
  await expect(page.getByTestId('round')).toHaveText('Round 1');

  // Command phase -> Movement.
  await endPhase(page);
  await expect(page.getByTestId('phase')).toHaveText('Movement phase');

  // Move the Furnace Walker (u4) 6" forward with a drag, then confirm.
  await page.getByTestId('unit-u4').click();
  await expect(page.getByTestId('unit-card')).toContainText('Furnace Walker');
  await dragUnit(page, 'u4', 0, 6);
  await expect(page.getByTestId('ruler')).toBeVisible();
  await page.getByTestId('confirm-move').click();
  await expect(page.getByTestId('battle-log')).toContainText('Furnace Walker made a normal move', {
    useInnerText: false,
  });

  // Shooting: the walker fires at the dummies if anything is in range.
  await endPhase(page);
  await expect(page.getByTestId('phase')).toHaveText('Shooting phase');
  await page.getByTestId('unit-u4').click();
  const fire = page.getByTestId('fire');
  if (await fire.isEnabled()) {
    await fire.click();
    await expect(page.getByTestId('hit-rolls')).toBeVisible();
  }

  // Tapping a weapon keyword opens its rule from the local (fixture) cache.
  await page.getByTestId('unit-card').getByRole('button', { name: 'blast' }).click();
  await expect(page.getByTestId('rule-popup')).toContainText('BLAST');
  await page.getByTestId('rule-popup').getByRole('button', { name: 'Close' }).click();

  // Charge, fight steps, then the opponent's turn plays out automatically.
  await endPhase(page);
  await expect(page.getByTestId('phase')).toHaveText('Charge phase');
  await endPhase(page);
  await expect(page.getByTestId('phase')).toContainText('Fight phase');
  for (let i = 0; i < 6; i++) {
    const text = await page.getByTestId('phase').textContent();
    if (text === 'Command phase') break;
    await endPhase(page);
  }
  await expect(page.getByTestId('round')).toHaveText('Round 2');
  await expect(page.getByTestId('phase')).toHaveText('Command phase');
  await expect(page.getByTestId('battle-log')).toContainText('Round 1: opponent turn', {
    useInnerText: false,
  });
  expect(errors).toEqual([]);
});

test('the fix-me screen resolves an unknown unit', async ({ page }) => {
  await importFixtureArmy(page, 'broken.txt');
  await expect(page.getByTestId('fixme-entry')).toHaveCount(1);
  await page.getByLabel('Find a datasheet for Totally Unknown Battle Robot').fill('furnace');
  await page.getByRole('button', { name: /Furnace Walker/ }).click();
  await expect(page.getByTestId('fixme')).toHaveCount(0);
  await expect(page.getByTestId('army-units')).toContainText('Furnace Walker');
});

test('leaders are attached on import and can be detached on the army page', async ({ page }) => {
  await importFixtureArmy(page);
  test.skip(!FIXTURE, 'fixture roster only');
  const select = page.getByTestId('attach-select');
  await expect(select).toHaveCount(1);
  await expect(select.locator('option:checked')).toHaveText('Leads Rustbound Devotees');
  await expect(page.getByTestId('army-units')).toContainText('Led by Pilgrim Scrapwarden');
  await page.goto('/?data=fixture#/sandbox');
  await expect(
    page.locator('[data-testid^="unit-"][aria-label*="Pilgrim Scrapwarden + Rustbound Devotees"]'),
  ).toHaveCount(1);
  await page.goto('/?data=fixture#/army');
  await select.selectOption('');
  await expect(page.getByTestId('army-units')).not.toContainText('Led by');
});

test('several detachments within the battle size detachment points', async ({ page }) => {
  await importFixtureArmy(page);
  test.skip(!FIXTURE, 'fixture roster only');
  await expect(page.getByTestId('battle-size')).toHaveValue('incursion');
  // The fixture detachment costs 2 DP for an army with Cinder Lancers (keyword cost).
  await expect(page.getByTestId('dp-used')).toContainText('2 of 2');
  await expect(page.getByTestId('detachment-900000801')).toBeChecked();
  await page.getByTestId('battle-size').selectOption('strike-force');
  await expect(page.getByTestId('dp-used')).toContainText('2 of 3');
  await page.getByTestId('detachment-900000801').uncheck();
  await expect(page.getByTestId('dp-used')).toContainText('0 of 3');
});
