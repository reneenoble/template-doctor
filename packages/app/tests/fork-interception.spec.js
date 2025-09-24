// @ts-nocheck
import { test, expect } from '@playwright/test';

/**
 * Intercepts network calls to assert fork-first strategy:
 *  - Must NOT issue GET /repos/SomeOrg/sample (upstream org) before fork
 *  - Must POST /repos/SomeOrg/sample/forks
 *  - May then poll /repos/test-user/sample (user fork)
 */

test.describe('Fork-first interception', () => {
  test.beforeEach(async ({ page }) => {
    let forkCreated = false;
    await page.route(/https:\/\/api\.github\.com\/.*/, (route) => {
      const url = route.request().url();
      const method = route.request().method();
      // Provide canned responses for the flows we care about
      if (/\/user$/.test(url)) {
        return route.fulfill({ status: 200, json: { login: 'test-user' } });
      }
      if (/\/repos\/SomeOrg\/sample\/forks$/.test(url) && method === 'POST') {
        forkCreated = true;
        return route.fulfill({ status: 202, json: { message: 'forking' } });
      }
      if (/\/repos\/test-user\/sample$/.test(url)) {
        if (!forkCreated) {
          return route.fulfill({ status: 404, json: { message: 'Not Found' } });
        }
        return route.fulfill({ status: 200, json: { name: 'sample', owner: { login: 'test-user' }, default_branch: 'default', fork: true } });
      }
      if (/git\/trees\/main/.test(url)) {
        return route.fulfill({ status: 404, json: { message: 'Not Found' } });
      }
      if (/git\/trees\/default/.test(url)) {
        return route.fulfill({ status: 200, json: { tree: [{ path: 'README.md', type: 'blob' }] } });
      }
      if (/contents\/README\.md$/.test(url)) {
        return route.fulfill({ status: 200, json: { encoding: 'base64', content: Buffer.from('# README').toString('base64') } });
      }
      // Default
      return route.fulfill({ status: 200, json: {} });
    });

    // Mock auth in the browser context
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

    await page.goto('/');
  });

  test('fork is created before any upstream org GET', async ({ page }) => {
  const requests = [];
    await page.route('**/api.github.com/repos/SomeOrg/sample', (route, request) => {
      // Simulate SAML/SSO 403 error for the first GET to org repo
      if (request.method() === 'GET') {
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Resource protected by organization SAML SSO',
            documentation_url: 'https://docs.github.com/articles/authenticating-to-a-github-organization-with-saml-single-sign-on/'
          })
        });
      }
      return route.continue();
    });
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('https://api.github.com')) {
        requests.push({ method: req.method(), url });
      }
    });

    // Trigger analysis (UI helper - simulate entering repo and clicking analyze)
    await page.evaluate(() => {
      const input = document.querySelector('#repo-input') || document.querySelector('#repo-url') || document.querySelector('#repo-search');
      if (input) {
        input.value = 'https://github.com/SomeOrg/sample';
      }
      // Attempt to call global analyze entry
      if (window.analyzeRepository) {
        window.analyzeRepository('https://github.com/SomeOrg/sample', 'dod');
      } else if (window.TemplateAnalyzer) {
        window.TemplateAnalyzer.analyzeTemplate('https://github.com/SomeOrg/sample', 'dod');
      }
    });

    // Wait up to 5s for fork POST to appear
    let forkPostIndex = -1;
    for (let i = 0; i < 25; i++) { // 25 * 200ms = 5s
      forkPostIndex = requests.findIndex(r => /\/repos\/SomeOrg\/sample\/forks$/.test(r.url) && r.method === 'POST');
      if (forkPostIndex >= 0) break;
      await page.waitForTimeout(200);
    }
    if (forkPostIndex < 0) {
      // Print all requests for debug
      // eslint-disable-next-line no-console
      console.error('DEBUG: No POST /forks detected. Requests:', JSON.stringify(requests, null, 2));
    }
    expect(forkPostIndex, 'Expected POST /forks to occur (fork-first strategy) but it never appeared').toBeGreaterThanOrEqual(0);

    const upstreamGetsBeforeFork = requests.filter((r, idx) => idx < forkPostIndex && /\/repos\/SomeOrg\/sample$/.test(r.url) && r.method === 'GET');
    if (upstreamGetsBeforeFork.length > 0) {
      // eslint-disable-next-line no-console
      console.error('DEBUG: Upstream GETs before fork:', JSON.stringify(upstreamGetsBeforeFork, null, 2));
    }
    expect(upstreamGetsBeforeFork.length).toBe(0);
  });
});
