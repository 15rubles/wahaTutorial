import { type Page, expect } from '@playwright/test';
import { resolve } from 'node:path';

export const ROSTERS = resolve(import.meta.dirname, '../fixtures/rosters');

/** Fresh browser state, demo data, and the Rust Pilgrims roster imported. */
export async function importFixtureArmy(page: Page, file = 'rust-pilgrims.ros') {
  await page.goto('/?data=fixture#/import');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('battle-drill.data-source', 'fixture');
  });
  await page.goto('/?data=fixture#/import');
  await page.setInputFiles('[data-testid=roster-file]', resolve(ROSTERS, file));
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
