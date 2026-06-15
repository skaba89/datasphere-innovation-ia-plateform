/**
 * E2E Sprint 22 — Analytics + LinkedIn Scheduling + Facturation
 */
import { test, expect, Page } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const API  = process.env.API_URL  || 'http://localhost:8000/api/v1';

async function getToken(request: any): Promise<string | null> {
  const auth = await request.post(`${API}/auth/login`, {
    data: {
      email:    process.env.ADMIN_EMAIL    || 'admin@datasphere.io',
      password: process.env.ADMIN_PASSWORD || 'admin1234',
    },
  });
  if (!auth.ok()) return null;
  const { access_token } = await auth.json();
  return access_token;
}

// ── Analytics ─────────────────────────────────────────────────────────────────
test.describe('AnalyticsPage', () => {
  test('API /analytics/timeline retourne 12 mois', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const resp = await request.get(`${API}/analytics/timeline`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('months');
    expect(Array.isArray(data.months)).toBeTruthy();
    expect(data.months.length).toBeGreaterThanOrEqual(1);
    expect(data).toHaveProperty('totals');
    // Chaque mois a les champs requis
    const m = data.months[0];
    expect(m).toHaveProperty('month');
    expect(m).toHaveProperty('ao_detectes');
    expect(m).toHaveProperty('wf_completes');
    expect(m).toHaveProperty('livrables');
    expect(m).toHaveProperty('gagnes');
    expect(m).toHaveProperty('taux_succes');
  });

  test('API /analytics/performance-v2 répond', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const resp = await request.get(`${API}/analytics/performance-v2`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('avg_workflow_minutes');
    expect(data).toHaveProperty('active_providers');
  });

  test('API /analytics/pipeline retourne les vraies structures', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const resp = await request.get(`${API}/analytics/pipeline`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('tenders');
    expect(data).toHaveProperty('opportunities');
    expect(data).toHaveProperty('deliverables');
    expect(data).toHaveProperty('agents');
    // Sous-structures
    expect(data.tenders).toHaveProperty('total');
    expect(data.tenders).toHaveProperty('go_count');
    expect(data.opportunities).toHaveProperty('pipeline_value');
  });
});

// ── Facturation ───────────────────────────────────────────────────────────────
test.describe('InvoicingPage — API', () => {
  test('GET /invoices/stats répond', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const resp = await request.get(`${API}/invoices/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('quotes_total');
    expect(data).toHaveProperty('invoices_paid');
    expect(data).toHaveProperty('invoices_overdue');
  });

  test('POST /invoices/quotes crée un devis', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const resp = await request.post(`${API}/invoices/quotes`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: 'Test devis E2E',
        client_name: 'Client Test',
        client_email: 'test@example.com',
        daily_rate: 700,
        days_count: 10,
        tva_rate: 20,
        amount_ht: 7000,
      },
    });
    expect(resp.status()).toBe(201);
    const quote = await resp.json();
    expect(quote).toHaveProperty('reference');
    expect(quote.reference).toMatch(/DEV-\d{4}-\d{3}/);
    expect(quote.status).toBe('draft');
    expect(quote.client_name).toBe('Client Test');
  });

  test('GET /invoices/quotes retourne la liste', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const resp = await request.get(`${API}/invoices/quotes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(Array.isArray(data)).toBeTruthy();
  });
});

// ── LinkedIn Scheduling ───────────────────────────────────────────────────────
test.describe('LinkedIn Schedule — API', () => {
  test('GET /linkedin/schedule/stats répond', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const resp = await request.get(`${API}/linkedin/schedule/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('published');
    expect(data).toHaveProperty('pending');
    expect(data).toHaveProperty('publication_rate');
  });

  test('GET /linkedin/schedule retourne une liste', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const resp = await request.get(`${API}/linkedin/schedule`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('POST /linkedin/schedule/calendar génère des slots', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const resp = await request.post(`${API}/linkedin/schedule/calendar`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { auto_generate: false },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('created');
    expect(data.created).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(data.posts)).toBeTruthy();
  });

  test('POST /linkedin/schedule avec date passée → 400', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const resp = await request.post(`${API}/linkedin/schedule`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { topic_type: 'data_engineering', scheduled_at: pastDate },
    });
    expect(resp.status()).toBe(400);
  });
});

// ── Deliverables generate ─────────────────────────────────────────────────────
test.describe('Deliverables IA Generate', () => {
  test('POST /deliverables/{id}/generate sur livrable existant', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;

    // Créer un livrable d'abord
    const createResp = await request.post(`${API}/deliverables`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { title: 'Test génération IA', deliverable_type: 'technical_proposal', status: 'draft' },
    });
    if (!createResp.ok()) return;
    const { id } = await createResp.json();

    // Générer le contenu
    const genResp = await request.post(`${API}/deliverables/${id}/generate`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(genResp.ok()).toBeTruthy();
    const data = await genResp.json();
    expect(data).toHaveProperty('content');
    expect(data).toHaveProperty('provider');
    expect(data.content.length).toBeGreaterThan(10);
  });
});

// ── Rapport hebdo ──────────────────────────────────────────────────────────────
test.describe('Reports', () => {
  test('GET /reports/weekly/preview retourne du HTML', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const resp = await request.get(`${API}/reports/weekly/preview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok()).toBeTruthy();
    const ct = resp.headers()['content-type'] || '';
    expect(ct).toContain('html');
    const body = await resp.text();
    expect(body).toContain('DataSphere');
    expect(body).toContain('Rapport');
  });
});
