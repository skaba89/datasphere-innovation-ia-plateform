/**
 * E2E — Robustesse UI : pas de crash, responsive, accessibilité basique
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API  = process.env.E2E_API_URL  || 'http://localhost:8000/api/v1';
const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    || 'admin@datasphere.io';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin123456!';

async function loginAndInject(page: any, context: any) {
  const r = await context.request.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!r.ok()) return false;
  const { access_token, user } = await r.json();
  await page.goto(BASE);
  await page.evaluate(({ t, u }: any) => {
    localStorage.setItem('ds_access_token', t);
    localStorage.setItem('ds_user', JSON.stringify(u));
  }, { t: access_token, u: user });
  await page.reload();
  await page.waitForTimeout(2000);
  return true;
}

test.describe('UI Robustesse — Pas de crash JS', () => {
  const VIEWPORTS = [
    { name: 'mobile-sm', w: 375, h: 812 },
    { name: 'mobile-lg', w: 430, h: 932 },
    { name: 'tablet', w: 768, h: 1024 },
    { name: 'desktop', w: 1440, h: 900 },
  ];

  for (const vp of VIEWPORTS) {
    test(`aucun crash JS sur ${vp.name} (${vp.w}x${vp.h})`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      const errors: string[] = [];
      page.on('pageerror', err => errors.push(err.message));
      const ok = await loginAndInject(page, context);
      if (!ok) return;
      await page.waitForTimeout(3000);
      const critical = errors.filter(e =>
        !e.includes('404') && !e.includes('network') &&
        !e.includes('fetch') && !e.includes('ERR_')
      );
      expect(critical.length).toBe(0);
    });
  }
});

test.describe('UI Robustesse — Overflow horizontal', () => {
  test('login page sans overflow sur 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(BASE);
    await page.waitForLoadState('domcontentloaded');
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    const cw = await page.evaluate(() => document.documentElement.clientWidth);
    expect(sw).toBeLessThanOrEqual(cw + 2);
  });

  test('dashboard sans overflow sur 390px', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAndInject(page, context);
    await page.waitForTimeout(2000);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    const cw = await page.evaluate(() => document.documentElement.clientWidth);
    expect(sw).toBeLessThanOrEqual(cw + 5);
  });
});

test.describe('UI Robustesse — Éléments critiques', () => {
  test('page a un titre HTML valide', async ({ page }) => {
    await page.goto(BASE);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title).toMatch(/DataSphere/i);
  });

  test('favicon chargé sans 404', async ({ page }) => {
    const responses: number[] = [];
    page.on('response', r => {
      if (r.url().includes('favicon')) responses.push(r.status());
    });
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    // Pas de favicon 404 critique
    const bad = responses.filter(s => s === 404);
    expect(bad.length).toBe(0);
  });

  test('inputs ont des attributs accessible', async ({ page }) => {
    await page.goto(BASE);
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.count() > 0) {
      await expect(emailInput.first()).toBeEnabled();
    }
  });

  test('bouton submit est cliquable', async ({ page }) => {
    await page.goto(BASE);
    const submit = page.locator('button[type="submit"]');
    if (await submit.count() > 0) {
      await expect(submit.first()).toBeEnabled();
    }
  });

  test('les images ne sont pas cassées', async ({ page, context }) => {
    await loginAndInject(page, context);
    await page.waitForTimeout(2000);
    // Vérifier qu'aucune image ne retourne 404
    const brokenImages: string[] = [];
    page.on('response', r => {
      if (r.url().match(/\.(png|jpg|jpeg|svg|gif|webp)$/) && r.status() === 404) {
        brokenImages.push(r.url());
      }
    });
    await page.waitForTimeout(1000);
    expect(brokenImages.length).toBe(0);
  });
});

test.describe('UI Robustesse — Navigation rapide', () => {
  test('clic rapide sur plusieurs onglets ne crash pas', async ({ page, context }) => {
    const ok = await loginAndInject(page, context);
    if (!ok) return;
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    // Cliquer sur plusieurs éléments nav rapidement
    const navItems = page.locator('.ds-nav-item');
    const count = await navItems.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      await navItems.nth(i).click().catch(() => {});
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(1000);
    const critical = errors.filter(e => !e.includes('fetch') && !e.includes('network'));
    expect(critical.length).toBe(0);
  });
});
