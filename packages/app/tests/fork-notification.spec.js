// @ts-nocheck
import { test, expect } from '@playwright/test';

test.describe('Fork notification before analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Mock authentication
    await page.evaluate(() => {
      window.GitHubClient = window.GitHubClient || {};
      window.GitHubClient.auth = {
        isAuthenticated: () => true,
        getAccessToken: () => 'mock-token',
      };
      window.GitHubClient.getCurrentUsername = () => 'testuser';
    });

    // Ensure NotificationSystem is available
    await page.waitForFunction(() => !!window.NotificationSystem);
  });

  test('shows fork notification when analyzing repo owned by another user', async ({ page }) => {
    // Set up mock for analyzing external repo
    await page.evaluate(() => {
      window.GitHubClient.getDefaultBranch = async () => 'main';
      window.GitHubClient.listFiles = async () => [{ path: 'README.md', type: 'file' }];
      window.GitHubClient.getFileContent = async () => '# Test';
    });

    // Spy on NotificationSystem.showInfo
    const notificationPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const originalShowInfo = window.NotificationSystem.showInfo;
        window.NotificationSystem.showInfo = function (title, message, duration) {
          resolve({ title, message, duration });
          return originalShowInfo.call(this, title, message, duration);
        };
      });
    });

    // Trigger analysis of external repo (owner !== testuser)
    await page.evaluate(() => {
      if (typeof window.analyzeRepo === 'function') {
        window.analyzeRepo('https://github.com/otheruser/some-repo');
      } else if (typeof window.internalAnalyzeRepo === 'function') {
        window.internalAnalyzeRepo('https://github.com/otheruser/some-repo');
      }
    });

    // Wait for notification
    const notification = await notificationPromise;

    expect(notification.title).toBe('Fork-First Analysis');
    expect(notification.message).toContain('fork');
    expect(notification.message).toContain('testuser');
    expect(notification.duration).toBe(6000);
  });

  test('does not show fork notification when analyzing own repo', async ({ page }) => {
    // Track if showInfo was called
    await page.evaluate(() => {
      window.__notificationCalled = false;
      const originalShowInfo = window.NotificationSystem.showInfo;
      window.NotificationSystem.showInfo = function (title, message, duration) {
        if (title === 'Fork-First Analysis') {
          window.__notificationCalled = true;
        }
        return originalShowInfo.call(this, title, message, duration);
      };
    });

    // Set up mock for analyzing own repo
    await page.evaluate(() => {
      window.GitHubClient.getDefaultBranch = async () => 'main';
      window.GitHubClient.listFiles = async () => [{ path: 'README.md', type: 'file' }];
      window.GitHubClient.getFileContent = async () => '# Test';
    });

    // Trigger analysis of own repo (owner === testuser)
    await page.evaluate(() => {
      if (typeof window.analyzeRepo === 'function') {
        window.analyzeRepo('https://github.com/testuser/my-repo');
      } else if (typeof window.internalAnalyzeRepo === 'function') {
        window.internalAnalyzeRepo('https://github.com/testuser/my-repo');
      }
    });

    // Wait a bit and verify notification was not called
    await page.waitForTimeout(500);

    const notificationCalled = await page.evaluate(() => window.__notificationCalled);
    expect(notificationCalled).toBe(false);
  });

  test('does not show fork notification when not authenticated', async ({ page }) => {
    // Override authentication to be false
    await page.evaluate(() => {
      window.GitHubClient.auth = {
        isAuthenticated: () => false,
        getAccessToken: () => null,
      };
      window.__notificationCalled = false;
      const originalShowInfo = window.NotificationSystem.showInfo;
      window.NotificationSystem.showInfo = function (title, message, duration) {
        if (title === 'Fork-First Analysis') {
          window.__notificationCalled = true;
        }
        return originalShowInfo.call(this, title, message, duration);
      };
    });

    // Trigger analysis
    await page.evaluate(() => {
      if (typeof window.analyzeRepo === 'function') {
        window.analyzeRepo('https://github.com/otheruser/some-repo');
      } else if (typeof window.internalAnalyzeRepo === 'function') {
        window.internalAnalyzeRepo('https://github.com/otheruser/some-repo');
      }
    });

    await page.waitForTimeout(500);

    const notificationCalled = await page.evaluate(() => window.__notificationCalled);
    expect(notificationCalled).toBe(false);
  });

  test('fork notification displays in UI with correct styling', async ({ page }) => {
    // Set up mock
    await page.evaluate(() => {
      window.GitHubClient.getDefaultBranch = async () => 'main';
      window.GitHubClient.listFiles = async () => [{ path: 'README.md', type: 'file' }];
      window.GitHubClient.getFileContent = async () => '# Test';
    });

    // Trigger analysis of external repo
    await page.evaluate(() => {
      if (typeof window.analyzeRepo === 'function') {
        window.analyzeRepo('https://github.com/microsoft/template-doctor');
      } else if (typeof window.internalAnalyzeRepo === 'function') {
        window.internalAnalyzeRepo('https://github.com/microsoft/template-doctor');
      }
    });

    // Wait for notification to appear in DOM
    const notification = page
      .locator('.notification.info')
      .filter({ hasText: 'Fork-First Analysis' });
    await expect(notification).toBeVisible({ timeout: 2000 });

    // Verify content
    await expect(notification).toContainText('Fork-First Analysis');
    await expect(notification).toContainText('fork');
  });

  test('fork notification auto-dismisses after 6 seconds', async ({ page }) => {
    // Set up mock
    await page.evaluate(() => {
      window.GitHubClient.getDefaultBranch = async () => 'main';
      window.GitHubClient.listFiles = async () => [{ path: 'README.md', type: 'file' }];
      window.GitHubClient.getFileContent = async () => '# Test';
    });

    // Trigger analysis
    await page.evaluate(() => {
      if (typeof window.analyzeRepo === 'function') {
        window.analyzeRepo('https://github.com/otheruser/test-repo');
      } else if (typeof window.internalAnalyzeRepo === 'function') {
        window.internalAnalyzeRepo('https://github.com/otheruser/test-repo');
      }
    });

    // Wait for notification to appear
    const notification = page
      .locator('.notification.info')
      .filter({ hasText: 'Fork-First Analysis' });
    await expect(notification).toBeVisible({ timeout: 2000 });

    // Wait for it to auto-dismiss (6 seconds + buffer)
    await expect(notification).not.toBeVisible({ timeout: 7000 });
  });

  test('handles case-insensitive username comparison', async ({ page }) => {
    // Set username with uppercase
    await page.evaluate(() => {
      window.GitHubClient.getCurrentUsername = () => 'TestUser';
      window.__notificationCalled = false;
      const originalShowInfo = window.NotificationSystem.showInfo;
      window.NotificationSystem.showInfo = function (title, message, duration) {
        if (title === 'Fork-First Analysis') {
          window.__notificationCalled = true;
        }
        return originalShowInfo.call(this, title, message, duration);
      };
    });

    // Set up mock
    await page.evaluate(() => {
      window.GitHubClient.getDefaultBranch = async () => 'main';
      window.GitHubClient.listFiles = async () => [{ path: 'README.md', type: 'file' }];
      window.GitHubClient.getFileContent = async () => '# Test';
    });

    // Analyze repo with lowercase username (should not show notification)
    await page.evaluate(() => {
      if (typeof window.analyzeRepo === 'function') {
        window.analyzeRepo('https://github.com/testuser/my-repo');
      } else if (typeof window.internalAnalyzeRepo === 'function') {
        window.internalAnalyzeRepo('https://github.com/testuser/my-repo');
      }
    });

    await page.waitForTimeout(500);

    const notificationCalled = await page.evaluate(() => window.__notificationCalled);
    expect(notificationCalled).toBe(false);
  });
});
