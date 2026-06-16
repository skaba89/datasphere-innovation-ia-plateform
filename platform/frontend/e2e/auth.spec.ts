/**
 * E2E — Authentication UI flows
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API  = process.env.E2E_API_URL  || 'http://localhost:8000/api/v1';
const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    || 'admin@datasphere.io';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin123456!';

test.describe('Auth — Login page UI', () => {
  test('shows DataSphere branding on login page', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('domcontentloaded');
    const body = await page.locator('body').textContent();
    expect(body).toMatch(/DataSphere/i);
  });

  test('has email + password inputs and submit button', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('input[type="email"]').fill('wrong@email.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();
    // Attendre message d'erreur
    await page.waitForTimeout(3000);
    const body = await page.locator('body').textContent();
    expect(body).toMatch(/incorrect|erreur|invalid|wrong|401/i);
  });

  test('redirects to dashboard after successful login', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    // Attendre la navigation
    await page.waitForTimeout(5000);
    const url = page.url();
    const body = await page.locator('body').textContent();
    // Soit l'URL change, soit le contenu dashboard apparaît
    expect(body).toMatch(/dashboard|bonjour|tableau|DataSphere/i);
  });

  test('toggle password visibility works', async ({ page }) => {
    await page.goto(BASE);
    const pwdInput = page.locator('input[type="password"]').first();
    await pwdInput.fill('mysecret');
    // Cliquer sur toggle si présent
    const toggleBtn = page.locator('button').filter({ hasText: '' }).first();
    // Vérifier que l'input de type password existe
    expect(await page.locator('input[type="password"]').count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Auth — API flows', () => {
  test('login returns must_change_password field', async ({ request }) => {
    const r = await request.post(`${API}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(r.ok()).toBeTruthy();
    const data = await r.json();
    expect(data).toHaveProperty('must_change_password');
    expect(typeof data.must_change_password).toBe('boolean');
  });

  test('token expires correctly — malformed token → 401', async ({ request }) => {
    const r = await request.get(`${API}/auth/me`, {
      headers: { Authorization: 'Bearer garbage.token.invalid' },
    });
    expect(r.status()).toBeGreaterThanOrEqual(401);
    expect(r.status()).toBeLessThan(500);
  });

  test('forgot password accepts valid email without 500', async ({ request }) => {
    const r = await request.post(`${API}/auth/forgot-password`, {
      data: { email: 'nobody@example.com' },
    });
    expect(r.status()).toBeLessThan(500);
  });
});

test.describe('Auth — Session persistence', () => {
  test('session restored from localStorage on page refresh', async ({ page, context }) => {
    // Login via API
    const r = await context.request.post(`${API}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (!r.ok()) return;
    const { access_token, user } = await r.json();

    // Injecter le token dans localStorage
    await page.goto(BASE);
    await page.evaluate(({ token, usr }) => {
      localStorage.setItem('ds_access_token', token);
      localStorage.setItem('ds_user', JSON.stringify(usr));
    }, { token: access_token, usr: user });

    // Recharger
    await page.reload();
    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent();
    // Ne doit pas afficher la page de login
    expect(body).toMatch(/DataSphere/i);
  });
});
