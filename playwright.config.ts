import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;

/** E2E runs against the invented fixture data only (fixtures/normalized). */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    viewport: { width: 1400, height: 1000 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 1000 } },
    },
  ],
  webServer: {
    command: `npm run dev -w @battle-drill/web -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: { BATTLE_DRILL_DATA_DIR: 'fixtures/normalized' },
    timeout: 60_000,
  },
});
