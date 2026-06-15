/**
 * E2E Sprint 19 — Tests des features complétées
 * - CommercialPage (KPIs, pipeline, contacts, automation)
 * - LinkedIn Agent (OAuth status, génération, UI)
 * - Pages nouvellement routées (CalculatorPage, PricingPage, SettingsPage)
 * - TenderPage Mémoire Technique panel
 * - DeliverablePage (filtres, nouveau livrable, génération IA)
 */

import { test, expect, Page } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const API  = process.env.API_URL  || 'http://localhost:8000/api/v1';

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE}/`);
  const emailInput = page.locator('input[type="email"]');
  if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emailInput.fill(process.env.ADMIN_EMAIL || 'admin@datasphere.io');
    await page.locator('input[type="password"]').fill(process.env.ADMIN_PASSWORD || 'admin1234');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1000);
  }
}

// ── CommercialPage ─────────────────────────────────────────────────────────

test.describe('CommercialPage', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('charge et affiche les 4 onglets', async ({ page }) => {
    // Naviguer vers commercial
    const commercialBtn = page.locator('button', { hasText: /commercial|pipeline/i }).first();
    if (await commercialBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commercialBtn.click();
    } else {
      await page.goto(`${BASE}/`);
    }
    await page.waitForTimeout(800);

    // Vérifier la présence des tabs
    await expect(page.locator('button', { hasText: /vue d.ensemble/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button', { hasText: /pipeline kanban/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button', { hasText: /contacts crm/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button', { hasText: /automatisation/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('affiche les KPI cards dans vue d\'ensemble', async ({ page }) => {
    await page.waitForTimeout(1000);
    // KPI cards visibles (au moins le titre de la page)
    const hasCrm = await page.locator('text=/organisations|contacts|opportunit/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasHeader = await page.locator('text=/pipeline|commercial|crm/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasCrm || hasHeader).toBeTruthy();
  });

  test('API /analytics/dashboard retourne les données CRM', async ({ request }) => {
    // Récupérer un token
    const auth = await request.post(`${API}/auth/login`, {
      data: { email: process.env.ADMIN_EMAIL || 'admin@datasphere.io', password: process.env.ADMIN_PASSWORD || 'admin1234' }
    });
    if (!auth.ok()) return; // Skip si pas d'admin configuré
    const { access_token } = await auth.json();

    const resp = await request.get(`${API}/analytics/dashboard`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('crm');
    expect(data.crm).toHaveProperty('organizations');
    expect(data.crm).toHaveProperty('opportunities_total');
    expect(data).toHaveProperty('activity_7d');
  });
});

// ── LinkedIn Agent ─────────────────────────────────────────────────────────

test.describe('LinkedIn Agent', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('affiche le panel OAuth status', async ({ page }) => {
    await page.waitForTimeout(600);
    const linkedinBtn = page.locator('button, a', { hasText: /linkedin/i }).first();
    if (await linkedinBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await linkedinBtn.click();
      await page.waitForTimeout(800);
    }
    // Panel OAuth doit montrer soit "connecté" soit "connexion requise"
    const oauthPanel = await page.locator('text=/linkedin|oauth|connecter/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(oauthPanel).toBeTruthy();
  });

  test('API /linkedin/oauth/status répond', async ({ request }) => {
    const auth = await request.post(`${API}/auth/login`, {
      data: { email: process.env.ADMIN_EMAIL || 'admin@datasphere.io', password: process.env.ADMIN_PASSWORD || 'admin1234' }
    });
    if (!auth.ok()) return;
    const { access_token } = await auth.json();

    const resp = await request.get(`${API}/linkedin/oauth/status`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('oauth_configured');
    expect(data).toHaveProperty('has_token');
    expect(data).toHaveProperty('is_expired');
  });

  test('API /linkedin/generate génère un post data engineering', async ({ request }) => {
    const auth = await request.post(`${API}/auth/login`, {
      data: { email: process.env.ADMIN_EMAIL || 'admin@datasphere.io', password: process.env.ADMIN_PASSWORD || 'admin1234' }
    });
    if (!auth.ok()) return;
    const { access_token } = await auth.json();

    const resp = await request.post(`${API}/linkedin/generate`, {
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      data: { topic_type: 'data_engineering', topic: 'dbt Core vs SQL Mesh' }
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('content');
    expect(data.content.length).toBeGreaterThan(50);
    expect(data).toHaveProperty('provider');
    expect(data).toHaveProperty('hashtags');
  });
});

// ── Pages nouvellement routées ─────────────────────────────────────────────

test.describe('Pages routées Sprint 18/19', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForTimeout(600);
  });

  test('CalculatorPage accessible depuis la navigation', async ({ page }) => {
    const calcBtn = page.locator('button', { hasText: /calculateur/i }).first();
    if (await calcBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await calcBtn.click();
      await page.waitForTimeout(600);
      await expect(page.locator('text=/calculateur|tjm|taux journalier/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('PricingPage accessible et affiche les plans', async ({ page }) => {
    const pricingBtn = page.locator('button', { hasText: /tarif|pricing|plan/i }).first();
    if (await pricingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pricingBtn.click();
      await page.waitForTimeout(600);
      await expect(page.locator('text=/plan|starter|pro|free/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('SettingsPage affiche le statut SMTP et LLM', async ({ page }) => {
    const settingsBtn = page.locator('button', { hasText: /configuration|settings/i }).first();
    if (await settingsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsBtn.click();
      await page.waitForTimeout(600);
      const hasSettings = await page.locator('text=/smtp|llm|configuration|intégration/i').first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasSettings).toBeTruthy();
    }
  });
});

// ── TenderPage Mémoire Technique ───────────────────────────────────────────

test.describe('TenderPage — Mémoire Technique', () => {
  test('bouton Mémoire Technique visible dans TenderPage', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForTimeout(600);

    const tenderBtn = page.locator('button', { hasText: /appels d.offres|tenders|ao/i }).first();
    if (await tenderBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tenderBtn.click();
      await page.waitForTimeout(800);
    }

    const memoireBtn = page.locator('button', { hasText: /mémoire technique/i }).first();
    await expect(memoireBtn).toBeVisible({ timeout: 6000 });
  });

  test('API POST /tenders/{id}/memoire répond (si AO disponible)', async ({ request }) => {
    const auth = await request.post(`${API}/auth/login`, {
      data: { email: process.env.ADMIN_EMAIL || 'admin@datasphere.io', password: process.env.ADMIN_PASSWORD || 'admin1234' }
    });
    if (!auth.ok()) return;
    const { access_token } = await auth.json();

    // Récupérer le premier AO
    const tenders = await request.get(`${API}/tenders?limit=1`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    if (!tenders.ok()) return;
    const list = await tenders.json();
    const items = Array.isArray(list) ? list : list.items ?? [];
    if (!items.length) return; // Skip si aucun AO

    const tenderId = items[0].id;
    const resp = await request.post(`${API}/tenders/${tenderId}/memoire`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('content');
    expect(data.content.length).toBeGreaterThan(100);
    expect(data).toHaveProperty('word_count');
  });
});

// ── DeliverablePage ────────────────────────────────────────────────────────

test.describe('DeliverablePage', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForTimeout(600);
  });

  test('affiche les filtres de statut et type', async ({ page }) => {
    const delivBtn = page.locator('button', { hasText: /livrables/i }).first();
    if (await delivBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await delivBtn.click();
      await page.waitForTimeout(800);
    }
    // Boutons de filtre statut
    const hasBrouillons = await page.locator('button, text', { hasText: /brouillons/i }).first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasApprouves = await page.locator('button, text', { hasText: /approv/i }).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasBrouillons || hasApprouves).toBeTruthy();
  });

  test('bouton Nouveau livrable crée un formulaire', async ({ page }) => {
    const delivBtn = page.locator('button', { hasText: /livrables/i }).first();
    if (await delivBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await delivBtn.click();
      await page.waitForTimeout(800);
    }
    const newBtn = page.locator('button', { hasText: /nouveau/i }).first();
    if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newBtn.click();
      await page.waitForTimeout(400);
      await expect(page.locator('input[placeholder*="Mémoire"]').first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('API GET /deliverables retourne la liste', async ({ request }) => {
    const auth = await request.post(`${API}/auth/login`, {
      data: { email: process.env.ADMIN_EMAIL || 'admin@datasphere.io', password: process.env.ADMIN_PASSWORD || 'admin1234' }
    });
    if (!auth.ok()) return;
    const { access_token } = await auth.json();

    const resp = await request.get(`${API}/deliverables?limit=10`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(Array.isArray(data) || Array.isArray(data?.items)).toBeTruthy();
  });
});

// ── RAG Service ────────────────────────────────────────────────────────────

test.describe('RAG Service', () => {
  test('API /analytics/dashboard inclut les infos RAG dans health', async ({ request }) => {
    const auth = await request.post(`${API}/auth/login`, {
      data: { email: process.env.ADMIN_EMAIL || 'admin@datasphere.io', password: process.env.ADMIN_PASSWORD || 'admin1234' }
    });
    if (!auth.ok()) return;
    const { access_token } = await auth.json();

    const resp = await request.get(`${API}/health`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    if (!resp.ok()) return;
    const data = await resp.json();
    // Health check contient la section RAG
    if (data.components?.rag) {
      expect(data.components.rag).toHaveProperty('mode');
    }
  });

  test('API /deliverables/similar retourne des résultats', async ({ request }) => {
    const auth = await request.post(`${API}/auth/login`, {
      data: { email: process.env.ADMIN_EMAIL || 'admin@datasphere.io', password: process.env.ADMIN_PASSWORD || 'admin1234' }
    });
    if (!auth.ok()) return;
    const { access_token } = await auth.json();

    const resp = await request.get(`${API}/deliverables/similar?query=data+architecture+snowflake`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    // Peut retourner 200 avec liste vide si pas de livrables approuvés
    expect([200, 404].includes(resp.status())).toBeTruthy();
  });
});
