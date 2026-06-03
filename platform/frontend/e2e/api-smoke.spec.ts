/**
 * E2E — API Smoke Tests
 *
 * Fast backend health checks that run before the full E2E suite.
 * If these fail, the rest of the tests will also fail.
 *
 * Covers:
 *   - /health endpoint
 *   - Auth bootstrap + login
 *   - All main CRUD endpoints return 2xx (not 500)
 *   - Providers load
 *   - Analytics load
 */

import { test, expect } from '@playwright/test';
import { api, API } from './helpers';

test.describe('API Smoke — Health & Auth', () => {
  test('GET /health returns 200', async () => {
    const res = await fetch(`${API}/health`);
    expect(res.status).toBe(200);
    const data = await res.json() as { status?: string; overall?: string };
    expect(data.status ?? data.overall).toMatch(/ok|healthy|up/i);
  });

  test('GET /version returns version string', async () => {
    const res = await fetch(`${API}/version`);
    expect(res.status).toBe(200);
    const data = await res.json() as { version: string };
    expect(data.version).toBeTruthy();
  });

  test('POST /auth/bootstrap-admin is idempotent', async () => {
    await api.bootstrap();
    const tok = await api.getToken();
    expect(tok).toBeTruthy();
    expect(tok.split('.').length).toBe(3); // JWT format
  });

  test('GET /auth/me returns user profile', async () => {
    const me = await api.get<{ id: number; email: string; role: string }>('/auth/me');
    expect(me.id).toBeGreaterThan(0);
    expect(me.email).toBeTruthy();
    expect(me.role).toBe('admin');
  });
});

test.describe('API Smoke — CRM endpoints', () => {
  test('GET /organizations returns array', async () => {
    const orgs = await api.get<unknown[]>('/organizations');
    expect(Array.isArray(orgs)).toBe(true);
  });

  test('POST /organizations creates org', async () => {
    const org = await api.post<{ id: number; name: string }>('/organizations', {
      name: `[Smoke] Org ${Date.now()}`,
    });
    expect(org.id).toBeGreaterThan(0);
  });

  test('GET /opportunities returns array', async () => {
    const opps = await api.get<unknown[]>('/opportunities');
    expect(Array.isArray(opps)).toBe(true);
  });

  test('GET /contacts returns array', async () => {
    const contacts = await api.get<unknown[]>('/contacts');
    expect(Array.isArray(contacts)).toBe(true);
  });
});

test.describe('API Smoke — Tenders endpoints', () => {
  test('GET /tenders returns array', async () => {
    const tenders = await api.get<unknown[]>('/tenders');
    expect(Array.isArray(tenders)).toBe(true);
  });

  test('GET /agents returns array', async () => {
    const agents = await api.get<unknown[]>('/agents');
    expect(Array.isArray(agents)).toBe(true);
  });

  test('GET /agent-actions returns array', async () => {
    const actions = await api.get<unknown[]>('/agent-actions');
    expect(Array.isArray(actions)).toBe(true);
  });
});

test.describe('API Smoke — Analytics & Providers', () => {
  test('GET /analytics/pipeline returns valid structure', async () => {
    const data = await api.get<{
      opportunities: unknown;
      tenders: unknown;
      deliverables: unknown;
    }>('/analytics/pipeline');
    expect(data.opportunities).toBeDefined();
    expect(data.tenders).toBeDefined();
    expect(data.deliverables).toBeDefined();
  });

  test('GET /analytics/dashboard returns all KPI sections', async () => {
    const data = await api.get<{
      crm: unknown;
      tenders: unknown;
      deliverables: unknown;
      agents: unknown;
    }>('/analytics/dashboard');
    expect(data.crm).toBeDefined();
    expect(data.tenders).toBeDefined();
    expect(data.deliverables).toBeDefined();
    expect(data.agents).toBeDefined();
  });

  test('GET /providers returns 11+ providers', async () => {
    const data = await api.get<{
      providers: { id?: string; name?: string }[];
      summary: unknown;
    }>('/providers');
    expect(data.providers.length).toBeGreaterThanOrEqual(11);
    expect(data.summary).toBeDefined();
  });

  test('GET /providers/recommendations returns structure', async () => {
    const data = await api.get<unknown>('/providers/recommendations');
    expect(data).toBeDefined();
  });
});

test.describe('API Smoke — Deliverables & Notifications', () => {
  test('GET /deliverables returns array', async () => {
    const deliverables = await api.get<unknown[]>('/deliverables');
    expect(Array.isArray(deliverables)).toBe(true);
  });

  test('GET /notifications returns array', async () => {
    const notifs = await api.get<unknown[]>('/notifications');
    expect(Array.isArray(notifs)).toBe(true);
  });

  test('GET /audit-logs returns array', async () => {
    const logs = await api.get<unknown[]>('/audit-logs');
    expect(Array.isArray(logs)).toBe(true);
  });

  test('GET /workspaces returns array', async () => {
    const wss = await api.get<unknown[]>('/workspaces');
    expect(Array.isArray(wss)).toBe(true);
  });
});

test.describe('API Smoke — Export endpoints', () => {
  test('GET /export/excel/pipeline returns 200', async () => {
    const tok = await api.getToken();
    const res = await fetch(`${API}/export/excel/pipeline`, {
      headers: { Authorization: `Bearer ${tok}` }
    });
    expect(res.status).toBe(200);
  });

  test('GET /export/excel/contacts/csv returns CSV', async () => {
    const tok = await api.getToken();
    const res = await fetch(`${API}/export/excel/contacts/csv`, {
      headers: { Authorization: `Bearer ${tok}` }
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/csv/i);
  });

  test('GET /team/roles returns role list', async () => {
    const data = await api.get<{ roles: { key: string }[] }>('/team/roles');
    expect(data.roles.length).toBeGreaterThanOrEqual(4);
    const keys = data.roles.map(r => r.key);
    expect(keys).toContain('admin');
    expect(keys).toContain('viewer');
  });
});
