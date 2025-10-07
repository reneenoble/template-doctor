// Test utility for Playwright specs to consistently enable backend-migration dependent flows.
// Kept intentionally tiny to avoid coupling with production code.

export async function enableBackendMigration(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('td_backend_migration', '1');
    } catch {}
    window.__TD_FEATURES__ = { ...window.__TD_FEATURES__, backendMigration: true };
  });
}

export async function reaffirmBackendMigration(page) {
  await page.evaluate(() => {
    try {
      localStorage.setItem('td_backend_migration', '1');
    } catch {}
    window.__TD_FEATURES__ = { ...window.__TD_FEATURES__, backendMigration: true };
  });
}

export async function ensureApiClientReady(page) {
  // Wait for ApiRoutes or legacy api client functions to appear.
  await page.waitForFunction(
    () => !!(window.ApiRoutes || (window.GitHubClient && window.GitHubClient.auth)),
    { timeout: 5000 },
  );
}
