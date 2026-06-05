/**
 * DataSphere E2E — Test Helpers
 *
 * Provides:
 *   - ApiClient  (direct backend calls for setup/teardown)
 *   - Auth       (bootstrap, loginUI, injectAuth)
 *   - Navigation (goToTab, goToSubTab)
 *   - Factories  (createOrg, createOpp, createTender, buildScenario…)
 *   - Waits      (waitForIdle, waitForSuccess)
 */

import { type Page, type BrowserContext, expect } from '@playwright/test';

// ─── Configuration ────────────────────────────────────────────────────────────
export const API      = process.env.E2E_API_URL   || 'http://localhost:8000/api/v1';
export const BASE_URL = process.env.E2E_BASE_URL  || 'http://localhost:5173';
export const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    || 'admin@datasphere.io';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin123456!';
export const E2E_TAG = `E2E-${Date.now().toString(36).toUpperCase()}`;

// ─── API Client ───────────────────────────────────────────────────────────────

export class ApiClient {
  private token: string | null = null;

  async bootstrap(): Promise<void> {
    await fetch(`${API}/auth/bootstrap-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
        first_name: 'Admin', last_name: 'E2E',
        role: 'admin', is_active: true,
      }),
    }).catch(() => null);
  }

  async login(): Promise<string> {
    await this.bootstrap();
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    const data = await res.json() as { access_token: string };
    this.token = data.access_token;
    return this.token;
  }

  async getToken(): Promise<string> {
    if (!this.token) await this.login();
    return this.token!;
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const tok = await this.getToken();
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`API ${method} ${path} → ${res.status}: ${txt}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  get  = <T>(path: string)              => this.req<T>('GET',    path);
  post = <T>(path: string, b: unknown)  => this.req<T>('POST',   path, b);
  patch= <T>(path: string, b: unknown)  => this.req<T>('PATCH',  path, b);
  del  = <T>(path: string)              => this.req<T>('DELETE', path);
}

export const api = new ApiClient();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TestOrg         { id: number; name: string }
export interface TestOpp         { id: number; title: string; organization_id: number }
export interface TestTender      { id: number; title: string; reference: string }
export interface TestDeliverable { id: number; title: string; status: string }
export interface TestAgent       { id: number; name: string; slug: string }
export interface TestAssignment  { id: number; agent_id: number; tender_id: number | null; status: string }
export interface TestAction      { id: number; title: string; status: string; requires_human_approval: boolean }

// ─── Data Factories ───────────────────────────────────────────────────────────

export const createOrg = (name?: string): Promise<TestOrg> =>
  api.post('/organizations', {
    name: name ?? `[${E2E_TAG}] Ministère Numérique`,
    country: 'GN', sector: 'Public',
  });

export const createOpp = (orgId: number, title?: string): Promise<TestOpp> =>
  api.post('/opportunities', {
    organization_id: orgId,
    title: title ?? `[${E2E_TAG}] Mission Data Platform`,
    status: 'Prospect identifié',
    probability: 65,
    potential_value: 450_000,
  });

export const createTender = (oppId: number, title?: string): Promise<TestTender> =>
  api.post('/tenders', {
    opportunity_id: oppId,
    title: title ?? `[${E2E_TAG}] Appel d'offres Data`,
    reference: `E2E-${Date.now().toString(36).toUpperCase()}`,
    buyer_name: 'Ministère Numérique GN',
    status: 'draft',
  });

export const createRequirement = (tenderId: number) =>
  api.post(`/tenders/${tenderId}/requirements`, {
    tender_id: tenderId,
    description: 'Fournir une plateforme data scalable, souveraine et documentée.',
    requirement_type: 'technique',
  });

export const installAgents = (): Promise<TestAgent[]> =>
  api.post('/agents/defaults/install', {});

export const createAssignment = (agentId: number, tenderId: number): Promise<TestAssignment> =>
  api.post('/agents/assignments', {
    agent_id: agentId,
    tender_id: tenderId,
    objective: 'Analyser le contexte de l\'AO et proposer les prochaines actions.',
    priority: 'Haute',
  });

export const createAction = (assignmentId: number): Promise<TestAction> =>
  api.post('/agent-actions', {
    assignment_id: assignmentId,
    title: `[${E2E_TAG}] Analyser les exigences`,
    action_type: 'analyze',
    description: 'Examiner chaque exigence et identifier les points critiques.',
    requires_human_approval: true,
  });

export const createDeliverable = (tenderId: number, oppId: number): Promise<TestDeliverable> =>
  api.post('/deliverables', {
    tender_id: tenderId,
    opportunity_id: oppId,
    title: `[${E2E_TAG}] Mémoire technique`,
    deliverable_type: 'memoire_technique',
    content_markdown: 'Contenu initial du mémoire technique pour validation E2E.',
    status: 'draft',
  });

// ─── Full scenario builder ────────────────────────────────────────────────────

export interface ScenarioData {
  org: TestOrg; opp: TestOpp; tender: TestTender;
  agents: TestAgent[]; assignment: TestAssignment;
  action: TestAction; deliverable: TestDeliverable;
}

/** Build a complete mission scenario via API — UI tests start from here. */
export async function buildScenario(): Promise<ScenarioData> {
  const org        = await createOrg();
  const opp        = await createOpp(org.id);
  const tender     = await createTender(opp.id);
  await createRequirement(tender.id);
  const agents     = await installAgents();
  const agent      = agents[0];
  const assignment = await createAssignment(agent.id, tender.id);
  const action     = await createAction(assignment.id);
  const deliverable = await createDeliverable(tender.id, opp.id);
  return { org, opp, tender, agents, assignment, action, deliverable };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** Inject JWT into localStorage — skips login form, faster for most tests. */
export async function injectAuth(context: BrowserContext): Promise<void> {
  const tok = await api.getToken();
  await context.addInitScript(([token, email]: [string, string]) => {
    localStorage.setItem('ds_access_token', token);
    localStorage.setItem('datasphere_access_token', token);
    localStorage.setItem('ds_user', JSON.stringify({
      id: 1, email, role: 'admin',
      first_name: 'Admin', last_name: 'E2E', is_active: true,
    }));
  }, [tok, ADMIN_EMAIL]);
}

/** Full UI login — use when testing the login form itself. */
export async function loginUI(page: Page): Promise<void> {
  await api.bootstrap();
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.root-switcher', { timeout: 20_000 });
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export async function goToTab(page: Page, label: string): Promise<void> {
  await page.locator('.root-switcher button', { hasText: label }).click();
  await page.waitForTimeout(500);
}

export async function goToSubTab(page: Page, label: string): Promise<void> {
  await page.locator('button', { hasText: label }).first().click();
  await page.waitForTimeout(400);
}

// ─── Waits & Assertions ───────────────────────────────────────────────────────

export async function waitForIdle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => {});
}

export async function waitForSuccess(page: Page): Promise<void> {
  await page.waitForSelector(
    'text=/créé|créée|succès|ajouté|installé|validé|approuvé|téléchargé/i',
    { timeout: 15_000 }
  ).catch(() => {});
}

export async function assertNoError(page: Page): Promise<void> {
  const hasError = await page.locator(
    'text=/Erreur de chargement|500|Internal Server/i'
  ).first().isVisible().catch(() => false);
  expect(hasError, 'Unexpected error visible on page').toBe(false);
}
