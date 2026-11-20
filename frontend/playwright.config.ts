import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a running stack (backend + frontend), seeded with the invented fixture
 * data through the admin API. Set E2E_BASE_URL, E2E_ADMIN_USER and E2E_ADMIN_PASSWORD.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
