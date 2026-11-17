import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DATA, importFixtureArmy } from './helpers.js';

test.describe('M10 polish', () => {
  test.beforeEach(async ({ page }) => {
    await importFixtureArmy(page);
  });

  test('quick rules reference works from any page', async ({ page }) => {
    await page.goto(`/?data=${DATA}#/army`);
    await page.getByTestId('quick-ref-open').click();
    await page.getByTestId('quick-ref').getByLabel('Search rules').fill('wound roll');
    await page
      .getByTestId('quick-ref')
      .getByRole('button', { name: /Wound Roll/ })
      .first()
      .click();
    await expect(page.getByTestId('quick-ref')).toContainText('05.02');
  });

  test('what can I do now lists options; keyboard moves a unit', async ({ page }) => {
    await page.goto(`/?data=${DATA}&seed=5#/sandbox`);
    await page.getByTestId('end-phase').click();
    await page.locator('[data-testid="unit-u2"] circle').first().click();
    await page.getByTestId('what-now').click();
    await expect(page.getByTestId('what-now-list')).toContainText('normal move');
    const unit = page.getByTestId('unit-u2');
    await unit.focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('ruler')).toContainText('4.0');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('battle-log')).toContainText(
      'Rustbound Devotees made a normal move',
      { useInnerText: false },
    );
  });

  for (const [name, hash] of [
    ['home', '#/'],
    ['rules', '#/rules/core.attack-sequence.hit-roll'],
    ['army', '#/army'],
    ['sandbox', '#/sandbox'],
    ['lesson', '#/learn/datasheet'],
  ] as const) {
    test(`no serious accessibility problems: ${name}`, async ({ page }) => {
      await page.goto(`/?data=${DATA}${hash}`);
      await page.waitForTimeout(500);
      const results = await new AxeBuilder({ page }).disableRules(['region']).analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(
        serious.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target.join(' ')})`),
      ).toEqual([]);
    });
  }
});
