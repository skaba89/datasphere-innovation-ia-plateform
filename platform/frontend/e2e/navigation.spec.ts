import { expect, test } from '@playwright/test';

test('root navigation displays main tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Console' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Livrables' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Audit' })).toBeVisible();
});
