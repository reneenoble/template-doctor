const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
// Ensure we always serve the frontend directory even when tests are invoked from repo root.
const appDir = __dirname; // packages/app
// Launch Vite dev server instead of python static server during tests.
const serverCommand = `bash -c "cd '${appDir}' && npx vite"`;

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run tests sequentially for debugging
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // Add one retry for flaky tests
  workers: 1, // Use single worker for predictable execution
  reporter: 'html', // Use HTML reporter

  use: {
    baseURL: 'http://localhost:4000', // Ensure tests navigate to the correct server
    trace: 'on', // Capture traces for all tests
    screenshot: 'only-on-failure', // Capture screenshots on failure
    video: 'on-first-retry', // Record video on retry
  },

  projects: [
    {
      name: 'chromium',
      testDir: path.join(appDir, 'tests'),
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: serverCommand,
    url: 'http://localhost:4000',
    reuseExistingServer: true,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: appDir,
  },

  // Increase timeouts for debugging
  timeout: 60000, // Global timeout
  expect: {
    timeout: 10000, // Expect assertion timeout
  },
});
