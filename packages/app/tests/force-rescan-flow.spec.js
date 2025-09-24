// @ts-nocheck
import { test, expect } from '@playwright/test';

/**
 * Force-rescan flow:
 * 1. Initial analysis caches.
 * 2. Second run with force-rescan sentinel triggers fresh fork sync (no reuse) -> expect another merge-upstream POST but no second fork.
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
    await page.route(/https:\/\/api\.github\.com\/.*/, (route) => {
      const req = route.request();
      const url = req.url();
      const method = req.method();
      if (url.startsWith('https://api.github.com')) {
        networkLog.push(method + ' ' + url);
      }
      // Basic mocked endpoints
      if (/\/user$/.test(url)) return route.fulfill({ status: 200, json: { login: 'test-user' } });
      if (/\/repos\/SomeOrg\/sample\/forks$/.test(url) && method === 'POST') return route.fulfill({ status: 202, json: {} });
      if (/\/repos\/test-user\/sample$/.test(url) && method === 'GET') return route.fulfill({ status: 200, json: { name: 'sample', owner: { login: 'test-user' }, default_branch: 'default', fork: true } });
      if (/merge-upstream/.test(url) && method === 'POST') return route.fulfill({ status: 200, json: { merged: true } });
      if (/git\/trees\/main/.test(url)) return route.fulfill({ status: 404, json: { message: 'Not Found' } });
      if (/git\/trees\/default/.test(url)) return route.fulfill({ status: 200, json: { tree: [{ path: 'README.md', type: 'blob' }] } });
      if (/contents\/README\.md$/.test(url)) return route.fulfill({ status: 200, json: { encoding: 'base64', content: Buffer.from('# README').toString('base64') } });
      return route.fulfill({ status: 200, json: {} });
    });

    await page.goto('/');

    // First run to populate
    await page.evaluate(() => {
      if (window.analyzeRepository) window.analyzeRepository('https://github.com/SomeOrg/sample', 'dod');
      else window.TemplateAnalyzer.analyzeTemplate('https://github.com/SomeOrg/sample', 'dod');
    });
    await page.waitForTimeout(1400);

    const forkPostsFirst = networkLog.filter(l => l.includes('POST https://api.github.com/repos/SomeOrg/sample/forks'));
    expect(forkPostsFirst.length).toBe(1);

    // Second run with force-rescan sentinel
    const beforeSecond = networkLog.length;
    await page.evaluate(() => {
      if (window.analyzeRepository) window.analyzeRepository('https://github.com/SomeOrg/sample', 'force-rescan');
      else window.TemplateAnalyzer.analyzeTemplate('https://github.com/SomeOrg/sample?fork=1', 'dod');
    });
    await page.waitForTimeout(1400);

    // Should NOT add a second fork POST
    const forkPostsAfter = networkLog.filter(l => l.includes('POST https://api.github.com/repos/SomeOrg/sample/forks'));
    expect(forkPostsAfter.length).toBe(1);

    // But should have at least one merge-upstream sync attempt (existing fork path)
    const mergeCalls = networkLog.filter(l => l.includes('/merge-upstream'));
    expect(mergeCalls.length).toBeGreaterThanOrEqual(1);
    expect(networkLog.length).toBeGreaterThan(beforeSecond); // new network due to fresh analysis
  });
});
