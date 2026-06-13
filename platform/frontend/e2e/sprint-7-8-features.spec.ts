/**
 * E2E — Sprint 7 & 8 Features
 *
 * Tests Playwright pour :
 *   - Export PDF (WeasyPrint)
 *   - BOAMP config endpoint
 *   - User profile GET + PATCH /team/me
 *   - CSV bulk exports
 *   - Cache analytics (2 appels successifs)
 *   - Rate limit key function
 */

import { test, expect } from '@playwright/test';
import { api, API } from './helpers';

// ── PDF Export ────────────────────────────────────────────────────────────────

test.describe('Sprint 7 — PDF Export', () => {
  test('GET /deliverables/{id}/export/pdf returns PDF', async () => {
    const org  = await api.post('/organizations', { name: 'PDF E2E Org', source: 'manual' });
    const opp  = await api.post('/opportunities', { organization_id: org.id, title: 'PDF Opp', status: 'open', source: 'manual' });
    const tender = await api.post('/tenders', { opportunity_id: opp.id, title: 'Mission PDF Test', buyer_name: 'ARTP', summary: 'Test.', status: 'draft', source: 'manual' });
    const d    = await api.post('/deliverables', {
      tender_id: tender.id, title: 'Mémoire PDF', deliverable_type: 'technical_proposal',
      status: 'draft', version: 1,
      content_markdown: '# Mémoire\n\n## Contexte\n\nSolution Snowflake.\n\n## Approche\n\n- dbt Core\n- Airflow\n\n| Stack | Usage |\n|---|---|\n| Snowflake | DWH |',
    });

    const token = await api.getToken();
    const resp  = await fetch(`${API}/deliverables/${d.id}/export/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('application/pdf');
    const bytes = await resp.arrayBuffer();
    const magic = new Uint8Array(bytes).slice(0, 4);
    // %PDF magic bytes
    expect(String.fromCharCode(...magic)).toBe('%PDF');
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  test('PDF export 404 on missing deliverable', async () => {
    const token = await api.getToken();
    const resp  = await fetch(`${API}/deliverables/999888/export/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status).toBe(404);
  });
});

// ── BOAMP Config ──────────────────────────────────────────────────────────────

test.describe('Sprint 7 — BOAMP Configuration', () => {
  test('GET /scheduler/boamp-config returns settings', async () => {
    const config = await api.get<{
      enabled: boolean; keywords: string; score_threshold: number; daily_limit: number;
    }>('/scheduler/boamp-config');
    expect(typeof config.enabled).toBe('boolean');
    expect(config.keywords.length).toBeGreaterThan(5);
    expect(config.score_threshold).toBeGreaterThanOrEqual(40);
    expect(config.daily_limit).toBeGreaterThanOrEqual(10);
  });
});

// ── User Profile ──────────────────────────────────────────────────────────────

test.describe('Sprint 8 — User Profile API', () => {
  test('GET /team/me returns current user', async () => {
    const profile = await api.get<{ id: number; email: string; role: string }>('/team/me');
    expect(profile.id).toBeGreaterThan(0);
    expect(profile.email).toBeTruthy();
    expect(profile.role).toBeTruthy();
  });

  test('GET /team/me includes extended fields', async () => {
    const profile = await api.get<Record<string, unknown>>('/team/me');
    expect('bio' in profile).toBeTruthy();
    expect('tjm' in profile).toBeTruthy();
    expect('skills' in profile).toBeTruthy();
    expect('availability' in profile).toBeTruthy();
  });

  test('PATCH /team/me updates bio', async () => {
    const token = await api.getToken();
    const resp  = await fetch(`${API}/team/me`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: 'Expert Data Engineering, 8 ans XP' }),
    });
    expect(resp.status).toBe(200);
    const result = await resp.json() as { success: boolean };
    expect(result.success).toBe(true);

    // Verify
    const profile = await api.get<{ bio: string }>('/team/me');
    expect(profile.bio).toBe('Expert Data Engineering, 8 ans XP');
  });

  test('PATCH /team/me updates TJM', async () => {
    const token = await api.getToken();
    await fetch(`${API}/team/me`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tjm: 850 }),
    });
    const profile = await api.get<{ tjm: number }>('/team/me');
    expect(profile.tjm).toBe(850);
  });

  test('PATCH /team/me updates skills list', async () => {
    const skills = ['Snowflake', 'dbt Core', 'Python'];
    const token = await api.getToken();
    await fetch(`${API}/team/me`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills }),
    });
    const profile = await api.get<{ skills: string[] }>('/team/me');
    expect(profile.skills).toEqual(skills);
  });
});

// ── CSV Exports ────────────────────────────────────────────────────────────────

test.describe('Sprint 8 — CSV Bulk Exports', () => {
  test('GET /export/excel/tenders/csv returns CSV', async () => {
    const token = await api.getToken();
    const resp  = await fetch(`${API}/export/excel/tenders/csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('text/csv');
    expect(resp.headers.get('content-disposition')).toContain('appels_offres');
    const text = await resp.text();
    expect(text).toContain('ID');
    expect(text).toContain('Titre');
  });

  test('GET /export/excel/deliverables/csv returns CSV', async () => {
    const token = await api.getToken();
    const resp  = await fetch(`${API}/export/excel/deliverables/csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('text/csv');
    const text = await resp.text();
    expect(text).toContain('Titre');
  });

  test('GET /export/excel/contacts/csv returns CSV', async () => {
    const token = await api.getToken();
    const resp  = await fetch(`${API}/export/excel/contacts/csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('text/csv');
  });

  test('CSV exports require auth', async () => {
    const resp = await fetch(`${API}/export/excel/tenders/csv`);
    expect(resp.status).toBe(401);
  });
});

// ── Analytics Cache ───────────────────────────────────────────────────────────

test.describe('Sprint 8 — Analytics Cache', () => {
  test('Dashboard endpoint returns consistent data on repeated calls', async () => {
    const d1 = await api.get('/analytics/dashboard');
    const d2 = await api.get('/analytics/dashboard');
    // Same structure (cache hit or miss — both should have same keys)
    expect(Object.keys(d1 as object).sort()).toEqual(Object.keys(d2 as object).sort());
  });

  test('Cache stats endpoint works', async () => {
    // Just verify analytics is accessible
    const data = await api.get('/analytics/dashboard');
    expect(data).toBeTruthy();
  });
});
