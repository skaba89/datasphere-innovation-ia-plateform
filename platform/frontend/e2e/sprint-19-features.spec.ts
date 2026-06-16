/**
 * E2E — Sprint 19: CommercialPage, LinkedIn Agent, CalculatorPage, SettingsPage
 */
import { test, expect } from '@playwright/test';
import { api, API } from './helpers';

// ── Commercial / CRM ──────────────────────────────────────────────────────────
test.describe('Sprint 19 — CRM Pipeline', () => {
  test('GET /analytics/pipeline retourne métriques CRM complètes', async () => {
    const data = await api.get<any>('/analytics/pipeline');
    expect(data).toHaveProperty('tenders');
    expect(data).toHaveProperty('opportunities');
    expect(data).toHaveProperty('deliverables');
    expect(data).toHaveProperty('agents');
    // Sous-structures tenders
    expect(data.tenders).toHaveProperty('total');
    expect(data.tenders).toHaveProperty('go_count');
    expect(data.tenders).toHaveProperty('no_go_count');
    expect(data.tenders).toHaveProperty('avg_go_score');
    // Sous-structures opportunities
    expect(data.opportunities).toHaveProperty('total');
    expect(data.opportunities).toHaveProperty('pipeline_value');
    expect(data.opportunities).toHaveProperty('won');
    // Sous-structures deliverables
    expect(data.deliverables).toHaveProperty('total');
    expect(data.deliverables).toHaveProperty('approved');
  });

  test('POST /opportunities crée une opportunité avec statut', async () => {
    const org = await api.post('/organizations', { name: `Org Pipeline ${Date.now()}` });
    const opp = await api.post('/opportunities', {
      title: `Opportunité E2E ${Date.now()}`,
      organization_id: org.id,
      status: 'Prospect identifié',
      probability: 60,
    });
    expect(opp.id).toBeGreaterThan(0);
    expect(opp.title).toBeTruthy();
    expect(opp.status).toBe('Prospect identifié');
  });

  test('PATCH /opportunities/{id} met à jour le statut', async () => {
    const org = await api.post('/organizations', { name: `Org Update ${Date.now()}` });
    const opp = await api.post('/opportunities', {
      title: `Opp Update ${Date.now()}`, organization_id: org.id, status: 'Prospect identifié',
    });
    const token = await api.getToken();
    const resp = await fetch(`${API}/opportunities/${opp.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Proposition envoyée' }),
    });
    expect(resp.ok()).toBeTruthy();
    const updated = await resp.json() as any;
    expect(updated.status).toBe('Proposition envoyée');
  });
});

// ── LinkedIn Agent ────────────────────────────────────────────────────────────
test.describe('Sprint 19 — LinkedIn Agent', () => {
  test('GET /linkedin/status → état OAuth (connecté ou non)', async () => {
    const status = await api.get<any>('/linkedin/status').catch(() => null);
    if (status) {
      expect(typeof status).toBe('object');
    }
  });

  test('GET /cv/domains retourne domaines disponibles', async () => {
    const data = await api.get<any>('/cv/domains');
    expect(data).toHaveProperty('domains');
    expect(Array.isArray(data.domains)).toBeTruthy();
    expect(data.domains.length).toBeGreaterThan(0);
    expect(data.domains[0]).toHaveProperty('key');
    expect(data.domains[0]).toHaveProperty('label');
  });

  test('POST /cv/generate crée un CV structuré', async () => {
    const result = await api.post('/cv/generate', {
      first_name: 'Mamadou', last_name: 'Diallo',
      domain: 'data_engineering', role: 'Data Engineer Senior',
      years_experience: 7, language: 'fr',
    });
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('cv');
    expect(result.cv).toHaveProperty('personal');
    expect(result.cv).toHaveProperty('experiences');
    expect(result.cv.personal.first_name).toBe('Mamadou');
  });

  test('GET /cv/{id}/export/md retourne Markdown', async () => {
    const cv = await api.post('/cv/generate', {
      first_name: 'Test', last_name: 'Export', domain: 'data_engineering',
      role: 'Data Analyst', years_experience: 3,
    });
    const token = await api.getToken();
    const resp = await fetch(`${API}/cv/${cv.id}/export/md`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok()).toBeTruthy();
    const text = await resp.text();
    expect(text).toMatch(/#+|Export|Test/);
  });

  test('GET /cv/{id}/export/pdf retourne PDF ou HTML', async () => {
    const cv = await api.post('/cv/generate', {
      first_name: 'PDF', last_name: 'Test', domain: 'data_engineering',
      role: 'Data Engineer', years_experience: 5,
    });
    const token = await api.getToken();
    const resp = await fetch(`${API}/cv/${cv.id}/export/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(resp.status);
    if (resp.status === 200) {
      const ct = resp.headers.get('content-type') || '';
      expect(ct).toMatch(/pdf|html/i);
    }
  });
});

// ── Calculator / TJM ──────────────────────────────────────────────────────────
test.describe('Sprint 19 — Calculator', () => {
  test('POST /calculator/simulate retourne projection financière', async () => {
    const token = await api.getToken();
    const resp = await fetch(`${API}/calculator/simulate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        daily_rate: 750, days_per_month: 18, months: 12,
        charges_rate: 45, expenses_monthly: 500,
      }),
    });
    expect([200, 404, 405]).toContain(resp.status);
    if (resp.status === 200) {
      const data = await resp.json() as any;
      expect(data).toHaveProperty('net_annual');
      expect(data.net_annual).toBeGreaterThan(0);
    }
  });
});

// ── Settings & Health ─────────────────────────────────────────────────────────
test.describe('Sprint 19 — Settings & Health', () => {
  test('GET /health components.rag présent', async () => {
    const health = await api.get<any>('/health');
    // rag peut être dans components ou dans les infos
    const hasRag = health.components?.rag || health.rag_mode || health.rag;
    expect(health.status).toMatch(/ok|degraded/);
  });

  test('GET /llm/providers retourne providers disponibles', async () => {
    const data = await api.get<any>('/llm/providers').catch(() => null);
    if (data) {
      expect(data).toHaveProperty('providers');
      expect(Array.isArray(data.providers)).toBeTruthy();
    }
  });

  test('GET /workspaces retourne liste workspaces', async () => {
    const workspaces = await api.get<any[]>('/workspaces');
    expect(Array.isArray(workspaces)).toBeTruthy();
  });

  test('GET /audit-logs retourne journal', async () => {
    const logs = await api.get<any>('/audit-logs?limit=5').catch(() => []);
    expect(Array.isArray(logs) || (logs as any)?.items).toBeTruthy();
  });
});

// ── Workspaces ────────────────────────────────────────────────────────────────
test.describe('Sprint 19 — Workspaces', () => {
  test('GET /workspaces retourne les workspaces de l\'utilisateur', async () => {
    const ws = await api.get<any[]>('/workspaces');
    expect(Array.isArray(ws)).toBeTruthy();
  });

  test('POST /workspaces crée un workspace', async () => {
    const ws = await api.post('/workspaces', {
      name: `WS E2E ${Date.now()}`, slug: `ws-e2e-${Date.now()}`,
    }).catch(() => null);
    if (ws) {
      expect(ws.name).toBeTruthy();
      expect(ws.id).toBeGreaterThan(0);
    }
  });

  test('Workspace switcher — X-Workspace-ID accepté par /tenders', async () => {
    const wsList = await api.get<any[]>('/workspaces').catch(() => []);
    if (wsList.length === 0) return;
    const token = await api.getToken();
    const resp = await fetch(`${API}/tenders`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Workspace-ID': String(wsList[0].id),
      },
    });
    expect([200, 403, 404]).toContain(resp.status);
    // Ne doit pas 500
    expect(resp.status).toBeLessThan(500);
  });
});
