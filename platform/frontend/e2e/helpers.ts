/**
 * E2E Test Helpers — shared utilities for Playwright tests
 */
import { Page, expect } from '@playwright/test';

const API = process.env.E2E_API_URL || 'http://localhost:8000/api/v1';
const ADMIN_EMAIL = 'admin@datasphere-innovation.net';
const ADMIN_PASSWORD = 'Admin123456!';

/**
 * Bootstrap the admin user (idempotent — only creates if DB is empty)
 */
export async function bootstrapAdmin(): Promise<void> {
  const res = await fetch(`${API}/auth/bootstrap-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      first_name: 'Admin',
      last_name: 'DataSphere',
      role: 'admin',
      is_active: true,
    }),
  }).catch(() => null);
  // 403 = already bootstrapped, 201 = created — both fine
}

/**
 * Login and return the access token
 */
export async function getToken(): Promise<string> {
  await bootstrapAdmin();
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const data = await res.json();
  return data.access_token as string;
}

/**
 * Login through the UI
 */
export async function loginUI(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for dashboard to appear
  await page.waitForSelector('text=Dashboard', { timeout: 15_000 });
}

/**
 * Navigate to a root tab by label
 */
export async function goToTab(page: Page, label: string): Promise<void> {
  const tab = page.locator('.root-switcher button', { hasText: label });
  await tab.click();
  await page.waitForTimeout(500);
}

export { ADMIN_EMAIL, ADMIN_PASSWORD, API };
