import { defineConfig, devices } from '@playwright/test';

/**
 * DataSphere E2E Playwright configuration.
 *
 * Two modes are intentionally separated:
 *   - mocked-ui: stable frontend tests that mock API responses and do not need the backend.
 *   - integration-backend: API/workflow tests that require the FastAPI backend on E2E_API_URL.
 *
 * Common commands:
 *   npm run test:e2e                    -> mocked UI suite only
 *   npm run test:e2e:integration        -> backend integration suite only
 *   npm run test:e2e:all                -> both suites
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const isCI = !!process.env.CI;
const timeout = parseInt(process.env.E2E_TIMEOUT || '90000', 10);
const runBackendIntegration = process.env.E2E_RUN_BACKEND === 'true';

const mockedUiSpecs = [
  'e2e/auth.mock.spec.ts',
  'e2e/rbac.spec.ts',
  'e2e/crm.spec.ts',
  'e2e/tenders.spec.ts',
  'e2e/deliverables.spec.ts',
  'e2e/audit.spec.ts',
  'e2e/team.spec.ts',
  'e2e/commercial.spec.ts',
  'e2e/operations.spec.ts',
];

const backendIntegrationSpecs = [
  'e2e/api-smoke.spec.ts',
  'e2e/auth.spec.ts',
  'e2e/navigation.spec.ts',
  'e2e/ui-robustness.spec.ts',
  'e2e/workflow.spec.ts',
];

export default defineConfig({
  testDir: './',
  timeout,
  expect: { timeout: 15_000 },

  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : 2,

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
    ...(isCI ? [['github'] as ['github']] : []),
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: isCI ? 'on-first-retry' : 'off',
    headless: process.env.E2E_HEADLESS !== 'false',
    slowMo: parseInt(process.env.E2E_SLOWMO || '0', 10),
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    viewport: { width: 1280, height: 800 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: runBackendIntegration
    ? [
        {
          name: 'integration-backend',
          testMatch: backendIntegrationSpecs,
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : [
        {
          name: 'mocked-ui',
          testMatch: mockedUiSpecs,
          use: { ...devices['Desktop Chrome'] },
        },
      ],

  webServer: isCI ? undefined : {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 45_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  outputDir: 'test-results',
});
