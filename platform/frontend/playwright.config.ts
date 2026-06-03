import { defineConfig, devices } from '@playwright/test';

/**
 * DataSphere E2E Playwright configuration.
 *
 * Environment variables (all optional — defaults work for local dev):
 *   E2E_BASE_URL   — frontend URL  (default: http://localhost:5173)
 *   E2E_API_URL    — backend URL   (default: http://localhost:8000/api/v1)
 *   E2E_HEADLESS   — 'false' to watch browser (default: true in CI, true locally)
 *   E2E_SLOWMO     — ms between actions for debugging (default: 0)
 *   E2E_TIMEOUT    — per-test timeout in ms (default: 90000)
 *
 * Run commands:
 *   npm run test:e2e               — full suite (headless)
 *   npm run test:e2e:ui            — Playwright UI mode
 *   npm run test:e2e:headed        — watch browser
 *   npm run test:e2e:debug         — step-by-step with inspector
 *   npm run test:e2e:report        — open last HTML report
 *   npm run test:e2e:workflow      — only workflow spec
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const isCI    = !!process.env.CI;
const timeout = parseInt(process.env.E2E_TIMEOUT || '90000', 10);

export default defineConfig({
  testDir: './e2e',
  timeout,
  expect: { timeout: 15_000 },

  // Retry once on CI to handle flaky network/timing
  retries: isCI ? 2 : 0,

  // Parallel workers: 1 in CI (backend state is shared), 2 locally
  workers: isCI ? 1 : 2,

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
    ...(isCI ? [['github'] as ['github']] : []),
  ],

  use: {
    baseURL: BASE_URL,
    trace:      'on-first-retry',
    screenshot: 'only-on-failure',
    video:      isCI ? 'on-first-retry' : 'off',
    headless:   process.env.E2E_HEADLESS !== 'false',
    slowMo:     parseInt(process.env.E2E_SLOWMO || '0', 10),
    // Locale française pour correspondre à l'UI
    locale:     'fr-FR',
    timezoneId: 'Europe/Paris',
    // Viewport standard Desktop
    viewport:   { width: 1280, height: 800 },
    // Wait for network idle to stabilise before assertions
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Activé manuellement via: npx playwright test --project=firefox
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
  ],

  // Start dev server before tests (skipped in CI — assumed already running)
  webServer: isCI ? undefined : {
    command:             'npm run dev',
    port:                5173,
    reuseExistingServer: true,
    timeout:             45_000,
    stdout:              'pipe',
    stderr:              'pipe',
  },

  // Output for artifacts
  outputDir: 'test-results',
});
