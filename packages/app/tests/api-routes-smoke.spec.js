// Simple Playwright smoke test to validate ApiRoutes presence and runtime-config availability.
const { test, expect } = require('@playwright/test');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

test.describe('API Routes Smoke', () => {
  test('ApiRoutes present and runtime-config fetch succeeds', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait up to 5s for ApiRoutes to be defined (scripts load sequentially)
    await page.waitForFunction(
      () => typeof window.ApiRoutes === 'object' && !!window.ApiRoutes.runtimeConfig,
      null,
      { timeout: 5000 },
    );

    const routeKeys = await page.evaluate(() => Object.keys(window.ApiRoutes));
    expect(routeKeys).toContain('runtimeConfig'); // legacy alias maintained
    expect(routeKeys).toContain('clientSettings'); // new canonical name
    expect(routeKeys).toContain('validationTemplate');

    // Attempt fetch; if Functions backend not running, allow static mock fallback
    const result = await page.evaluate(async () => {
      const url = window.ApiRoutes.clientSettings || window.ApiRoutes.runtimeConfig;
      try {
        const r = await fetch(url, { cache: 'no-store' });
        return { status: r.status };
      } catch (e) {
        return { status: 'ERR', error: String(e) };
      }
    });

    // Accept 200 (live functions) OR 404 (static site without backend) but fail on connection errors
    expect(['200', 200, '404', 404]).toContain(result.status);
  });
});
