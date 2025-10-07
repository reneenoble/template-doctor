// @ts-nocheck
import { test, expect } from '@playwright/test';
import { enableBatchMode } from './testUtils.js';

async function mockAuthAndDeps(page) {
  await page.evaluate(() => {
    const mockUserInfo = { login: 'test-user', name: 'Test User', avatarUrl: 'x' };
    localStorage.setItem('gh_access_token', 'mock_access_token');
    localStorage.setItem('gh_user_info', JSON.stringify(mockUserInfo));

    // Show search UI
    const searchSection = document.getElementById('search-section');
    const welcomeSection = document.getElementById('welcome-section');
    if (searchSection) searchSection.style.display = 'block';
    if (welcomeSection) welcomeSection.style.display = 'none';

    window.GitHubClient = {
      auth: {
        isAuthenticated: () => true,
        getUsername: () => 'test-user',
        getToken: () => 'mock_access_token',
      },
    };
    window.DashboardRenderer = { render: () => {} };
    window.TemplateAnalyzer = {
      analyzeTemplate: async (url) => ({
        repoUrl: url,
        ruleSet: 'dod',
        timestamp: new Date().toISOString(),
        compliance: { issues: [{ id: 'i1' }], compliant: [{ id: 'p1' }, { id: 'p2' }] },
      }),
    };
    document.dispatchEvent(new Event('template-analyzer-ready'));
  });
}

test.describe('Batch resume and cancel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await mockAuthAndDeps(page);
    // No need to wait for the hidden toggle; we'll force-check when needed
  });

  test('resume skips previously successful items and updates progress', async ({ page }) => {
    await enableBatchMode(page);

    // First run with two URLs: complete first, error second to keep progress
    await page.evaluate(() => {
      const original = window.TemplateAnalyzer.analyzeTemplate;
      window.__failOnce = 'https://github.com/owner/repo-two';
      window.TemplateAnalyzer.analyzeTemplate = async (url, ruleSet) => {
        if (url === window.__failOnce) {
          throw new Error('fail second');
        }
        return original(url, ruleSet);
      };
    });

    await page.fill(
      '#batch-urls',
      'https://github.com/owner/repo-one\nhttps://github.com/owner/repo-two',
    );
    await page.click('#batch-scan-button');
    await expect(page.locator('#batch-items .batch-item')).toHaveCount(2);
    await expect(page.locator('#batch-items .batch-item.success')).toHaveCount(1);
    await expect(page.locator('#batch-items .batch-item.error')).toHaveCount(1);

    // Reload page to simulate return, keep IndexedDB
    await page.reload();
    await mockAuthAndDeps(page);
    await enableBatchMode(page);

    // Clear fail override so both can succeed; choose Resume in confirmation
    await page.evaluate(() => {
      const original = window.TemplateAnalyzer.analyzeTemplate;
      window.TemplateAnalyzer.analyzeTemplate = async (url, ruleSet) => original(url, ruleSet);
    });

    // Intercept the confirmation by clicking Resume action in our notification
    // The app uses NotificationSystem.showConfirmation. Ensure it exists and auto-confirm.
    await page.evaluate(() => {
      const ns = window.NotificationSystem || window.Notifications;
      if (ns && typeof ns.showConfirmation === 'function') {
        const orig = ns.showConfirmation.bind(ns);
        // Auto-select primary action (Resume)
        ns.showConfirmation = (title, message, primaryLabel, secondaryLabel, callback) => {
          setTimeout(() => callback && callback(true), 0);
          return orig(title, message, primaryLabel, secondaryLabel, callback);
        };
      }
    });

    await page.fill(
      '#batch-urls',
      'https://github.com/owner/repo-one\nhttps://github.com/owner/repo-two',
    );
    await page.click('#batch-scan-button');

    // Should mark repo-one as already success and only process repo-two
    await expect(page.locator('#batch-items .batch-item')).toHaveCount(2);
    await expect(page.locator('#batch-items .batch-item.success')).toHaveCount(2);
    await expect(page.locator('#batch-progress-text')).toHaveText(/2\s*\/\s*2\s*Completed/);
  });

  test('cancel stops further processing and shows cancelled notification', async ({ page }) => {
    await enableBatchMode(page);

    // Mock confirm to auto-dismiss resume dialog
    await page.evaluate(() => {
      window.confirm = () => false; // Don't resume, start fresh
    });

    // Slow down analyzer to allow cancel in between
    await page.evaluate(() => {
      const delay = (ms) => new Promise((r) => setTimeout(r, ms));
      const original = window.TemplateAnalyzer.analyzeTemplate;
      window.TemplateAnalyzer.analyzeTemplate = async (url, ruleSet) => {
        await delay(200); // ensure we can click cancel while processing
        return original(url, ruleSet);
      };
    });

    await page.fill(
      '#batch-urls',
      'https://github.com/owner/a\nhttps://github.com/owner/b\nhttps://github.com/owner/c',
    );

    await page.click('#batch-scan-button');

    // Wait for at least one batch item to start processing
    await expect(page.locator('#batch-items .batch-item')).toHaveCount(3, { timeout: 5000 });

    // Give the first scan a moment to start
    await page.waitForTimeout(100);

    // Cancel the batch by calling the exposed function directly
    await page.evaluate(() => {
      if (window.TemplateDoctorBatchScan?.cancelBatch) {
        window.TemplateDoctorBatchScan.cancelBatch();
      }
    });

    // Wait for "Cancelling..." notification
    await page.waitForSelector('.notification:has-text("Cancelling")', { timeout: 3000 });

    // Wait a bit for processing to stop
    await page.waitForTimeout(1000);

    // Verify not all items completed (batch was cancelled mid-way)
    const successCount = await page.locator('#batch-items .batch-item.success').count();
    const errorCount = await page.locator('#batch-items .batch-item.error').count();
    const totalProcessed = successCount + errorCount;

    // With 3 URLs and 200ms delay each, cancelling should stop some from completing
    expect(totalProcessed).toBeLessThan(3);
  });
});
