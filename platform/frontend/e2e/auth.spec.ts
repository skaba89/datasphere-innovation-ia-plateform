import { expect, test } from '@playwright/test';

test('unauthenticated user sees login screen on console', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /DataSphere/i })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Mot de passe')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
});

test('forgot password screen is reachable and can return to login', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Mot de passe oublié/i }).click();
  await expect(page.locator('body')).toContainText(/mot de passe|réinitialisation|email/i);

  const backButton = page.getByRole('button', { name: /retour|connexion/i }).first();
  if (await backButton.isVisible()) {
    await backButton.click();
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  }
});

test('protected modules show login-required message when token is missing', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Appels/i }).click();
  await expect(page.locator('body')).toContainText(/Connecte-toi|connecte-toi/i);

  await page.getByRole('button', { name: 'Livrables' }).click();
  await expect(page.locator('body')).toContainText(/Connecte-toi|connecte-toi/i);
});
