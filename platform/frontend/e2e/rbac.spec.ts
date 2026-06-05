import { expect, test } from '@playwright/test';

type Role = 'admin' | 'manager' | 'consultant' | 'auditor' | 'client';

async function loginAsRole(page: import('@playwright/test').Page, role: Role) {
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        email: `${role}@datasphere.test`,
        role,
        first_name: role,
        last_name: 'User',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      }),
    });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('ds_access_token', 'test-access-token');
    window.localStorage.setItem('ds_refresh_token', 'test-refresh-token');
  });
}

test('admin sees all root modules', async ({ page }) => {
  await loginAsRole(page, 'admin');
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Console' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Appels/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Profils/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Livrables' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commercial' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Operations|Opérations/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Equipe|Équipe/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Audit' })).toBeVisible();
});

test('auditor sees audit but not commercial operations team profiles', async ({ page }) => {
  await loginAsRole(page, 'auditor');
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Console' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Appels/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Livrables' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Audit' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Commercial' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Operations|Opérations/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Equipe|Équipe/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Profils/i })).toHaveCount(0);
});

test('client only sees console tenders and deliverables', async ({ page }) => {
  await loginAsRole(page, 'client');
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Console' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Appels/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Livrables' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Audit' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Commercial' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Operations|Opérations/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Equipe|Équipe/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Profils/i })).toHaveCount(0);
});

test('consultant cannot access audit menu', async ({ page }) => {
  await loginAsRole(page, 'consultant');
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Console' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Appels/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Livrables' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commercial' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Operations|Opérations/i })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Audit' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Equipe|Équipe/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Profils/i })).toHaveCount(0);
});
