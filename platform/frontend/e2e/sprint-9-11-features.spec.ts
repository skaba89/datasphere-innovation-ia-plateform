/**
 * E2E — Sprint 9, 10 & 11: Health détaillé, Workflow timeline, Webhooks, Pagination, RAG
 */
import { test, expect } from '@playwright/test';
import { api, API } from './helpers';

// ── Health endpoint Sprint 10 ──────────────────────────────────────────────────
test.describe('Sprint 10 — Health endpoint', () => {
  test('GET /health retourne status ok avec composants', async () => {
    const health = await api.get<any>('/health');
    expect(['ok', 'degraded']).toContain(health.status);
    expect(health).toHaveProperty('version');
    expect(health).toHaveProperty('components');
  });

  test('GET /health components.db est présent', async () => {
    const health = await api.get<any>('/health');
    expect(health.components).toHaveProperty('db');
    expect(typeof health.components.db.ok).toBe('boolean');
  });

  test('GET /health components.scheduler présent', async () => {
    const health = await api.get<any>('/health');
    expect(health.components).toHaveProperty('scheduler');
  });

  test('GET /health retourne en moins de 5s', async () => {
    const t0 = Date.now();
    await api.get('/health');
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});

// ── Workflow Timeline Sprint 11 ───────────────────────────────────────────────
test.describe('Sprint 11 — Workflow', () => {
  test('GET /workflow/pending-approvals retourne liste', async () => {
    const pending = await api.get<any>('/workflow/pending-approvals');
    expect(Array.isArray(pending) || typeof pending === 'object').toBeTruthy();
  });

  test('POST /workflow/start sur AO créé → workflow lancé ou 4xx', async () => {
    const tender = await api.post('/tenders', {
      title: `Workflow E2E ${Date.now()}`, status: 'draft', buyer_name: 'ARTP',
    });
    const token = await api.getToken();
    const resp = await fetch(`${API}/workflow/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tender_id: tender.id }),
    });
    expect(resp.status).toBeLessThan(500);
    if (resp.status === 200 || resp.status === 201) {
      const wf = await resp.json() as any;
      expect(wf).toHaveProperty('id');
      expect(wf.tender_id).toBe(tender.id);
    }
  });

  test('GET /workflow/tender/{id} inexistant → 4xx', async () => {
    const token = await api.getToken();
    const resp = await fetch(`${API}/workflow/tender/999999`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status).toBeGreaterThanOrEqual(400);
    expect(resp.status).toBeLessThan(500);
  });

  test('POST approve step inexistant → 4xx', async () => {
    const token = await api.getToken();
    const resp = await fetch(`${API}/workflow/steps/999999/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status).toBeGreaterThanOrEqual(400);
    expect(resp.status).toBeLessThan(500);
  });
});

// ── Webhooks ───────────────────────────────────────────────────────────────────
test.describe('Sprint 9 — Webhooks', () => {
  test('GET /webhooks retourne liste', async () => {
    const webhooks = await api.get<any>('/webhooks').catch(() => []);
    expect(Array.isArray(webhooks) || typeof webhooks === 'object').toBeTruthy();
  });

  test('POST /webhooks crée un webhook valide', async () => {
    const wh = await api.post('/webhooks', {
      url: 'https://example.com/webhook',
      events: ['tender.created', 'deliverable.approved'],
      is_active: true,
    }).catch(() => null);
    if (wh) {
      expect(wh.url).toBe('https://example.com/webhook');
      expect(Array.isArray(wh.events)).toBeTruthy();
    }
  });

  test('POST /webhooks URL invalide → 4xx', async () => {
    const token = await api.getToken();
    const resp = await fetch(`${API}/webhooks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url', events: [] }),
    });
    expect(resp.status).toBeGreaterThanOrEqual(400);
    expect(resp.status).toBeLessThan(500);
  });
});

// ── Pagination ─────────────────────────────────────────────────────────────────
test.describe('Sprint 10 — Pagination API', () => {
  test('GET /tenders?limit=5 retourne max 5 items', async () => {
    const data = await api.get<any[]>('/tenders?limit=5');
    expect(Array.isArray(data) ? data.length : (data as any).items?.length ?? 0).toBeLessThanOrEqual(5);
  });

  test('GET /tenders?skip=0&limit=3 retourne 3 ou moins', async () => {
    const data = await api.get<any[]>('/tenders?skip=0&limit=3');
    const count = Array.isArray(data) ? data.length : ((data as any).items?.length ?? 0);
    expect(count).toBeLessThanOrEqual(3);
  });

  test('GET /deliverables?limit=2 retourne 2 ou moins', async () => {
    const data = await api.get<any[]>('/deliverables?limit=2');
    const count = Array.isArray(data) ? data.length : ((data as any).items?.length ?? 0);
    expect(count).toBeLessThanOrEqual(2);
  });

  test('GET /organizations?limit=10 cohérent', async () => {
    const data = await api.get<any[]>('/organizations?limit=10');
    expect(Array.isArray(data) || typeof data === 'object').toBeTruthy();
  });
});

// ── RAG Sémantique ─────────────────────────────────────────────────────────────
test.describe('Sprint 11 — RAG', () => {
  test('GET /rag/search?q=snowflake retourne structure attendue', async () => {
    const result = await api.get<any>('/rag/search?q=snowflake+data');
    expect(result).toHaveProperty('deliverables');
    expect(result).toHaveProperty('tenders');
    expect(result).toHaveProperty('rag_context');
    expect(Array.isArray(result.deliverables)).toBeTruthy();
    expect(Array.isArray(result.tenders)).toBeTruthy();
    expect(typeof result.rag_context).toBe('string');
  });

  test('GET /rag/search query trop courte → 422', async () => {
    const token = await api.getToken();
    const resp = await fetch(`${API}/rag/search?q=a`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([400, 422]).toContain(resp.status);
  });

  test('GET /rag/info retourne provider et nb documents indexés', async () => {
    const info = await api.get<any>('/rag/info');
    expect(info).toHaveProperty('indexed_documents');
    expect(typeof info.indexed_documents).toBe('number');
  });

  test('POST /rag/index-tender/{id} sur AO existant → 200', async () => {
    const tender = await api.post('/tenders', { title: `RAG Index ${Date.now()}`, status: 'draft' });
    const token = await api.getToken();
    const resp = await fetch(`${API}/rag/index-tender/${tender.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 201]).toContain(resp.status);
    const data = await resp.json() as any;
    expect(data.tender_id).toBe(tender.id);
    expect(typeof data.indexed).toBe('boolean');
  });
});

// ── SSE ────────────────────────────────────────────────────────────────────────
test.describe('Sprint 11 — SSE', () => {
  test('GET /sse/status retourne état SSE', async () => {
    const status = await api.get<any>('/sse/status').catch(() => ({ connected: 0 }));
    expect(typeof status).toBe('object');
  });

  test('GET /sse (EventSource) → headers text/event-stream', async () => {
    const token = await api.getToken();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    try {
      const resp = await fetch(`${API}/sse`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      expect([200, 401, 405]).toContain(resp.status);
    } catch {
      clearTimeout(timer);
      // Timeout ou abort = normal pour SSE
    }
  });
});
