import { defineConfig, devices } from '@playwright/test';

/**
 * Target: the public, pre-login agent at ask.permission.ai.
 * We test one real, third-party environment — no local server — so the timeouts are
 * generous (a live model reply can take 30s+ on a slow link) and there are 2 retries to
 * absorb network blips against a site we don't control — not to paper over a weak wait.
 * Traces/screenshots are kept only when something actually fails.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: process.env.CI ? 2 : 3,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/report', open: 'never' }],
  ],
  use: {
    baseURL: 'https://ask.permission.ai',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      grepInvert: /mobile:/,
    },
    {
      // Pixel 7 is Chromium-based: one browser to install, keeps the clean-clone setup fast.
      // The 8 test cases live in the desktop project; mobile runs only the viewport test,
      // so the suite stays at 8 cases, not 16 executions.
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      grep: /mobile:/,
    },
  ],
});
