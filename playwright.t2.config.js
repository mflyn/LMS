const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/e2e/t2', workers: 1, fullyParallel: false, retries: 0,
  timeout: 120000, expect: { timeout: 10000 },
  outputDir: process.env.T2_BROWSER_OUTPUT || '/tmp/lms-t2-browser-results',
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], actionTimeout: 15000,
    timezoneId: 'Asia/Shanghai', trace: 'off', video: 'off', screenshot: 'off' }
});
