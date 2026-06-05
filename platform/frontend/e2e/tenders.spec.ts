import { expect, test } from '@playwright/test';

type Role = 'admin' | 'manager' | 'consultant' | 'auditor' | 'client';

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

const tenders = [
  {
    id: 1,
    opportunity_id: 1,
    reference: 'AO-2026-001',
    title: 'Plateforme data ministérielle',
    buyer_name: 'Ministère test',
    source_url: 'https://example.test/ao',
    summary: 'AO de test',
    go_no_go_score: 72,
    go_no_go_decision: 'GO',
    status: 'analysis',
    created_at: '2026-01-01T00:00:00Z',
  },
];

const requirements = [
  {
    id: 1,
    tender_id: 1,
    requirement_code: 'REQ-001',
    section: 'Technique',
    description: 'Architecture cloud sécurisée',
    requirement_type: 'Technique',
    response_strategy: 'Réponse standard',
    proof_or_deliverable: 'Mémoire technique',
    owner_name: 'Sekouna',
    status: 'to_analyze',
    comments: '',
  },
];

const criteria = [
  {
    id: 1,
    tender_id: 1,
    name: 'Capacité technique',
    description: 'Évaluer la capacité technique',
    score: 4,
    weight: 2,
    max_score: 5,
    rationale: 'Bon alignement',
    recommendation: 'go',
  },
];

const compliance = [
  {
    id: 1,
    tender_id: 1,
    requirement_id: 1,
    requirement_code: 'REQ-001',
    requirement_summary: 'Architecture cloud sécurisée',
    compliance_status: 'compliant',
    response_location: 'Mémoire technique section 2',
    evidence: 'Références',
    gap: '',
    action_plan: '',
    owner_name: 'Sekouna',
    comments: '',
  },
];

async function mockSessionAndTenders(page: import('@playwright/test').Page, role: Role = 'admin') {
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, email: `${role}@datasphere.test`, role, is_active: true, created_at: '2026-01-01T00:00:00Z' }),
    });
  });

  await page.route('**/api/v1/opportunities', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opportunities) });
  });

  await page.route('**/api/v1/tenders', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 2, ...body, created_at: '2026-01-02T00:00:00Z' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tenders) });
  });

  await page.route('**/api/v1/tenders/1/requirements', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 2, ...body }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(requirements) });
  });

  await page.route('**/api/v1/tender-governance/tenders/1/go-no-go', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 2, ...body }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(criteria) });
  });

  await page.route('**/api/v1/tender-governance/tenders/1/go-no-go/summary', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total_score: 8, max_score: 10, percentage: 80, recommendation: 'GO' }) });
  });

  await page.route('**/api/v1/tender-governance/tenders/1/compliance', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 2, ...body }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(compliance) });
  });

  await page.route('**/api/v1/tender-governance/tenders/1/compliance/summary', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total_items: 1, compliant_items: 1, compliance_rate: 100 }) });
  });

  await page.route('**/api/v1/files/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('ds_access_token', 'test-access-token');
    window.localStorage.setItem('ds_refresh_token', 'test-refresh-token');
  });
}

test('admin can view tender workspace data', async ({ page }) => {
  await mockSessionAndTenders(page, 'admin');
  await page.goto('/');

  await page.getByRole('button', { name: /Appels/i }).click();
  await expect(page.getByRole('heading', { name: "Appels d'offres" })).toBeVisible();
  await expect(page.getByText('Plateforme data ministérielle')).toBeVisible();
  await expect(page.getByText('Architecture cloud sécurisée')).toBeVisible();
  await expect(page.getByText('Capacité technique')).toBeVisible();
  await expect(page.getByText(/REQ-001/)).toBeVisible();
});

test('admin can create a tender', async ({ page }) => {
  await mockSessionAndTenders(page, 'admin');
  await page.goto('/');

  await page.getByRole('button', { name: /Appels/i }).click();
  await page.getByLabel('Opportunité').selectOption('1');
  await page.getByLabel('Titre').fill('Nouvel AO E2E');
  await page.getByRole('button', { name: "Créer appel d'offres" }).click();

  await expect(page.getByText("Appel d'offres créé avec succès.")).toBeVisible();
});

test('admin can add requirement criterion and compliance item', async ({ page }) => {
  await mockSessionAndTenders(page, 'admin');
  await page.goto('/');

  await page.getByRole('button', { name: /Appels/i }).click();

  await page.getByLabel('Description').first().fill('Nouvelle exigence E2E');
  await page.getByRole('button', { name: 'Ajouter exigence' }).click();
  await expect(page.getByText('Exigence ajoutée.')).toBeVisible();

  await page.getByLabel('Nom').fill('Critère E2E');
  await page.getByRole('button', { name: 'Ajouter critère' }).click();
  await expect(page.getByText('Critère Go / No-Go ajouté.')).toBeVisible();

  await page.getByLabel('Résumé exigence').fill('Conformité E2E');
  await page.getByRole('button', { name: 'Ajouter conformité' }).click();
  await expect(page.getByText('Ligne de conformité ajoutée.')).toBeVisible();
});

test('client sees tender module in read-only mode', async ({ page }) => {
  await mockSessionAndTenders(page, 'client');
  await page.goto('/');

  await page.getByRole('button', { name: /Appels/i }).click();
  await expect(page.getByText(/Lecture seule/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: "Nouvel appel d'offres" })).toHaveCount(0);
  await expect(page.getByRole('button', { name: "Créer appel d'offres" })).toHaveCount(0);
});
