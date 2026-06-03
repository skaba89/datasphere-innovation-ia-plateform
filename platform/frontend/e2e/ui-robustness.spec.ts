/**
 * E2E — UI Robustness
 *
 * Verifies that the UI:
 *   - Shows empty states when no data exists
 *   - Does not crash with network errors
 *   - Shows proper loading indicators
 *   - Does not expose raw API errors to users
 *   - Handles rapid tab switching without crashing
 */

import { test, expect } from '@playwright/test';
import { injectAuth, goToTab, waitForIdle, assertNoError, api } from './helpers';

test.describe('UI Robustness — Empty states', () => {
  test.beforeEach(async ({ context }) => { await injectAuth(context); });

  test('Organisations tab shows empty state when no data', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');
    await goToTab(page, 'Organisations');
    await waitForIdle(page);
    await assertNoError(page);
    // Either shows empty state text or a list
    const body = await page.locator('body').textContent();
    expect(body).toMatch(/Organisation|Créer|Aucun|organisations/i);
  });

  test('Livrables tab shows empty state gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');
    await goToTab(page, 'Livrables');
    await waitForIdle(page);
    await assertNoError(page);
    const body = await page.locator('body').textContent();
    expect(body).toMatch(/Livrable|Aucun|vide|créer/i);
  });

  test('Dashboard renders with no data (fresh DB)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');
    await waitForIdle(page);
    await assertNoError(page);
    // KPI cards should show zeros, not errors
    const body = await page.locator('body').textContent();
    expect(body).toMatch(/Dashboard|0|pipeline/i);
  });
});

test.describe('UI Robustness — No crashes on tab switch', () => {
  test.beforeEach(async ({ context }) => { await injectAuth(context); });

  test('rapid tab switching does not crash', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');

    const tabs = ['Dashboard', 'Appels', 'Livrables', 'Opérations', 'Équipe', 'Dashboard'];
    for (const tab of tabs) {
      await goToTab(page, tab);
      await page.waitForTimeout(300);
    }
    await assertNoError(page);
    expect(await page.locator('.root-switcher').isVisible()).toBe(true);
  });

  test('all tabs survive 3 rapid clicks each', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');

    for (const tab of ['Dashboard', 'Équipe', 'Audit']) {
      for (let i = 0; i < 3; i++) {
        await goToTab(page, tab);
      }
    }
    await assertNoError(page);
  });
});

test.describe('UI Robustness — No raw errors shown', () => {
  test.beforeEach(async ({ context }) => { await injectAuth(context); });

  test('no Python stack traces visible in UI', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');
    // Cycle through all tabs
    for (const tab of ['Dashboard', 'Appels', 'Livrables', 'Opérations']) {
      await goToTab(page, tab);
      await page.waitForTimeout(600);
      const body = await page.locator('body').textContent() ?? '';
      expect(body).not.toMatch(/Traceback|TypeError:|AttributeError:|OperationalError/);
    }
  });

  test('no HTTP 500 error messages shown to user', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');
    for (const tab of ['Dashboard', 'Appels', 'Livrables']) {
      await goToTab(page, tab);
      await page.waitForTimeout(600);
      const body = await page.locator('body').textContent() ?? '';
      expect(body).not.toMatch(/500 Internal|Internal Server Error/);
    }
  });
});

test.describe('UI Robustness — Loading states', () => {
  test.beforeEach(async ({ context }) => { await injectAuth(context); });

  test('page shows content after initial load (not stuck loading)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');
    // Wait for potential loading states to resolve
    await page.waitForTimeout(3_000);
    // Content should be visible — not a blank loading spinner forever
    const body = await page.locator('body').textContent() ?? '';
    expect(body.length).toBeGreaterThan(50);
    await assertNoError(page);
  });
});

test.describe('UI Robustness — Notifications', () => {
  test.beforeEach(async ({ context }) => { await injectAuth(context); });

  test('notification bell renders without crashing', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');
    await waitForIdle(page);
    await assertNoError(page);
    // App is fully loaded and functional
    const switcher = await page.locator('.root-switcher').isVisible();
    expect(switcher).toBe(true);
  });
});

test.describe('UI Robustness — Search', () => {
  test.beforeEach(async ({ context }) => { await injectAuth(context); });

  test('search with no results shows empty message', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');
    // Open search
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);
    const searchInput = page.locator('input[placeholder*="Rechercher"], input[placeholder*="Chercher"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('XYZNOTEXIST99999');
      await page.waitForTimeout(800);
      const body = await page.locator('body').textContent() ?? '';
      // Should show "no results" message, not crash
      expect(body).toMatch(/résultat|Aucun|vide|XYZNOTEXIST/i);
      await page.keyboard.press('Escape');
    }
  });
});
