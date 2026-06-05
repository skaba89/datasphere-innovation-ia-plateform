import { expect, test } from '@playwright/test';

const schedulerStatus = {
  running: true,
  timezone: 'Europe/Paris',
  pending_approvals_count: 1,
  jobs: [
    {
      id: 'auto_execute',
      name: 'auto_execute',
      next_run_time: '2026-01-01T08:00:00Z',
    },
    {
      id: 'daily_report',
      name: 'daily_report',
      next_run_time: '2026-01-01T09:00:00Z',
    },
  ],
};

const schedulerLogs = [
  {
    id: 1,
    job_id: 'auto_execute',
    status: 'success',
    items_processed: 3,
    duration_ms: 850,
    started_at: '2026-01-01T07:00:00Z',
  },
];

const pendingApprovals = [
  {
    id: 1,
    assignment_id: 10,
    action_type: 'document_generation',
    title: 'Générer mémoire technique',
    description: 'Action sensible nécessitant une validation humaine.',
    status: 'requires_human_approval',
    priority: 'Haute',
    created_at: '2026-01-01T07:30:00Z',
  },
];

async function mockOperations(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, email: 'admin@datasphere.test', role: 'admin', is_active: true }),
    });
  });

  await page.route('**/api/v1/scheduler/status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(schedulerStatus) });
  });

  await page.route('**/api/v1/scheduler/logs?**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(schedulerLogs) });
  });

  await page.route('**/api/v1/scheduler/jobs/auto_execute/trigger', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.route('**/api/v1/scheduler/pause', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ running: false }) });
  });

  await page.route('**/api/v1/agent-actions/pending-approvals', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pendingApprovals) });
  });

  await page.route('**/api/v1/agent-actions/1/approve?**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...pendingApprovals[0], status: 'approved' }) });
  });

  await page.route('**/api/v1/export/excel/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: 'mock-xlsx' });
  });

  await page.route('**/api/v1/health**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', database: 'ok', scheduler: 'ok' }) });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('ds_access_token', 'test-access-token');
    window.localStorage.setItem('ds_refresh_token', 'test-refresh-token');
  });
}

test('admin can view pending approvals and approve an action', async ({ page }) => {
  await mockOperations(page);
  await page.goto('/');

  await page.getByRole('button', { name: /Operations|Opérations/i }).click();
  await expect(page.getByRole('heading', { name: 'Pipeline autonome' })).toBeVisible();
  await expect(page.getByText('Générer mémoire technique')).toBeVisible();

  await page.getByPlaceholder('Votre nom (ex. Sekouna)').fill('Cheickna KABA');
  await page.getByRole('button', { name: 'Approuver' }).click();
  await expect(page.getByText(/Approuvé|En cours/i)).toBeVisible();
});

test('admin can view scheduler status and trigger a job', async ({ page }) => {
  await mockOperations(page);
  await page.goto('/');

  await page.getByRole('button', { name: /Operations|Opérations/i }).click();
  await page.getByRole('button', { name: /Scheduler/i }).click();

  await expect(page.getByText('Scheduler autonome')).toBeVisible();
  await expect(page.getByText('Exécution automatique')).toBeVisible();
  await expect(page.getByText('Rapport journalier')).toBeVisible();

  await page.getByRole('button', { name: 'Déclencher' }).first().click();
  await expect(page.getByText(/Lancé|Déclencher/i)).toBeVisible();
});

test('admin can expand scheduler execution history', async ({ page }) => {
  await mockOperations(page);
  await page.goto('/');

  await page.getByRole('button', { name: /Operations|Opérations/i }).click();
  await page.getByRole('button', { name: /Scheduler/i }).click();
  await page.getByRole('button', { name: /Historique d'exécution/i }).click();

  await expect(page.getByText('auto_execute')).toBeVisible();
  await expect(page.getByText('success')).toBeVisible();
});

test('admin can open exports panel', async ({ page }) => {
  await mockOperations(page);
  await page.goto('/');

  await page.getByRole('button', { name: /Operations|Opérations/i }).click();
  await page.getByRole('button', { name: /Exports Excel/i }).click();

  await expect(page.getByText('Pipeline commercial')).toBeVisible();
  await expect(page.getByText("Appels d'offres")).toBeVisible();
  await expect(page.getByText('Rapport complet (multi-onglets)')).toBeVisible();
  await expect(page.getByText('.xlsx').first()).toBeVisible();
});
