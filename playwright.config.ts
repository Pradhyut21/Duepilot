import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  webServer: process.env.TEST_BASE_URL ? undefined : {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60000,
  },
  outputDir: process.env.TEST_BASE_URL
    ? 'test-results/hosted'
    : 'test-results/local',
  timeout: 180000,
  expect: { timeout: 25000 },
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    trace: 'retain-on-failure',
    headless: true,
  },
  reporter: 'list',
});
