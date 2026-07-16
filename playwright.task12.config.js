const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e/task12',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  actionTimeout: 10000,
  expect: { timeout: 10000 },
  outputDir: 'test-results/task12',
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium-task12',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'node tests/e2e/task11/startFamilyApp.js',
    url: 'http://127.0.0.1:3100/login',
    reuseExistingServer: false,
    timeout: 180000
  }
});
