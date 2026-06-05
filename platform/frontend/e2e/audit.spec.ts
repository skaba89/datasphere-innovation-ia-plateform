import { expect, test } from '@playwright/test';

type Role = 'admin' | 'manager' | 'consultant' | 'auditor' | 'client';

const auditLogs = [
  {
    id: 1,
    created_at: '2026-01-01T10:00:00Z',
    action: 'create',
    resource_type: 'tender',
    resource_id: 1,
    resource_label: 'Plateforme data ministérielle',
    user_email: 'admin@datasphere.test',
    actor_name: 'Admin User',
    detail: 'Création appel offres',
    status: 'success',
  },
  {
    id: 2,
    created_at: '2026-01-01T11:00:00Z',
    action: 'approve',
    resource_type: 'deliverable',
    resource_id: 2,
    resource_label: 'Mémoire technique',
    user_email: 'manager@datasphere.test',
    actor_name: 'Manager User',
    detail: 'Approbation livrable',
    status: 'success',
  },
];

async function mockSessionAndAudit(page: import('@playwright/test').Page, role: Role = 'auditor') {
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: `${role}@datasphere.test`, role, is_active: true }) });
  });

  await page.route('**/api/v1/audit-logs?**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auditLogs) });
  });

  await page.route('**/api/v1/audit-logs/count?**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: auditLogs.length }) });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('ds_access_token', 'test-access-token');
    window.localStorage.setItem('ds_refresh_token', 'test-refresh-token');
  });
}

test('auditor can access audit logs and see events', async ({ page }) => {
  await mockSessionAndAudit(page, 'auditor');
  await page.goto('/');

  await page.getByRole('button', { name: 'Audit' }).click();
  await expect(page.getByRole('heading', { name: "Journal d'audit" })).toBeVisible();
  await expect(page.getByText('Plateforme data ministérielle')).toBeVisible();
  await expect(page.getByText('Mémoire technique')).toBeVisible();
  await expect(page.getByText('Admin User')).toBeVisible();
});

test('admin can filter audit logs and trigger export', async ({ page }) => {
  await mockSessionAndAudit(page, 'admin');
  await page.goto('/');

  await page.getByRole('button', { name: 'Audit' }).click();
  await page.getByPlaceholder('Rechercher par utilisateur…').fill('admin');
  await page.getByRole('combobox').first().selectOption('create');
  await expect(page.getByText('Plateforme data ministérielle')).toBeVisible();

  const popupPromise = page.waitForEvent('popup').catch(() => null);
  await page.getByRole('button', { name: /Export CSV/i }).click();
  await popupPromise;
});

test('client cannot see audit menu', async ({ page }) => {
  await mockSessionAndAudit(page, 'client');
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Audit' })).toHaveCount(0);
});

test('consultant direct audit access is blocked by page permission', async ({ page }) => {
  await mockSessionAndAudit(page, 'consultant');
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Audit' })).toHaveCount(0);
});
