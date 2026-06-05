import { expect, test } from '@playwright/test';

const teamMembers = [
  {
    id: 1,
    email: 'admin@datasphere.test',
    first_name: 'Admin',
    last_name: 'User',
    role: 'admin',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    email: 'consultant@datasphere.test',
    first_name: 'Consultant',
    last_name: 'Data',
    role: 'consultant',
    is_active: true,
    created_at: '2026-01-02T00:00:00Z',
  },
];

async function mockAdminTeam(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, email: 'admin@datasphere.test', role: 'admin', is_active: true }),
    });
  });

  await page.route('**/api/v1/team', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(teamMembers) });
  });

  await page.route('**/api/v1/team/invite', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 3, ...body, created_at: '2026-01-03T00:00:00Z' }),
    });
  });

  await page.route('**/api/v1/team/2', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...teamMembers[1], role: 'manager' }) });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/v1/team/2/deactivate', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...teamMembers[1], is_active: false }) });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('ds_access_token', 'test-access-token');
    window.localStorage.setItem('ds_refresh_token', 'test-refresh-token');
  });
}

test('admin can view team members', async ({ page }) => {
  await mockAdminTeam(page);
  await page.goto('/');

  await page.getByRole('button', { name: /Equipe|Équipe/i }).click();
  await expect(page.getByRole('heading', { name: "Gestion de l'équipe" })).toBeVisible();
  await expect(page.getByText('admin@datasphere.test')).toBeVisible();
  await expect(page.getByText('consultant@datasphere.test')).toBeVisible();
});

test('admin can invite a member', async ({ page }) => {
  await mockAdminTeam(page);
  await page.goto('/');

  await page.getByRole('button', { name: /Equipe|Équipe/i }).click();
  await page.getByRole('button', { name: /Inviter un membre/i }).click();
  await page.getByLabel('Prénom').fill('Nouveau');
  await page.getByLabel('Nom').fill('Membre');
  await page.getByLabel('Email').fill('new.member@datasphere.test');
  await page.getByLabel('Mot de passe provisoire').fill('TempPassword123!');
  await page.getByLabel('Rôle').selectOption('consultant');
  await page.getByRole('button', { name: /Envoyer l'invitation/i }).click();

  await expect(page.getByText('new.member@datasphere.test invité(e) avec succès.')).toBeVisible();
});

test('admin can change a member role', async ({ page }) => {
  await mockAdminTeam(page);
  await page.goto('/');

  await page.getByRole('button', { name: /Equipe|Équipe/i }).click();
  const roleSelects = page.locator('.team-member-actions select');
  await roleSelects.nth(1).selectOption('manager');
  await expect(roleSelects.nth(1)).toHaveValue('manager');
});

test('admin can deactivate a member after confirmation', async ({ page }) => {
  await mockAdminTeam(page);
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');

  await page.getByRole('button', { name: /Equipe|Équipe/i }).click();
  await page.locator('.team-member-actions button').nth(1).click();
  await expect(page.getByText(/Désactivé/i)).toBeVisible();
});
