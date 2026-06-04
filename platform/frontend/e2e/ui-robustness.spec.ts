import { expect, test } from '@playwright/test';

test('main navigation stays usable on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Console' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Audit' })).toBeVisible();

  const bodyBox = await page.locator('body').boundingBox();
  expect(bodyBox?.width).toBeLessThanOrEqual(390);
});
