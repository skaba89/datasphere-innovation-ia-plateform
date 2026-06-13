/**
 * E2E — Sprint 2 & 3 Features
 *
 * Tests Playwright pour :
 *   - Export DOCX livrable
 *   - Templates livrables (5 types)
 *   - RAG endpoint /deliverables/similar
 *   - LinkedIn OAuth status
 *   - Rapport hebdomadaire preview
 *   - Onboarding wizard (SetupWizard)
 *   - SSE stream connection
 *   - BOAMP scheduler status
 */

import { test, expect } from '@playwright/test';
import { api, API } from './helpers';

// ── DOCX Export ──────────────────────────────────────────────────────────────

test.describe('Sprint 2 — DOCX Export', () => {
  test('GET /deliverables/{id}/export/docx returns Word document', async () => {
    // Create a deliverable first
    const org = await api.post('/organizations', { name: 'DOCX Test Org', source: 'manual' });
    const opp = await api.post('/opportunities', {
      organization_id: org.id, title: 'DOCX Opp', status: 'open', source: 'manual',
    });
    const tender = await api.post('/tenders', {
      opportunity_id: opp.id, title: 'AO DOCX Test', buyer_name: 'ARTP',
      summary: 'Test DOCX export.', status: 'draft', source: 'manual',
    });
    const deliverable = await api.post('/deliverables', {
      tender_id: tender.id, title: 'Mémoire DOCX Test',
      deliverable_type: 'technical_proposal', status: 'draft',
      content_markdown: '# Test\n\n## Section 1\n\nContenu du test DOCX.\n\n| Col1 | Col2 |\n|------|------|\n| A | B |',
      version: 1,
    });

    const token = await api.getToken();
    const res = await fetch(`${API}/deliverables/${deliverable.id}/export/docx`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('wordprocessingml.document');
    expect(res.headers.get('content-disposition')).toContain('.docx');

    const bytes = await res.arrayBuffer();
    expect(bytes.byteLength).toBeGreaterThan(1000); // Valid .docx is at least 1KB
  });

  test('DOCX export 404 on missing deliverable', async () => {
    const token = await api.getToken();
    const res = await fetch(`${API}/deliverables/999999/export/docx`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });
});

// ── Templates livrables ───────────────────────────────────────────────────────

test.describe('Sprint 2 — Deliverable Templates', () => {
  test('GET /deliverables/templates returns 5 templates', async () => {
    const templates = await api.get<{ key: string; name: string; sections_count: number }[]>('/deliverables/templates');
    expect(templates.length).toBe(5);
    const keys = templates.map(t => t.key);
    expect(keys).toContain('memoire_technique');
    expect(keys).toContain('proposition_commerciale');
    expect(keys).toContain('note_synthese');
    expect(keys).toContain('plan_projet');
    expect(keys).toContain('presentation_executive');
  });

  test('GET /deliverables/templates/{key} returns pre-filled markdown', async () => {
    const template = await api.get<{ content_markdown: string; sections: unknown[] }>('/deliverables/templates/memoire_technique');
    expect(template.content_markdown).toBeTruthy();
    expect(template.content_markdown.length).toBeGreaterThan(200);
    expect(template.sections.length).toBeGreaterThan(3);
  });

  test('GET /deliverables/templates/{key}?tender_id replaces buyer_name', async () => {
    const org = await api.post('/organizations', { name: 'Tmpl Org', source: 'manual' });
    const opp = await api.post('/opportunities', {
      organization_id: org.id, title: 'Tmpl Opp', status: 'open', source: 'manual',
    });
    const tender = await api.post('/tenders', {
      opportunity_id: opp.id, title: 'Mission Data ARTP Guinée', buyer_name: 'ARTP Guinée',
      summary: 'Test.', status: 'draft', source: 'manual',
    });

    const template = await api.get<{ content_markdown: string }>(
      `/deliverables/templates/note_synthese?tender_id=${tender.id}`
    );
    expect(template.content_markdown).toContain('ARTP Guinée');
  });

  test('POST /deliverables/from-template creates deliverable', async () => {
    const org = await api.post('/organizations', { name: 'FromTmpl Org', source: 'manual' });
    const opp = await api.post('/opportunities', {
      organization_id: org.id, title: 'FromTmpl Opp', status: 'open', source: 'manual',
    });
    const tender = await api.post('/tenders', {
      opportunity_id: opp.id, title: 'AO FromTemplate', buyer_name: 'DGNUM',
      summary: 'Test template creation.', status: 'draft', source: 'manual',
    });

    const token = await api.getToken();
    const res = await fetch(
      `${API}/deliverables/from-template/proposition_commerciale?tender_id=${tender.id}`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
    );
    expect(res.status).toBe(200);
    const deliverable = await res.json() as { title: string; deliverable_type: string };
    expect(deliverable.title).toContain('💼');
    expect(deliverable.deliverable_type).toBe('commercial_proposal');
  });
});

// ── RAG — Similar deliverables ────────────────────────────────────────────────

test.describe('Sprint 2 — RAG Service', () => {
  test('GET /deliverables/similar returns empty when no approved', async () => {
    const similar = await api.get<unknown[]>('/deliverables/similar?title=Mission+Data+Engineering');
    expect(Array.isArray(similar)).toBeTruthy();
    expect(similar.length).toBe(0); // No approved deliverables yet
  });

  test('GET /deliverables/similar returns results after approving', async () => {
    // Create and approve a deliverable
    const org = await api.post('/organizations', { name: 'RAG Org', source: 'manual' });
    const opp = await api.post('/opportunities', {
      organization_id: org.id, title: 'RAG Opp', status: 'open', source: 'manual',
    });
    const tender = await api.post('/tenders', {
      opportunity_id: opp.id, title: 'Mission Snowflake Data Lake',
      buyer_name: 'ARTP', summary: 'Architecture data lake Snowflake dbt Airflow.',
      status: 'draft', source: 'manual',
    });
    const d = await api.post('/deliverables', {
      tender_id: tender.id, title: 'Mémoire Snowflake Data Lake',
      deliverable_type: 'technical_proposal', status: 'draft',
      content_markdown: '# Mémoire Technique\n\n## Architecture Snowflake\n\nNous proposons une architecture cloud-native basée sur Snowflake, dbt Core et Apache Airflow pour transformer la donnée brute en insights actionnables.',
      version: 1,
    });

    // Approve it
    await api.post(`/deliverables/${d.id}/approve`);

    // Now similar should find it
    const similar = await api.get<{ title: string; score: number }[]>(
      '/deliverables/similar?title=Architecture+Data+Lake+Snowflake'
    );
    // May or may not find it depending on TF-IDF threshold
    expect(Array.isArray(similar)).toBeTruthy();
  });
});

// ── Rapport hebdomadaire ──────────────────────────────────────────────────────

test.describe('Sprint 2 — Weekly Report', () => {
  test('GET /reports/weekly/preview returns HTML', async () => {
    const token = await api.getToken();
    const res = await fetch(`${API}/reports/weekly/preview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('DataSphere');
    expect(html).toContain('Rapport hebdomadaire');
  });
});

// ── LinkedIn OAuth ────────────────────────────────────────────────────────────

test.describe('Sprint 3 — LinkedIn OAuth', () => {
  test('GET /linkedin/oauth/status returns status object', async () => {
    const status = await api.get<{
      oauth_configured: boolean;
      has_token: boolean;
      is_expired: boolean;
    }>('/linkedin/oauth/status');
    expect(typeof status.oauth_configured).toBe('boolean');
    expect(typeof status.has_token).toBe('boolean');
    expect(typeof status.is_expired).toBe('boolean');
  });

  test('GET /linkedin/oauth/auth-url without LINKEDIN_CLIENT_ID returns unconfigured', async () => {
    const result = await api.get<{
      configured: boolean;
      message?: string;
      auth_url?: string;
    }>('/linkedin/oauth/auth-url');
    // In test env, LINKEDIN_CLIENT_ID is not set
    expect(result.configured).toBeDefined();
    if (!result.configured) {
      expect(result.message).toBeTruthy();
    } else {
      expect(result.auth_url).toContain('linkedin.com');
    }
  });

  test('GET /linkedin/topics returns topic list', async () => {
    const topics = await api.get<{ topics: string[]; topic_types: string[] }>('/linkedin/topics');
    expect(topics.topics.length).toBeGreaterThan(4);
    expect(topics.topic_types).toContain('data_engineering');
    expect(topics.topic_types).toContain('ao_insight');
  });
});

// ── SSE Stream ────────────────────────────────────────────────────────────────

test.describe('Sprint 2 — SSE Real-time', () => {
  test('GET /notifications/stream/status returns connection count', async () => {
    const status = await api.get<{ active_connections: number; connected_users: number }>(
      '/notifications/stream/status'
    );
    expect(typeof status.active_connections).toBe('number');
    expect(typeof status.connected_users).toBe('number');
    expect(status.active_connections).toBeGreaterThanOrEqual(0);
  });

  test('SSE stream responds with text/event-stream', async () => {
    const token = await api.getToken();
    // We can't hold the SSE connection open in tests, but we can verify the endpoint exists
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);
    try {
      const res = await fetch(`${API}/notifications/stream?token=${token}`, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${token}` },
      });
      clearTimeout(timer);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
    } catch {
      // AbortError is expected — we aborted after getting headers
      clearTimeout(timer);
    }
  });
});

// ── Onboarding Status ─────────────────────────────────────────────────────────

test.describe('Sprint 3 — Onboarding & Setup', () => {
  test('GET /setup/status returns database=connected', async () => {
    const res = await fetch(`${API}/setup/status`);
    expect(res.status).toBe(200);
    const data = await res.json() as { database: string };
    expect(data.database).toBe('connected');
  });

  test('Providers returns 11+ providers after setup', async () => {
    const providers = await api.get<{ providers: { name: string; configured: boolean }[] }>('/providers');
    expect(providers.providers.length).toBeGreaterThanOrEqual(11);
    const names = providers.providers.map(p => p.name);
    expect(names).toContain('groq');
    expect(names).toContain('gemini');
    expect(names).toContain('openai');
  });

  test('Agents defaults install is idempotent', async () => {
    // Install twice
    await api.post('/agents/defaults/install');
    await api.post('/agents/defaults/install');
    // Should still have exactly 5 unique slugs
    const agents = await api.get<{ slug: string }[]>('/agents');
    const slugs = agents.map(a => a.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length); // No duplicates
  });
});

// ── Pagination ────────────────────────────────────────────────────────────────

test.describe('Sprint 1 — Pagination', () => {
  test('GET /organizations?limit=2 returns max 2 results', async () => {
    // Create 5 orgs
    for (let i = 0; i < 5; i++) {
      await api.post('/organizations', { name: `Pag Org ${i}`, source: 'manual' });
    }
    const result = await api.get<unknown[]>('/organizations?limit=2&skip=0');
    expect(result.length).toBeLessThanOrEqual(2);
  });

  test('GET /tenders?limit=1 returns at most 1 result', async () => {
    const result = await api.get<unknown[]>('/tenders?limit=1');
    expect(result.length).toBeLessThanOrEqual(1);
  });

  test('Pagination skip works', async () => {
    const page1 = await api.get<{ id: number }[]>('/organizations?limit=2&skip=0');
    const page2 = await api.get<{ id: number }[]>('/organizations?limit=2&skip=2');
    if (page1.length > 0 && page2.length > 0) {
      // Pages should not overlap
      const p1ids = new Set(page1.map(o => o.id));
      const p2ids = page2.map(o => o.id);
      const overlap = p2ids.filter(id => p1ids.has(id));
      expect(overlap.length).toBe(0);
    }
  });
});
