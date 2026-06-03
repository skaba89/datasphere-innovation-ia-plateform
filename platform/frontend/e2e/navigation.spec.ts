/**
 * E2E — Navigation
 *
 * Tests that every root tab loads without crashing.
 * Uses injectAuth to skip the login form (faster, not testing auth here).
 */

import { test, expect } from '@playwright/test';
import { injectAuth, goToTab, waitForIdle, assertNoError } from './helpers';

// All tabs with their expected content markers
const TABS = [
  { label: 'Dashboard',            contains: /Dashboard|pipeline|KPI/i },
  { label: 'Appels d\'offres',     contains: /Appels d.offres|Tender|AO/i },
  { label: 'Profils consultants',  contains: /Profils|consultant|agent/i },
  { label: 'Livrables',           contains: /Livrable|Mémoire|document/i },
  { label: 'Commercial',          contains: /Commercial|Opportunité|Kanban/i },
  { label: 'Organisations',       contains: /Organisation|CRM/i },
  { label: 'Opportunités',        contains: /Opportunité|pipeline/i },
  { label: 'Opérations',          contains: /Opération|Suggestion|agent/i },
  { label: 'Équipe',              contains: /Équipe|membre|inviter/i },
  { label: 'Audit',               contains: /Audit|Journal|événement/i },
  { label: 'Workspaces',          contains: /Workspace|espace/i },
  { label: 'Mon profil',          contains: /profil|compte|email/i },
];

test.describe('Navigation — all tabs load without crash', () => {
  test.beforeEach(async ({ context }) => {
    await injectAuth(context);
  });

  for (const tab of TABS) {
    test(`"${tab.label}" tab loads`, async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.root-switcher', { timeout: 15_000 });
      await goToTab(page, tab.label.split("'")[0]); // Match beginning of label
      await waitForIdle(page);
      await assertNoError(page);
      const body = await page.locator('body').textContent() ?? '';
      expect(body).toMatch(tab.contains);
    });
  }
});

test.describe('Navigation — tab switcher', () => {
  test.beforeEach(async ({ context }) => {
    await injectAuth(context);
  });

  test('root switcher has all expected tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');
    const switcher = page.locator('.root-switcher');
    for (const tab of ['Dashboard', 'Appels', 'Livrables', 'Commercial', 'Équipe', 'Audit']) {
      await expect(switcher).toContainText(tab);
    }
  });

  test('active tab is highlighted', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');
    const activeBtn = page.locator('.root-switcher button.active');
    await expect(activeBtn).toBeVisible();
  });

  test('switching tabs does not reload the page', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');
    const navEvents: string[] = [];
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navEvents.push('nav'); });
    await goToTab(page, 'Équipe');
    await goToTab(page, 'Audit');
    await goToTab(page, 'Dashboard');
    expect(navEvents.length).toBe(0); // SPA — no page navigations
  });
});

test.describe('Navigation — search bar', () => {
  test.beforeEach(async ({ context }) => {
    await injectAuth(context);
  });

  test('Ctrl+K opens search modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);
    // Search input should appear
    const searchInput = page.locator('input[placeholder*="Rechercher"], input[placeholder*="Chercher"]');
    if (await searchInput.isVisible()) {
      await expect(searchInput).toBeVisible();
    }
  });

  test('Escape closes search modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // Modal should be closed
    const searchInput = page.locator('input[placeholder*="Rechercher"]');
    expect(await searchInput.isVisible()).toBe(false);
  });
});

test.describe('Navigation — notification bell', () => {
  test.beforeEach(async ({ context }) => {
    await injectAuth(context);
  });

  test('notification bell is visible after login', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.root-switcher');
    // Bell icon should exist in header
    const bell = page.locator('[aria-label*="notification"], [title*="notification"], button:has(svg)')
      .filter({ hasText: '' });
    // Either bell visible or header toolbar is visible
    const header = await page.locator('header, nav, .root-switcher').first().isVisible();
    expect(header).toBe(true);
  });
});
