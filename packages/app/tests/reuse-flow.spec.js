// @ts-nocheck
import { test, expect } from '@playwright/test';

/**
 * Reuse flow test:
 * 1. First analysis populates cache (simulated via window.__analysisCache).
 * 2. Second analysis of same repo + same ruleSet should short-circuit (reused notification / no extra fork POST).
 */

test.describe('Analysis reuse flow', () => {
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

  test('second run reuses previous analysis', async ({ page }) => {
    const networkLog = [];
    let forkCreated = false;
    // Helper to wait for analyzer + github client
    async function waitForAnalyzer(page) {
      await page.waitForFunction(() => !!window.GitHubClient && !!window.TemplateAnalyzer, null, { timeout: 4000 });
      await page.waitForFunction(() => {
        try { return !!(window.GitHubClient.getCurrentUsername && window.GitHubClient.getCurrentUsername()); } catch(_) { return false; }
      }, null, { timeout: 4000 }).catch(() => {});
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
      if (/\/repos\/test-user\/sample$/.test(url)) {
        if (!forkCreated) {
          return route.fulfill({ status: 404, json: { message: 'Not Found' } });
        }
        return route.fulfill({ status: 200, json: { name: 'sample', owner: { login: 'test-user' }, default_branch: 'default', fork: true } });
      }
      if (/git\/trees\/main/.test(url)) return route.fulfill({ status: 404, json: { message: 'Not Found' } });
      if (/git\/trees\/default/.test(url)) return route.fulfill({ status: 200, json: { tree: [{ path: 'README.md', type: 'blob' }] } });
      if (/contents\/README\.md$/.test(url)) return route.fulfill({ status: 200, json: { encoding: 'base64', content: Buffer.from('# README').toString('base64') } });
      return route.fulfill({ status: 200, json: {} });
    });

    await page.goto('/');
    await waitForAnalyzer(page);

    // First run
    await page.evaluate(() => {
      if (window.analyzeRepository) {
        window.analyzeRepository('https://github.com/SomeOrg/sample', 'dod');
      } else {
        window.TemplateAnalyzer.analyzeTemplate('https://github.com/SomeOrg/sample', 'dod');
      }
    });
    await page.waitForTimeout(1400);

    const forkPosts = networkLog.filter(l => /POST .+\/forks$/.test(l));
    if (forkPosts.length !== 1) {
      // eslint-disable-next-line no-console
      console.error('DEBUG: Expected 1 POST /forks, got', forkPosts.length, 'Network log:', JSON.stringify(networkLog, null, 2));
    }
    expect(forkPosts.length).toBe(1);

    // Capture snapshot of network count
    const beforeSecond = networkLog.length;

    // Second run should reuse (no new fork POST)
    await page.evaluate(() => {
      if (window.analyzeRepository) {
        window.analyzeRepository('https://github.com/SomeOrg/sample', 'dod');
      } else {
        window.TemplateAnalyzer.analyzeTemplate('https://github.com/SomeOrg/sample', 'dod');
      }
    });
    await page.waitForTimeout(600);

    const forkPostsAfter = networkLog.filter(l => /POST .+\/forks$/.test(l));
    if (forkPostsAfter.length !== 1) {
      // eslint-disable-next-line no-console
      console.error('DEBUG: After second run, expected 1 POST /forks, got', forkPostsAfter.length, 'Network log:', JSON.stringify(networkLog, null, 2));
    }
    expect(forkPostsAfter.length).toBe(1); // still only the first
    expect(networkLog.length).toBeLessThanOrEqual(beforeSecond + 3); // limited chatter
  });
});
