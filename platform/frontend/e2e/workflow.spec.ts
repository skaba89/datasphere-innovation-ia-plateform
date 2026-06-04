import { expect, test } from '@playwright/test';

test('business workflow screens are reachable from root navigation', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Appels d offres' }).click();
  await expect(page.getByRole('heading').first()).toBeVisible();

  await page.getByRole('button', { name: 'Commercial' }).click();
  await expect(page.getByRole('heading').first()).toBeVisible();

  await page.getByRole('button', { name: 'Livrables' }).click();
  await expect(page.getByRole('heading').first()).toBeVisible();

  await page.getByRole('button', { name: 'Audit' }).click();
  await expect(page.getByRole('heading').first()).toBeVisible();
});
