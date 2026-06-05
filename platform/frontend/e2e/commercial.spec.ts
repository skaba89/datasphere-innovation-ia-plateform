import { expect, test } from '@playwright/test';

const pipelineBoard = [
  {
    status: 'Prospect identifié',
    pipeline_value: 25000,
    items: [
      {
        id: 1,
        title: 'Mission CRM IA',
        org_name: 'DataSphere Client Public',
        priority: 'Haute',
        potential_value: 100000,
        pipeline_value: 25000,
        probability: 25,
        next_action: 'Planifier atelier découverte',
      },
    ],
  },
  {
    status: 'Besoin qualifié',
    pipeline_value: 60000,
    items: [
      {
        id: 2,
        title: 'Plateforme décisionnelle',
        org_name: 'Ministère test',
        priority: 'Normale',
        potential_value: 120000,
        pipeline_value: 60000,
        probability: 50,
        next_action: 'Envoyer proposition',
      },
    ],
  },
  { status: 'Proposition envoyée', pipeline_value: 0, items: [] },
  { status: 'Négociation', pipeline_value: 0, items: [] },
  { status: 'Gagnée', pipeline_value: 0, items: [] },
  { status: 'Perdue', pipeline_value: 0, items: [] },
];

const organizations = [
  { id: 1, name: 'DataSphere Client Public', country: 'Guinee', sector: 'Public' },
  { id: 2, name: 'Ministère test', country: 'Guinee', sector: 'Public' },
];

const contacts = [
  {
    id: 1,
    organization_id: 1,
    first_name: 'Aminata',
    last_name: 'Diallo',
    job_title: 'DSI',
    professional_email: 'aminata.diallo@example.test',
    linkedin_url: 'https://linkedin.com/in/aminata',
    source: 'LinkedIn',
    notes: 'Contact prioritaire',
  },
];

async function mockCommercial(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, email: 'admin@datasphere.test', role: 'admin', is_active: true }),
    });
  });

  await page.route('**/api/v1/opportunities/pipeline/board', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pipelineBoard) });
  });

  await page.route('**/api/v1/opportunities/1/status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, status: 'Besoin qualifié' }) });
  });

  await page.route('**/api/v1/organizations', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(organizations) });
  });

  await page.route('**/api/v1/contacts**', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 2, ...body }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(contacts) });
  });

  await page.route('**/api/v1/contacts/1', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fallback();
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('ds_access_token', 'test-access-token');
    window.localStorage.setItem('ds_refresh_token', 'test-refresh-token');
  });
}

test('admin can view commercial pipeline', async ({ page }) => {
  await mockCommercial(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Commercial' }).click();
  await expect(page.getByRole('heading', { name: 'Pipeline & CRM' })).toBeVisible();
  await expect(page.getByText('Mission CRM IA')).toBeVisible();
  await expect(page.getByText('Plateforme décisionnelle')).toBeVisible();
  await expect(page.getByText(/Pipeline total/i)).toBeVisible();
});

test('admin can move opportunity forward in pipeline', async ({ page }) => {
  await mockCommercial(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Commercial' }).click();
  await page.getByTitle(/Besoin identifié|Besoin qualifié|→/).first().click();
  await expect(page.getByText('Mission CRM IA')).toBeVisible();
});

test('admin can view and search contacts', async ({ page }) => {
  await mockCommercial(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Commercial' }).click();
  await page.getByRole('button', { name: /Contacts CRM/i }).click();
  await expect(page.getByText('Aminata')).toBeVisible();
  await expect(page.getByText('aminata.diallo@example.test')).toBeVisible();

  await page.getByPlaceholder('Rechercher nom, email…').fill('Aminata');
  await expect(page.getByText('Aminata')).toBeVisible();
});

test('admin can add a contact', async ({ page }) => {
  await mockCommercial(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Commercial' }).click();
  await page.getByRole('button', { name: /Contacts CRM/i }).click();
  await page.getByRole('button', { name: /Ajouter un contact/i }).click();
  await page.getByLabel('Prénom').fill('Mamadou');
  await page.getByLabel('Nom').fill('Bah');
  await page.getByLabel('Fonction').fill('Directeur IT');
  await page.getByLabel('Email professionnel').fill('mamadou.bah@example.test');
  await page.getByRole('button', { name: 'Ajouter' }).click();

  await expect(page.getByText('Contacts')).toBeVisible();
});
