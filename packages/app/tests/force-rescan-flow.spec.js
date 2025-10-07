// @ts-nocheck
import { test, expect } from '@playwright/test';

/**
 * Force-rescan flow test:
 *
 * This test validates the fork=1 URL parameter pattern used to avoid SAML/SSO authentication errors
 * when analyzing organization repositories.
 *
 * Pattern Overview:
 * - Production uses ?fork=1 or &fork=1 URL parameters to signal fork usage
 * - This avoids GitHub API calls (GET/POST) that trigger SAML 403 errors on org repos
 * - The analyzer assumes user's fork exists and updates owner to currentUser internally
 * - See window.forkAndAnalyzeRepo in app.js for the production implementation
 *
 * Test Flow:
 * 1. Initial analysis: Creates fork via POST (first time setup)
 * 2. Force-rescan: Uses existing fork with merge-upstream sync (no second fork POST)
 * 3. Validates that fork=1 prevents duplicate fork API calls
 */

test.describe('Force rescan flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const mockUserInfo = { login: 'test-user', name: 'Test User' };
      localStorage.setItem('gh_access_token', 'mock_access_token');
      localStorage.setItem('gh_user_info', JSON.stringify(mockUserInfo));
      window.GitHubAuth = {
        accessToken: 'mock_access_token',
        userInfo: mockUserInfo,
        isAuthenticated: () => true,
        getAccessToken: () => 'mock_access_token',
        getUsername: () => 'test-user',
        getUserInfo: () => mockUserInfo,
        checkAuthentication: () => true,
        updateUI: () => {},
      };
    });
  });

  test('force rescan bypasses reuse', async ({ page }) => {
    const networkLog = [];
    // Track simulated fork creation state so that first access forces a fork POST
    let forkCreated = false;
    // Helper to wait for analyzer + github client
    async function waitForAnalyzer(page) {
      await page.waitForFunction(() => !!window.GitHubClient && !!window.TemplateAnalyzer, null, {
        timeout: 4000,
      });
      // Also wait until GitHubClient has a username
      await page
        .waitForFunction(
          () => {
            try {
              return !!(
                window.GitHubClient.getCurrentUsername && window.GitHubClient.getCurrentUsername()
              );
            } catch (_) {
              return false;
            }
          },
          null,
          { timeout: 4000 },
        )
        .catch(() => {});
    }
    await page.route(/https:\/\/api\.github\.com\/.*/, (route) => {
      const req = route.request();
      const url = req.url();
      const method = req.method();
      if (url.startsWith('https://api.github.com')) {
        networkLog.push(method + ' ' + url);
      }
      // Basic mocked endpoints
      if (/\/user$/.test(url)) return route.fulfill({ status: 200, json: { login: 'test-user' } });
      if (/\/repos\/SomeOrg\/sample\/forks$/.test(url) && method === 'POST') {
        forkCreated = true;
        return route.fulfill({ status: 202, json: {} });
      }
      if (/\/repos\/test-user\/sample$/.test(url) && method === 'GET') {
        if (!forkCreated) {
          // Simulate fork not existing yet so client triggers POST
          return route.fulfill({ status: 404, json: { message: 'Not Found' } });
        }
        return route.fulfill({
          status: 200,
          json: {
            name: 'sample',
            owner: { login: 'test-user' },
            default_branch: 'default',
            fork: true,
          },
        });
      }
      if (/merge-upstream/.test(url) && method === 'POST')
        return route.fulfill({ status: 200, json: { merged: true } });
      if (/git\/trees\/main/.test(url))
        return route.fulfill({ status: 404, json: { message: 'Not Found' } });
      if (/git\/trees\/default/.test(url))
        return route.fulfill({
          status: 200,
          json: { tree: [{ path: 'README.md', type: 'blob' }] },
        });
      if (/contents\/README\.md$/.test(url))
        return route.fulfill({
          status: 200,
          json: { encoding: 'base64', content: Buffer.from('# README').toString('base64') },
        });
      return route.fulfill({ status: 200, json: {} });
    });

    await page.goto('/');
    await waitForAnalyzer(page);
    await page.evaluate(() =>
      console.log('DIAG readiness', {
        hasGitHubClient: !!window.GitHubClient,
        hasAnalyzer: !!window.TemplateAnalyzer,
        username:
          window.GitHubClient &&
          window.GitHubClient.getCurrentUsername &&
          window.GitHubClient.getCurrentUsername(),
      }),
    );

    // First run to populate
    await page.evaluate(() => {
      if (window.analyzeRepository)
        window.analyzeRepository('https://github.com/SomeOrg/sample', 'dod');
      else window.TemplateAnalyzer.analyzeTemplate('https://github.com/SomeOrg/sample', 'dod');
    });
    await page.waitForTimeout(1400);

    const forkPostsFirst = networkLog.filter((l) =>
      l.includes('POST https://api.github.com/repos/SomeOrg/sample/forks'),
    );
    if (forkPostsFirst.length !== 1) {
      // Extra diagnostics to help understand why fork wasn't triggered
      // eslint-disable-next-line no-console
      console.error(
        'DIAG: Expected 1 fork POST on first run but saw',
        forkPostsFirst.length,
        'Full networkLog follows:\n' + networkLog.join('\n'),
      );
    }
    expect(forkPostsFirst.length).toBe(1);

    // Second run with force-rescan sentinel
    // NOTE: The ?fork=1 parameter is the production pattern for signaling fork usage without API calls.
    // This pattern avoids SAML 403 errors on organization repositories by:
    // 1. Not making GET requests to check fork existence (triggers SAML auth on org repos)
    // 2. Not making POST requests to create forks (also triggers SAML auth on org repos)
    // 3. Simply assuming the user's fork exists and using it directly
    // The fork=1 directive tells the analyzer to update owner to currentUser internally.
    const beforeSecond = networkLog.length;
    await page.evaluate(() => {
      if (window.analyzeRepository)
        window.analyzeRepository('https://github.com/SomeOrg/sample', 'force-rescan');
      else
        window.TemplateAnalyzer.analyzeTemplate('https://github.com/SomeOrg/sample?fork=1', 'dod');
    });
    await page.waitForTimeout(1400);

    // Should NOT add a second fork POST
    const forkPostsAfter = networkLog.filter((l) =>
      l.includes('POST https://api.github.com/repos/SomeOrg/sample/forks'),
    );
    expect(forkPostsAfter.length).toBe(1);

    // But should have at least one merge-upstream sync attempt (existing fork path)
    const mergeCalls = networkLog.filter((l) => l.includes('/merge-upstream'));
    expect(mergeCalls.length).toBeGreaterThanOrEqual(1);
    expect(networkLog.length).toBeGreaterThan(beforeSecond); // new network due to fresh analysis
  });
});
