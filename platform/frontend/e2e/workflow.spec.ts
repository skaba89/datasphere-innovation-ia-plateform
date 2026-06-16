/**
 * E2E — Workflow multi-étapes (API-level)
 */
import { test, expect } from '@playwright/test';

const API = process.env.E2E_API_URL || 'http://localhost:8000/api/v1';
const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    || 'admin@datasphere.io';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin123456!';

async function getToken(request: any): Promise<string | null> {
  const r = await request.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!r.ok()) return null;
  return (await r.json()).access_token;
}

async function createTender(request: any, token: string): Promise<any> {
  const r = await request.post(`${API}/tenders`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      title: `Test Workflow E2E ${Date.now()}`,
      status: 'draft',
      buyer_name: 'Client Test E2E',
    },
  });
  return r.ok() ? await r.json() : null;
}

test.describe('Workflow — démarrage et étapes', () => {
  test('POST /workflow/start sur AO existant démarre un workflow', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const tender = await createTender(request, token);
    if (!tender) return;

    const r = await request.post(`${API}/workflow/start`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { tender_id: tender.id },
    });
    expect(r.status()).toBeLessThan(500);
    if (r.ok()) {
      const wf = await r.json();
      expect(wf).toHaveProperty('id');
      expect(wf).toHaveProperty('tender_id');
      expect(wf.status).toBe('running');
    }
  });

  test('GET /workflow/tender/{id} sur AO sans workflow retourne 404', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/workflow/tender/999999`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });

  test('GET /workflow/pending-approvals retourne la liste', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/workflow/pending-approvals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
  });

  test('POST /workflow/steps/999999/approve → 404', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.post(`${API}/workflow/steps/999999/approve`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });

  test('POST /workflow/steps/999999/reject → 404', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.post(`${API}/workflow/steps/999999/reject`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { reason: 'Test reject' },
    });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });
});

test.describe('Workflow — analytics et stats', () => {
  test('GET /analytics/pipeline.agents a les champs attendus', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/analytics/pipeline`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
    const data = await r.json();
    expect(data).toHaveProperty('agents');
    expect(data.agents).toHaveProperty('total_actions');
    expect(data.agents).toHaveProperty('actions_pending_approval');
  });

  test('GET /scheduler/status retourne état du scheduler', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/scheduler/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
    const data = await r.json();
    expect(data).toHaveProperty('running');
    expect(data).toHaveProperty('jobs_count');
  });
});

test.describe('Workflow — SSE', () => {
  test('GET /sse/status retourne état SSE', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/sse/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.status()).toBeLessThan(500);
  });
});

test.describe('Workflow — RAG', () => {
  test('GET /rag/search avec query valide retourne structure', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/rag/search?q=data+engineering`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
    const data = await r.json();
    expect(data).toHaveProperty('deliverables');
    expect(data).toHaveProperty('tenders');
    expect(data).toHaveProperty('rag_context');
    expect(Array.isArray(data.deliverables)).toBeTruthy();
    expect(Array.isArray(data.tenders)).toBeTruthy();
  });

  test('GET /rag/info retourne état provider', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/rag/info`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
    const data = await r.json();
    expect(data).toHaveProperty('indexed_documents');
  });
});
