import { defineConfig, devices } from '@playwright/test';

/**
 * Target: the public, pre-login agent at ask.permission.ai.
 * We test one real, third-party environment — no local server — so config leans on
 * generous per-action time, a single retry to absorb network blips (not to paper over
 * a weak wait), and traces/screenshots kept only when something actually fails.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 2 : 3,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/report', open: 'never' }],
  ],
  use: {
    baseURL: 'https://ask.permission.ai',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      grepInvert: /mobile:/,
    },
    {
      // Pixel 5 is Chromium-based: one browser to install, keeps the clean-clone setup fast.
      // The 8 test cases live in the desktop project; mobile runs only the viewport test,
      // so the suite stays at 8 cases, not 16 executions.
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
      grep: /mobile:/,
    },
  ],
});
