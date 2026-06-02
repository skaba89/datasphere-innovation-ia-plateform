import { test, expect } from '@playwright/test';
import { loginUI, ADMIN_EMAIL } from './helpers';

test.describe('Authentication', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('DataSphere');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('wrong credentials shows error', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    // Should still be on login page (no Dashboard)
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('successful login reaches dashboard', async ({ page }) => {
    await loginUI(page);
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10_000 });
  });

  test('forgot password link is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Mot de passe oublié')).toBeVisible();
  });

  test('forgot password page renders', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Mot de passe oublié');
    await expect(page.locator('text=Mot de passe oublié')).toBeVisible();
    await expect(page.locator('button[type="submit"], button:has-text("Envoyer")')).toBeVisible();
  });

  test('logout clears session', async ({ page }) => {
    await loginUI(page);
    await page.click('text=Deconnexion');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5_000 });
  });
});
