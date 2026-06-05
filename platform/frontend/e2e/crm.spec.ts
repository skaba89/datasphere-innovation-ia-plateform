import { expect, test } from '@playwright/test';

type Role = 'admin' | 'manager' | 'consultant' | 'auditor' | 'client';

const organizations = [
  {
    id: 1,
    name: 'DataSphere Client Public',
    country: 'Guinee',
    sector: 'Public',
    organization_type: 'Institution publique',
    website: 'https://example.test',
    description: 'Organisation de test',
    created_at: '2026-01-01T00:00:00Z',
  },
];

const opportunities = [
  {
    id: 1,
    organization_id: 1,
    title: 'Mission Data Gouvernance',
    opportunity_type: 'Mission conseil',
    country: 'Guinee',
    sector: 'Public',
    status: 'Prospect identifie',
    priority: 'Haute',
    probability: 60,
    owner_name: 'Sekouna',
    notes: 'Test E2E',
    created_at: '2026-01-01T00:00:00Z',
  },
];

async function mockSessionAndCrm(page: import('@playwright/test').Page, role: Role = 'admin') {
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, email: `${role}@datasphere.test`, role, is_active: true, created_at: '2026-01-01T00:00:00Z' }),
    });
  });

  await page.route('**/api/v1/organizations', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 2, ...body, created_at: '2026-01-02T00:00:00Z' }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(organizations) });
  });

  await page.route('**/api/v1/opportunities', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 2, ...body, created_at: '2026-01-02T00:00:00Z' }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opportunities) });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('ds_access_token', 'test-access-token');
    window.localStorage.setItem('ds_refresh_token', 'test-refresh-token');
  });
}

test('admin can view organizations and opportunities', async ({ page }) => {
  await mockSessionAndCrm(page, 'admin');
  await page.goto('/');

  await page.getByRole('button', { name: 'Organisations' }).click();
  await expect(page.getByRole('heading', { name: 'Nouvelle organisation' })).toBeVisible();
  await expect(page.getByText('DataSphere Client Public')).toBeVisible();

  await page.getByRole('button', { name: 'Opportunités' }).click();
  await expect(page.getByRole('heading', { name: 'Nouvelle opportunité' })).toBeVisible();
  await expect(page.getByText('Mission Data Gouvernance')).toBeVisible();
});

test('admin can submit organization form without duplicate clicks', async ({ page }) => {
  await mockSessionAndCrm(page, 'admin');
  await page.goto('/');

  await page.getByRole('button', { name: 'Organisations' }).click();
  await page.getByLabel('Nom').fill('Nouvelle Organisation E2E');
  await page.getByLabel('Secteur').fill('Santé');
  await page.getByRole('button', { name: 'Créer organisation' }).click();

  await expect(page.getByText('Organisation créée avec succès.')).toBeVisible();
});

test('admin can submit opportunity form', async ({ page }) => {
  await mockSessionAndCrm(page, 'admin');
  await page.goto('/');

  await page.getByRole('button', { name: 'Opportunités' }).click();
  await page.getByLabel('Organisation').selectOption('1');
  await page.getByLabel('Titre').fill('Nouvelle opportunité E2E');
  await page.getByRole('button', { name: 'Créer opportunité' }).click();

  await expect(page.getByText('Opportunité créée avec succès.')).toBeVisible();
});

test('auditor sees CRM in read-only mode', async ({ page }) => {
  await mockSessionAndCrm(page, 'auditor');
  await page.goto('/');

  await page.getByRole('button', { name: 'Organisations' }).click();
  await expect(page.getByText(/Lecture seule/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nouvelle organisation' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Opportunités' }).click();
  await expect(page.getByText(/Lecture seule/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nouvelle opportunité' })).toHaveCount(0);
});
