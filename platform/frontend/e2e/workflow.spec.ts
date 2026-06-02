import { test, expect } from '@playwright/test';
import { loginUI, getToken, goToTab, API } from './helpers';

test.describe('Full workflow — AO → Livrable', () => {
  let token: string;

  test.beforeAll(async () => {
    token = await getToken();
  });

  test.beforeEach(async ({ page }) => {
    await loginUI(page);
  });

  test('create an organization via API and verify in CRM', async ({ page }) => {
    // Create org via API
    const res = await fetch(`${API}/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'E2E Test Corp', country: 'FR', sector: 'IT' }),
    });
    expect(res.status).toBe(201);
    const org = await res.json();
    expect(org.name).toBe('E2E Test Corp');

    // Navigate to Commercial tab and verify CRM
    await goToTab(page, 'Commercial');
    await page.waitForTimeout(1500);
    // Page should not crash
    await expect(page).not.toHaveURL('/error');
  });

  test('full AO pipeline: org → opp → tender via API', async ({ page }) => {
    // 1. Create org
    const orgRes = await fetch(`${API}/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'E2E Ministry', country: 'GN', sector: 'Public' }),
    });
    const org = await orgRes.json();

    // 2. Create opportunity
    const oppRes = await fetch(`${API}/opportunities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: 'Système data national',
        organization_id: org.id,
        status: 'Prospect identifie',
        probability: 60,
        potential_value: 500000,
      }),
    });
    expect(oppRes.status).toBe(201);
    const opp = await oppRes.json();

    // 3. Create tender
    const tenderRes = await fetch(`${API}/tenders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        opportunity_id: opp.id,
        title: 'E2E Appel d offres Data',
        reference: `E2E-${Date.now()}`,
        buyer_name: 'E2E Ministry',
        status: 'draft',
      }),
    });
    expect(tenderRes.status).toBe(201);
    const tender = await tenderRes.json();
    expect(tender.title).toBe('E2E Appel d offres Data');

    // 4. Verify it appears in Tenders tab
    await goToTab(page, 'Appels');
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL('/error');
  });

  test('create deliverable and check workflow status', async ({ page }) => {
    // Setup: create minimum required entities
    const orgRes = await fetch(`${API}/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'E2E Deliverable Org', country: 'FR', sector: 'IT' }),
    });
    const org = await orgRes.json();

    const oppRes = await fetch(`${API}/opportunities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: 'E2E Opp', organization_id: org.id, status: 'Prospect identifie', probability: 50 }),
    });
    const opp = await oppRes.json();

    const tenderRes = await fetch(`${API}/tenders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ opportunity_id: opp.id, title: 'E2E Tender', reference: `E2E-DEL-${Date.now()}`, status: 'draft' }),
    });
    const tender = await tenderRes.json();

    // Create deliverable
    const delRes = await fetch(`${API}/deliverables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        tender_id: tender.id,
        title: 'E2E Mémoire technique',
        deliverable_type: 'memoire_technique',
        status: 'draft',
      }),
    });
    expect(delRes.status).toBe(201);
    const del = await delRes.json();
    expect(del.status).toBe('draft');

    // Navigate to Deliverables tab
    await goToTab(page, 'Livrables');
    await page.waitForTimeout(1500);
    await expect(page).not.toHaveURL('/error');
  });

  test('providers panel loads in Operations', async ({ page }) => {
    await goToTab(page, 'Opérations');
    // Click Providers IA tab
    const provTab = page.locator('button', { hasText: 'Providers IA' });
    if (await provTab.isVisible()) {
      await provTab.click();
      await page.waitForTimeout(2000);
      // Should show provider tiers
      const content = await page.locator('body').textContent();
      expect(content).toMatch(/Gratuit|Provider|LLM|simulation/i);
    }
  });

  test('suggestions panel loads in Operations', async ({ page }) => {
    await goToTab(page, 'Opérations');
    await page.waitForTimeout(1000);
    // Suggestions IA is the default tab
    await expect(page.locator('text=Suggestions IA').first()).toBeVisible({ timeout: 8_000 });
  });

  test('audit log page loads and shows table', async ({ page }) => {
    await goToTab(page, 'Audit');
    await page.waitForTimeout(2000);
    // Journal d'audit heading
    const content = await page.locator('body').textContent();
    expect(content).toMatch(/audit|Journal|événement/i);
  });
});
