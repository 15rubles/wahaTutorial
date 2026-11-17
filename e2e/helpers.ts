import { type Page, expect } from '@playwright/test';
import { resolve } from 'node:path';

export const ROSTERS = resolve(import.meta.dirname, '../fixtures/rosters');

/**
 * Data source for the run. Default: invented fixture data. For a manual smoke test against your own
 * cache: E2E_DATA=cache E2E_ROSTER=/path/to/your.ros npm run e2e (never commit a real roster).
 */
export const DATA = process.env['E2E_DATA'] === 'cache' ? 'cache' : 'fixture';
export const FIXTURE = DATA === 'fixture';
const OWN_ROSTER = process.env['E2E_ROSTER'];

/** Fresh browser state, demo data, and the Rust Pilgrims roster imported. */
export async function importFixtureArmy(page: Page, file = 'rust-pilgrims.ros') {
  await page.goto(`/?data=${DATA}#/import`);
  await page.evaluate((d) => {
    localStorage.clear();
    localStorage.setItem('battle-drill.data-source', d);
  }, DATA);
  await page.goto(`/?data=${DATA}#/import`);
  await page.setInputFiles(
    '[data-testid=roster-file]',
    !FIXTURE && OWN_ROSTER && file === 'rust-pilgrims.ros' ? OWN_ROSTER : resolve(ROSTERS, file),
  );
  await expect(page.getByTestId('army-name')).toBeVisible();
}

/** Drags a unit by `dy` inches straight down the board (positive = towards the opponent). */
export async function dragUnit(page: Page, unitId: string, dx: number, dy: number) {
  const board = page.getByTestId('battlefield');
  const box = (await board.boundingBox())!;
  const pxPerInch = box.width / 45; // viewBox is 45 wide (44" board plus margins)
  const model = page.locator(`[data-testid="unit-${unitId}"] circle`).first();
  const m = (await model.boundingBox())!;
  const x = m.x + m.width / 2;
  const y = m.y + m.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (dx * pxPerInch) / 2, y + (dy * pxPerInch) / 2, { steps: 5 });
  await page.mouse.move(x + dx * pxPerInch, y + dy * pxPerInch, { steps: 5 });
  await page.mouse.up();
}

export async function endPhase(page: Page) {
  await page.getByTestId('end-phase').click();
}

export async function openLesson(page: Page, id: string) {
  await page.goto(`/?data=${DATA}#/learn/${id}`);
  await expect(page.getByTestId('tutorial-box')).toBeVisible();
}

export const role = (page: Page, r: string) =>
  page.locator(`[data-testid^="unit-${r}-"], [data-testid="unit-${r}"]`).first();

export async function roleId(page: Page, r: string): Promise<string> {
  return (await role(page, r).getAttribute('data-testid'))!.replace('unit-', '');
}

export async function next(page: Page) {
  await page.getByTestId('tutorial-next').click();
}

export async function expectStep(page: Page, n: number) {
  await expect(page.getByTestId('tutorial-step')).toHaveText(new RegExp(`^Step ${n} of`));
}

export async function expectDone(page: Page) {
  await expect(page.getByTestId('tutorial-done')).toBeVisible();
}

/** Ends phases until the tutorial step changes or `limit` clicks. */
export async function endPhasesUntil(page: Page, done: () => Promise<boolean>, limit = 40) {
  for (let i = 0; i < limit; i++) {
    if (await done()) return;
    await page.getByTestId('end-phase').click();
  }
}
