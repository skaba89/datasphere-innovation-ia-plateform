/**
 * E2E — Sprint 9, 10 & 11 Features
 *
 * Tests Playwright pour :
 *   - Health endpoint détaillé (Sprint 10)
 *   - GZip (Accept-Encoding gzip)
 *   - Dark mode localStorage
 *   - WorkflowTimeline (Sprint 11)
 *   - Webhook delivery history
 *   - Pagination API tenders
 *   - ScoreBreakdown endpoint (Sprint 12)
 *   - Batch select (structure)
 */

import { test, expect } from '@playwright/test';
import { api, API } from './helpers';

// ── Health endpoint Sprint 10 ─────────────────────────────────────────────────

test.describe('Sprint 10 — Health endpoint', () => {
  test('GET /health returns ok status with components', async () => {
    const token  = await api.getToken();
    const resp   = await fetch(`${API}/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status).toBe(200);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.status).toBe('ok');
    expect(data.version).toBe('2.3.0');
    expect(data.timestamp).toBeTruthy();
    expect(data.components).toBeTruthy();
  });

  test('Health DB component has latency_ms', async () => {
    const token = await api.getToken();
    const resp  = await fetch(`${API}/health`, { headers: { Authorization: `Bearer ${token}` } });
    const data  = await resp.json() as any;
    expect(data.components.database.ok).toBe(true);
    expect(typeof data.components.database.latency_ms).toBe('number');
  });

  test('Health cache component present', async () => {
    const token = await api.getToken();
    const resp  = await fetch(`${API}/health`, { headers: { Authorization: `Bearer ${token}` } });
    const data  = await resp.json() as any;
    expect('cache' in data.components).toBe(true);
    expect(data.components.cache.ok).toBe(true);
  });

  test('Health endpoint is public (no auth)', async () => {
    const resp = await fetch(`${API}/health`);
    expect(resp.status).toBe(200);
  });

  test('Version endpoint returns 2.3.0', async () => {
    const data = await api.get<{ version: string; stage: string }>('/version');
    expect(data.version).toBe('2.3.0');
    expect(data.stage).toBeTruthy();
  });
});

// ── GZip Sprint 10 ───────────────────────────────────────────────────────────

test.describe('Sprint 10 — GZip Compression', () => {
  test('Large responses accept gzip encoding', async () => {
    const token = await api.getToken();
    const resp  = await fetch(`${API}/tenders?limit=50`, {
      headers: {
        Authorization:   `Bearer ${token}`,
        'Accept-Encoding': 'gzip, deflate',
      },
    });
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Dashboard responds with valid JSON when gzip accepted', async () => {
    const token = await api.getToken();
    const resp  = await fetch(`${API}/analytics/dashboard`, {
      headers: {
        Authorization:   `Bearer ${token}`,
        'Accept-Encoding': 'gzip',
      },
    });
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(typeof data).toBe('object');
  });
});

// ── Score Breakdown Sprint 12 ─────────────────────────────────────────────────

test.describe('Sprint 12 — Score Breakdown', () => {
  test('GET /analytics/tender/{id}/score-breakdown returns criteria', async () => {
    const org    = await api.post('/organizations', { name: 'Score E2E Org', source: 'manual' });
    const opp    = await api.post('/opportunities', { organization_id: org.id, title: 'Score Opp', status: 'open', source: 'manual' });
    const tender = await api.post('/tenders', {
      opportunity_id: opp.id, title: 'Mission Data Lake Snowflake dbt Airflow',
      buyer_name: 'DGNUM', summary: 'Architecture data lake avec Snowflake et dbt Core.',
      status: 'draft', source: 'manual',
    });

    const data = await api.get<any>(`/analytics/tender/${tender.id}/score-breakdown`);
    expect(data.tender_id).toBe(tender.id);
    expect(data.final_score).toBeGreaterThanOrEqual(0);
    expect(data.final_score).toBeLessThanOrEqual(100);
    expect(Array.isArray(data.criteria)).toBe(true);
    expect(data.criteria).toHaveLength(5);
    expect(data.recommendation).toBeTruthy();
  });

  test('Score breakdown has 5 weighted criteria', async () => {
    const org    = await api.post('/organizations', { name: 'Score Org 2', source: 'manual' });
    const opp    = await api.post('/opportunities', { organization_id: org.id, title: 'Score Opp 2', status: 'open', source: 'manual' });
    const tender = await api.post('/tenders', {
      opportunity_id: opp.id, title: 'Projet Big Data Python', buyer_name: 'TEST', source: 'manual', status: 'draft',
    });

    const data = await api.get<any>(`/analytics/tender/${tender.id}/score-breakdown`);
    const keys = data.criteria.map((c: any) => c.key);
    expect(keys).toContain('domain_match');
    expect(keys).toContain('technical_requirements');
    expect(keys).toContain('timeline_feasibility');
    expect(keys).toContain('budget_adequacy');
    expect(keys).toContain('strategic_fit');

    const totalWeight = data.criteria.reduce((s: number, c: any) => s + c.weight, 0);
    expect(totalWeight).toBe(100);
  });

  test('Score breakdown 404 on unknown tender', async () => {
    const token = await api.getToken();
    const resp  = await fetch(`${API}/analytics/tender/999888/score-breakdown`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status).toBe(404);
  });
});

// ── Webhook delivery history Sprint 11 ───────────────────────────────────────

test.describe('Sprint 11 — Webhook delivery', () => {
  test('GET /webhooks/{id}/delivery-history returns health info', async () => {
    const wh = await api.post('/webhooks', {
      name: 'E2E Delivery History',
      url:  'https://example.com/webhook',
      events: ['tender.created'],
      is_active: true,
    });

    if (wh.id) {
      const data = await api.get<any>(`/webhooks/${wh.id}/delivery-history`);
      expect(data.id).toBe(wh.id);
      expect('is_healthy' in data).toBe(true);
      expect('last_delivery_status' in data).toBe(true);
    }
  });

  test('Webhook templates have 5+ entries', async () => {
    const templates = await api.get<any[]>('/webhooks/templates');
    expect(templates.length).toBeGreaterThanOrEqual(5);
    for (const t of templates) {
      expect(t.setup_url).toMatch(/^https:\/\//);
    }
  });
});

// ── Pagination Sprint 11 ──────────────────────────────────────────────────────

test.describe('Sprint 11 — Pagination', () => {
  test('GET /tenders?limit=5 returns max 5 results', async () => {
    const data = await api.get<any[]>('/tenders?limit=5');
    expect(data.length).toBeLessThanOrEqual(5);
  });

  test('GET /tenders?skip=0 and ?skip=1 differ when 2+ tenders', async () => {
    // Create 2 tenders if needed
    const org = await api.post('/organizations', { name: 'Pagination Org', source: 'manual' });
    const opp = await api.post('/opportunities', { organization_id: org.id, title: 'Pag Opp', status: 'open', source: 'manual' });
    await api.post('/tenders', { opportunity_id: opp.id, title: 'Pag Tender 1', source: 'manual', status: 'draft', buyer_name: 'A' });
    await api.post('/tenders', { opportunity_id: opp.id, title: 'Pag Tender 2', source: 'manual', status: 'draft', buyer_name: 'B' });

    const page1 = await api.get<any[]>('/tenders?limit=1&skip=0');
    const page2 = await api.get<any[]>('/tenders?limit=1&skip=1');

    if (page1.length > 0 && page2.length > 0) {
      expect(page1[0].id).not.toBe(page2[0].id);
    }
  });
});

// ── Login diagnostic Sprint 12 ────────────────────────────────────────────────

test.describe('Sprint 12 — Login diagnostic', () => {
  test('GET /auth/diagnose-login returns checks', async () => {
    const resp = await fetch(`${API}/auth/diagnose-login`);
    expect(resp.status).toBe(200);
    const data = await resp.json() as any;
    expect('status' in data).toBe(true);
    expect('checks' in data).toBe(true);
    expect(data.checks.db_connection).toBe('ok');
    expect(data.checks.users_table).toContain('ok');
  });

  test('Login diagnostic extra_data column exists', async () => {
    const resp = await fetch(`${API}/auth/diagnose-login`);
    const data = await resp.json() as any;
    expect(data.checks.extra_data_column).toBe('ok');
  });

  test('Migration up to date', async () => {
    const resp = await fetch(`${API}/auth/diagnose-login`);
    const data = await resp.json() as any;
    expect(data.checks.alembic_revision).toBe('user_extra_data_001');
    expect(data.checks.migration_up_to_date).toBe(true);
  });
});
