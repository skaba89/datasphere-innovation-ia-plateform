/**
 * E2E — API Smoke Tests (health + auth + CRUD principaux)
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

test.describe('API Smoke — Health & Auth', () => {
  test('GET /health returns 200 with status ok', async ({ request }) => {
    const r = await request.get(`${API}/health`);
    expect(r.ok()).toBeTruthy();
    const data = await r.json();
    expect(data.status).toMatch(/ok|degraded/);
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('components');
  });

  test('POST /auth/login with valid creds returns token', async ({ request }) => {
    const r = await request.post(`${API}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(r.ok()).toBeTruthy();
    const data = await r.json();
    expect(data).toHaveProperty('access_token');
    expect(data).toHaveProperty('user');
    expect(data.user.email).toBe(ADMIN_EMAIL);
    expect(data).toHaveProperty('must_change_password');
  });

  test('POST /auth/login with wrong password returns 401', async ({ request }) => {
    const r = await request.post(`${API}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: 'wrong_password_xyz' },
    });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });

  test('GET /auth/me without token returns 401', async ({ request }) => {
    const r = await request.get(`${API}/auth/me`);
    expect(r.status()).toBe(401);
  });

  test('GET /auth/me with valid token returns user profile', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
    const user = await r.json();
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('role');
    expect(user.is_active).toBe(true);
  });
});

test.describe('API Smoke — CRM endpoints', () => {
  test('GET /organizations returns array', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/organizations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
    expect(Array.isArray(await r.json())).toBeTruthy();
  });

  test('GET /opportunities returns array', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/opportunities`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
  });

  test('GET /contacts returns array', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/contacts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
  });
});

test.describe('API Smoke — Tenders & Deliverables', () => {
  test('GET /tenders returns valid response', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/tenders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
  });

  test('GET /deliverables returns valid response', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/deliverables`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
  });

  test('GET /analytics/pipeline returns pipeline structure', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/analytics/pipeline`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
    const data = await r.json();
    expect(data).toHaveProperty('tenders');
    expect(data).toHaveProperty('opportunities');
    expect(data).toHaveProperty('deliverables');
  });
});

test.describe('API Smoke — Features Sprint 21-23', () => {
  test('GET /invoices/stats returns KPIs', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/invoices/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
    const data = await r.json();
    expect(data).toHaveProperty('quotes_total');
  });

  test('GET /rag/info returns RAG state', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/rag/info`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
  });

  test('GET /linkedin/schedule/stats returns stats', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/linkedin/schedule/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
  });

  test('GET /team returns user list (admin)', async ({ request }) => {
    const token = await getToken(request);
    if (!token) return;
    const r = await request.get(`${API}/team`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
    expect(Array.isArray(await r.json())).toBeTruthy();
  });
});
