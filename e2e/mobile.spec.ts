import { test, expect } from '@playwright/test';
import { waitForCatalog } from './helpers';

test('móvil: filtros en panel desplegable y acciones sin hover', async ({ page }) => {
  await page.goto('./#/explore?q=cloud');
  await waitForCatalog(page);
  const card = page.getByTestId('icon-card').first();
  await expect(card.getByTestId('action-favorite')).toBeVisible();
  await page.getByRole('button', { name: /filters|filtros/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('checkbox').first().click();
  await expect(page).toHaveURL(/provider=|category=|style=|feature=|collection=/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
