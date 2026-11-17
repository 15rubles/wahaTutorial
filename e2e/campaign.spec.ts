import { type Page, expect, test } from '@playwright/test';
import {
  FIXTURE,
  dragUnit,
  endPhasesUntil,
  expectDone,
  expectStep,
  importFixtureArmy,
  next,
  openLesson,
  role,
  roleId,
} from './helpers.js';

/** Every lesson of the campaign, played with the invented Rust Pilgrims army. */
test.describe('M9 campaign', () => {
  let errors: string[] = [];
  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await importFixtureArmy(page);
  });
  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  const move = async (
    page: Page,
    r: string,
    mode: 'move-normal' | 'move-fall-back',
    dy: number,
  ) => {
    await role(page, r).click();
    await page.locator(`[data-tutorial-id="${mode}"]`).click();
    await dragUnit(page, await roleId(page, r), 0, dy);
    await page.getByTestId('confirm-move').click();
  };

  test('1. reading a datasheet', async ({ page }) => {
    await openLesson(page, 'datasheet');
    await next(page);
    await role(page, 'shooter').click();
    await expectStep(page, 3);
    await next(page);
    await next(page);
    if (FIXTURE) {
      await page.getByTestId('unit-card').getByRole('button', { name: 'blast' }).click();
      await expect(page.getByTestId('rule-popup')).toBeVisible();
      await page.getByTestId('rule-popup').getByRole('button', { name: 'Close' }).click();
    }
    await next(page);
    await next(page);
    await role(page, 'character').click();
    await expectDone(page);
  });

  test('2. melee duel', async ({ page }) => {
    await openLesson(page, 'melee');
    await next(page);
    await page.getByTestId('end-phase').click();
    await expectStep(page, 3);
    await role(page, 'character').click();
    await page.getByTestId('fight').first().click();
    await expectStep(page, 4);
    await expect(page.getByTestId('hit-rolls').first()).toBeVisible();
    await next(page);
    await next(page);
    await expectDone(page);
  });

  test('3. shooting', async ({ page }) => {
    await openLesson(page, 'shooting');
    await role(page, 'shooter').click();
    await next(page);
    await page.getByTestId('fire').click();
    await expectStep(page, 4);
    await next(page);
    await next(page);
    await next(page);
    await expectDone(page);
  });

  test('4. movement', async ({ page }) => {
    await openLesson(page, 'movement');
    await role(page, 'fast').click();
    await expectStep(page, 2);
    await move(page, 'fast', 'move-normal', 4);
    await expectStep(page, 3);
    await next(page);
    await move(page, 'melee', 'move-fall-back', -4);
    await expectStep(page, 5);
    await next(page);
    await expectDone(page);
  });

  test('5. charge and the full fight phase', async ({ page }) => {
    await openLesson(page, 'charge');
    await role(page, 'melee').click();
    await page.getByTestId('declare-charge').click();
    await expectStep(page, 3);
    await page.locator('[data-tutorial-id="charge-target"]').click();
    await expectStep(page, 4);
    await page.getByTestId('end-phase').click();
    await expectStep(page, 5);
    await page.getByTestId('end-phase').click();
    await expectStep(page, 6);
    await role(page, 'melee').click();
    await page.getByTestId('fight').first().click();
    await expectStep(page, 7);
    await page.getByTestId('end-phase').click();
    await expectDone(page);
  });

  test('6. command points and stratagems', async ({ page }) => {
    await openLesson(page, 'command');
    await next(page);
    await next(page);
    await page.locator('[data-testid="use-stratagem"]:enabled').first().click();
    await expectStep(page, 4);
    await next(page);
    await expectDone(page);
  });

  test('7. objectives and battle-shock', async ({ page }) => {
    await openLesson(page, 'objectives');
    await next(page);
    await move(page, 'shooter', 'move-normal', 4);
    await expectStep(page, 3);
    await page.getByTestId('end-phase').click();
    await expectStep(page, 4);
    await next(page);
    await next(page);
    await next(page);
    await expectDone(page);
  });

  test('8. army rule, detachment and enhancements', async ({ page }) => {
    await openLesson(page, 'army-rules');
    if (FIXTURE) {
      await expect(page.locator('[data-tutorial-id="army-rule"]')).toContainText('Pilgrim Toll');
      await expect(page.locator('[data-tutorial-id="enhancements"]')).toContainText('taken');
    }
    await next(page);
    await next(page);
    await next(page);
    await role(page, 'character').click();
    await expectDone(page);
  });

  test('9. deployment and a full battle round', async ({ page }) => {
    await openLesson(page, 'battle-round');
    await expect(page.getByTestId('phase')).toHaveText('Deployment');
    await next(page);
    await page.getByTestId('deploy-all').click();
    await page.getByTestId('end-phase').click();
    await expectStep(page, 3);
    await next(page);
    await endPhasesUntil(page, () => page.getByTestId('tutorial-done').isVisible());
    await expectDone(page);
    await expect(page.getByTestId('round')).toHaveText('Round 2');
  });

  test('10. graduation', async ({ page }) => {
    await openLesson(page, 'graduation');
    await next(page);
    await endPhasesUntil(
      page,
      async () => (await page.getByTestId('tutorial-step').textContent()) === 'Step 3 of 3',
      60,
    );
    await expect(page.getByTestId('battle-log')).toContainText('Game over', {
      useInnerText: false,
    });
    await next(page);
    await expectDone(page);
    await page.goto(`/?data=${FIXTURE ? 'fixture' : 'cache'}#/learn`);
    await expect(page.getByTestId('lesson-graduation').locator('..')).toContainText('done');
  });
});
