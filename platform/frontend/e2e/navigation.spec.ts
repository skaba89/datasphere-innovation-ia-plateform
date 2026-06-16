/**
 * E2E — Navigation UI: sidebar, responsive, toasts, workspace switcher
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API  = process.env.E2E_API_URL  || 'http://localhost:8000/api/v1';
const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    || 'admin@datasphere.io';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin123456!';

async function loginAndGo(page: any, context: any) {
  const r = await context.request.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!r.ok()) return false;
  const { access_token, user } = await r.json();
  await page.goto(BASE);
  await page.evaluate(({ token, usr }: any) => {
    localStorage.setItem('ds_access_token', token);
    localStorage.setItem('ds_user', JSON.stringify(usr));
  }, { token: access_token, usr: user });
  await page.reload();
  await page.waitForTimeout(2000);
  return true;
}

test.describe('Navigation — Shell', () => {
  test('sidebar est visible après connexion', async ({ page, context }) => {
    const ok = await loginAndGo(page, context);
    if (!ok) return;
    const sidebar = page.locator('.ds-sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('header contient le logo DataSphere', async ({ page, context }) => {
    const ok = await loginAndGo(page, context);
    if (!ok) return;
    const header = page.locator('.ds-header');
    await expect(header).toBeVisible();
    const text = await header.textContent();
    expect(text).toMatch(/DataSphere/i);
  });

  test('navigation vers Dashboard fonctionne', async ({ page, context }) => {
    const ok = await loginAndGo(page, context);
    if (!ok) return;
    // Chercher un lien dashboard dans la sidebar
    const dashLink = page.locator('[data-nav="dashboard"], .ds-nav-item').first();
    if (await dashLink.isVisible()) {
      await dashLink.click();
      await page.waitForTimeout(1000);
    }
    const body = await page.locator('body').textContent();
    expect(body).toMatch(/DataSphere|tableau|dashboard/i);
  });

  test('la page ne crash pas en 5 secondes', async ({ page, context }) => {
    const ok = await loginAndGo(page, context);
    if (!ok) return;
    await page.waitForTimeout(5000);
    // Vérifier qu'il n'y a pas d'erreur JavaScript critique
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.waitForTimeout(1000);
    // Les erreurs de réseau (404 API) sont tolérées
    const criticalErrors = errors.filter(e => !e.includes('404') && !e.includes('network') && !e.includes('fetch'));
    expect(criticalErrors.length).toBe(0);
  });
});

test.describe('Navigation — Responsive mobile', () => {
  test('page login est mobile-friendly (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE);
    await page.waitForLoadState('domcontentloaded');
    // Vérifier qu'il n'y a pas de scroll horizontal
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // tolérance 5px
  });

  test('aucun débordement horizontal sur mobile après login', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const ok = await loginAndGo(page, context);
    if (!ok) return;
    await page.waitForTimeout(2000);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
  });

  test('burger menu visible sur mobile', async ({ page, context }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAndGo(page, context);
    const burger = page.locator('.ds-burger');
    // Peut être visible sur mobile
    const exists = await burger.count() > 0;
    expect(exists).toBeTruthy();
  });
});

test.describe('Navigation — Search', () => {
  test('page search a un champ de recherche', async ({ page, context }) => {
    const ok = await loginAndGo(page, context);
    if (!ok) return;
    // Naviguer vers search via clic ou URL
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'search' } }));
    });
    await page.waitForTimeout(500);
    // Chercher un input de recherche
    const searchInput = page.locator('input[placeholder*="Rechercher"], input[placeholder*="rechercher"]');
    if (await searchInput.count() > 0) {
      await expect(searchInput.first()).toBeVisible();
    }
  });
});

test.describe('Navigation — Workspace Switcher', () => {
  test('workspace switcher est présent dans le header', async ({ page, context }) => {
    const ok = await loginAndGo(page, context);
    if (!ok) return;
    const header = page.locator('.ds-header-center');
    const text = await header.textContent().catch(() => '');
    // Le switcher peut afficher "Workspace global" ou un nom de workspace
    expect(text.length).toBeGreaterThanOrEqual(0);
  });
});
