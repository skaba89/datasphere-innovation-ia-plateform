import { expect, test } from '@playwright/test';

type Role = 'admin' | 'manager' | 'consultant' | 'auditor' | 'client';

const opportunities = [
  { id: 1, title: 'Mission Data Gouvernance', organization_id: 1, status: 'Prospect identifie', priority: 'Haute', probability: 60 },
];

const tenders = [
  { id: 1, title: 'Plateforme data ministérielle', reference: 'AO-2026-001', status: 'analysis' },
];

const deliverables = [
  {
    id: 1,
    title: 'Note de cadrage - Mission Data Gouvernance',
    deliverable_type: 'note_cadrage',
    status: 'draft',
    version: 1,
    audience: 'Direction',
    content_markdown: '# Note de cadrage\n\nContenu de test E2E.',
    generated_by: 'agent',
    reviewed_by: null,
    approved_by: null,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    title: 'Mémoire technique approuvé',
    deliverable_type: 'memoire_technique',
    status: 'approved',
    version: 2,
    audience: 'Client',
    content_markdown: '# Mémoire\n\nDocument validé.',
    generated_by: 'agent',
    reviewed_by: 'Sekouna',
    approved_by: 'Cheickna KABA',
    created_at: '2026-01-02T00:00:00Z',
  },
];

async function mockSessionAndDeliverables(page: import('@playwright/test').Page, role: Role = 'admin') {
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: `${role}@datasphere.test`, role, is_active: true }) });
  });

  await page.route('**/api/v1/deliverables', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(deliverables) });
  });

  await page.route('**/api/v1/opportunities', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opportunities) });
  });

  await page.route('**/api/v1/tenders', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tenders) });
  });

  await page.route('**/api/v1/deliverables/generate-draft', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 3, title: 'Brouillon généré E2E', status: 'draft', version: 1, content_markdown: '# Brouillon', ...body }),
    });
  });

  await page.route('**/api/v1/deliverables/1/review', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...deliverables[0], status: 'in_review', reviewed_by: 'Sekouna' }) });
  });

  await page.route('**/api/v1/deliverables/1/approve', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...deliverables[0], status: 'approved', approved_by: 'Cheickna KABA' }) });
  });

  await page.route('**/api/v1/deliverables/1', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/v1/deliverables/*/versions', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/v1/files/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('ds_access_token', 'test-access-token');
    window.localStorage.setItem('ds_refresh_token', 'test-refresh-token');
  });
}

test('admin can view deliverables library and expand content', async ({ page }) => {
  await mockSessionAndDeliverables(page, 'admin');
  await page.goto('/');

  await page.getByRole('button', { name: 'Livrables' }).click();
  await expect(page.getByRole('heading', { name: 'Bibliothèque de livrables' })).toBeVisible();
  await expect(page.getByText('Note de cadrage - Mission Data Gouvernance')).toBeVisible();

  await page.getByTitle('Voir le détail').first().click();
  await expect(page.getByText('Contenu de test E2E')).toBeVisible();
  await expect(page.getByText('.md')).toBeVisible();
  await expect(page.getByText('PDF')).toBeVisible();
});

test('admin can generate a draft', async ({ page }) => {
  await mockSessionAndDeliverables(page, 'admin');
  await page.goto('/');

  await page.getByRole('button', { name: 'Livrables' }).click();
  await page.getByRole('button', { name: /Générer un brouillon/i }).click();
  await page.getByLabel('Opportunité').selectOption('1');
  await page.getByRole('button', { name: /^Générer$/ }).click();

  await expect(page.getByText(/Brouillon "Brouillon généré E2E" généré avec succès/i)).toBeVisible();
});

test('admin can submit draft for review', async ({ page }) => {
  await mockSessionAndDeliverables(page, 'admin');
  await page.goto('/');

  await page.getByRole('button', { name: 'Livrables' }).click();
  await page.getByTitle('Voir le détail').first().click();
  await page.getByRole('button', { name: /Soumettre en révision/i }).click();

  await expect(page.getByText(/soumis en révision/i)).toBeVisible();
});

test('client sees deliverables in read-only mode', async ({ page }) => {
  await mockSessionAndDeliverables(page, 'client');
  await page.goto('/');

  await page.getByRole('button', { name: 'Livrables' }).click();
  await expect(page.getByText(/Lecture seule/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Générer un brouillon/i })).toHaveCount(0);
  await expect(page.getByText('Note de cadrage - Mission Data Gouvernance')).toBeVisible();
});
