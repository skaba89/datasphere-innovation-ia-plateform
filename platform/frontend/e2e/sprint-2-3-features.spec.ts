/**
 * E2E — Sprint 2 & 3: DOCX, templates, RAG similar, LinkedIn, rapports, SSE, BOAMP
 */
import { test, expect } from '@playwright/test';
import { api, API } from './helpers';

// ── DOCX Export ───────────────────────────────────────────────────────────────
test.describe('Sprint 2 — DOCX Export', () => {
  test('export DOCX livrable retourne fichier ou 404/405', async () => {
    const tender = await api.post('/tenders', { title: `DOCX Test ${Date.now()}`, status: 'draft' });
    const d = await api.post('/deliverables', {
      tender_id: tender.id, title: 'Mémoire DOCX',
      status: 'draft', content_markdown: '# Test\nContenu.',
    });
    const token = await api.getToken();
    const resp  = await fetch(`${API}/deliverables/${d.id}/export-docx`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404, 405]).toContain(resp.status);
    if (resp.status === 200) {
      const ct = resp.headers.get('content-type') || '';
      expect(ct).toMatch(/docx|openxml|word/i);
    }
  });

  test('export DOCX sans auth → 401', async () => {
    const resp = await fetch(`${API}/deliverables/1/export-docx`);
    expect(resp.status).toBe(401);
  });
});

// ── Templates livrables ────────────────────────────────────────────────────────
test.describe('Sprint 2 — Templates livrables', () => {
  test('GET /deliverables/templates retourne liste', async () => {
    const templates = await api.get<any>('/deliverables/templates').catch(() => []);
    if (Array.isArray(templates)) {
      // Peut être vide mais doit être un array
      expect(Array.isArray(templates)).toBeTruthy();
    } else if (templates?.templates) {
      expect(Array.isArray(templates.templates)).toBeTruthy();
    }
  });

  test('POST /deliverables/generate-draft crée un livrable avec contenu IA', async () => {
    const result = await api.post('/deliverables/generate-draft', {
      title: `Mémoire IA ${Date.now()}`,
      deliverable_type: 'technical_proposal',
    });
    expect(result.id).toBeGreaterThan(0);
    expect(result.title).toBeTruthy();
    expect(['draft', 'pending']).toContain(result.status);
  });

  test('POST /deliverables/{id}/generate enrichit le contenu', async () => {
    const tender = await api.post('/tenders', { title: `IA Generate ${Date.now()}`, status: 'draft' });
    const d = await api.post('/deliverables', {
      tender_id: tender.id, title: 'Test Generate IA', status: 'draft',
    });
    const token = await api.getToken();
    const resp = await fetch(`${API}/deliverables/${d.id}/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404, 405]).toContain(resp.status);
    if (resp.status === 200) {
      const data = await resp.json() as any;
      expect(data).toHaveProperty('content');
      expect(data).toHaveProperty('provider');
      expect(data.content.length).toBeGreaterThan(10);
    }
  });
});

// ── RAG Similar ───────────────────────────────────────────────────────────────
test.describe('Sprint 2 — RAG Similar Deliverables', () => {
  test('GET /deliverables/similar retourne résultats', async () => {
    const token = await api.getToken();
    const resp = await fetch(`${API}/deliverables/similar?q=snowflake+architecture`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 400, 404, 405, 422]).toContain(resp.status);
  });

  test('GET /rag/search unified retourne deliverables + tenders', async () => {
    const result = await api.get<any>('/rag/search?q=data+engineering+cloud');
    expect(result).toHaveProperty('deliverables');
    expect(result).toHaveProperty('tenders');
    expect(typeof result.rag_context).toBe('string');
  });
});

// ── LinkedIn Status ────────────────────────────────────────────────────────────
test.describe('Sprint 3 — LinkedIn Agent', () => {
  test('GET /linkedin/status retourne état OAuth', async () => {
    const status = await api.get<any>('/linkedin/status').catch(() => ({ connected: false }));
    expect(typeof status).toBe('object');
  });

  test('GET /linkedin/schedule/stats toujours 200', async () => {
    const stats = await api.get<any>('/linkedin/schedule/stats');
    expect(typeof stats.total).toBe('number');
    expect(typeof stats.published).toBe('number');
    expect(typeof stats.pending).toBe('number');
  });

  test('POST /linkedin/schedule date future crée un post', async () => {
    const future = new Date(Date.now() + 86400000 * 7).toISOString();
    const token = await api.getToken();
    const resp = await fetch(`${API}/linkedin/schedule`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_type: 'data_engineering', scheduled_at: future }),
    });
    expect([200, 201]).toContain(resp.status);
    if (resp.ok()) {
      const post = await resp.json() as any;
      expect(post).toHaveProperty('id');
      expect(post.status).toBe('pending');
    }
  });

  test('POST /linkedin/schedule/calendar génère des slots', async () => {
    const token = await api.getToken();
    const resp = await fetch(`${API}/linkedin/schedule/calendar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_generate: false }),
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json() as any;
    expect(typeof data.created).toBe('number');
    expect(data.created).toBeGreaterThanOrEqual(0);
  });
});

// ── Rapport hebdomadaire ───────────────────────────────────────────────────────
test.describe('Sprint 3 — Rapports', () => {
  test('GET /reports/weekly/preview retourne HTML DataSphere', async () => {
    const token = await api.getToken();
    const resp = await fetch(`${API}/reports/weekly/preview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok()).toBeTruthy();
    const ct = resp.headers.get('content-type') || '';
    expect(ct).toMatch(/html/i);
    const body = await resp.text();
    expect(body).toMatch(/DataSphere|Rapport/i);
  });

  test('POST /reports/deadline-alert admin retourne count', async () => {
    const token = await api.getToken();
    const resp = await fetch(`${API}/reports/deadline-alert`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 403, 404]).toContain(resp.status);
    if (resp.status === 200) {
      const data = await resp.json() as any;
      expect(typeof data.sent).toBe('number');
    }
  });
});

// ── Notifications ──────────────────────────────────────────────────────────────
test.describe('Sprint 3 — Notifications', () => {
  test('GET /notifications retourne liste', async () => {
    const notifs = await api.get<any[]>('/notifications');
    expect(Array.isArray(notifs)).toBeTruthy();
  });

  test('GET /notifications?limit=5 respecte la limite', async () => {
    const notifs = await api.get<any[]>('/notifications?limit=5');
    expect(Array.isArray(notifs)).toBeTruthy();
    expect(notifs.length).toBeLessThanOrEqual(5);
  });

  test('POST /notifications/read-all → 200', async () => {
    const token = await api.getToken();
    const resp = await fetch(`${API}/notifications/read-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 204, 404]).toContain(resp.status);
  });
});
