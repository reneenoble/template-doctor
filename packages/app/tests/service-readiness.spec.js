// @ts-nocheck
import { test, expect } from '@playwright/test';

async function forceResetServices(page) {
  await page.evaluate(() => {
    // Remove any existing banner so we can assert re-creation
    const existing = document.getElementById('service-init-message');
    if (existing) existing.remove();
    window.TemplateAnalyzer = undefined;
    window.DashboardRenderer = undefined;
    window.GitHubClient = undefined;
  });
}

test.describe('Service readiness poller & queue drain', () => {
  test('shows initialization banner then removes it when services appear', async ({ page }) => {
    await page.goto('/');
    await forceResetServices(page);

    await page.evaluate(() => {
      // Provide a notification system stub to avoid errors
      if (!window.NotificationSystem) {
        window.NotificationSystem = {
          showSuccess: () => {},
          showError: () => {},
          showWarning: () => {},
        };
      }
      if (window.TemplateDoctorServiceReadiness) {
        window.TemplateDoctorServiceReadiness.pollForServiceReadiness(10, 80);
      }
      setTimeout(() => {
        window.TemplateAnalyzer = { ready: true };
        window.DashboardRenderer = { render: () => {} };
        window.GitHubClient = { auth: { isAuthenticated: () => true } };
      }, 250);
    });

    await page.waitForSelector('#service-init-message');
    await page.waitForSelector('#service-init-message', { state: 'detached', timeout: 8000 });
  });

  test('drains queued analysis requests after readiness', async ({ page }) => {
    await page.goto('/');
    await forceResetServices(page);

    await page.evaluate(() => {
      window.__ANALYZE_CALLS = [];
      const originalAnalyze = window.analyzeRepo;
      window.analyzeRepo = function (repoUrl, ruleSet, categories) {
        window.__ANALYZE_CALLS.push({ repoUrl, ruleSet });
        return Promise.resolve({ ok: true });
      };
      if (window.TemplateDoctorAnalysisQueue && window.TemplateDoctorAnalysisQueue.enqueue) {
        window.TemplateDoctorAnalysisQueue.enqueue({
          repoUrl: 'https://github.com/test-owner/test-repo',
          ruleSet: 'dod',
          selectedCategories: null,
        });
      } else {
        (window.__TD_FALLBACK_PENDING = window.__TD_FALLBACK_PENDING || []).push({
          repoUrl: 'https://github.com/test-owner/test-repo',
          ruleSet: 'dod',
          selectedCategories: null,
        });
      }
      if (!window.NotificationSystem) {
        window.NotificationSystem = {
          showSuccess: () => {},
          showError: () => {},
          showWarning: () => {},
        };
      }
      if (window.TemplateDoctorServiceReadiness) {
        window.TemplateDoctorServiceReadiness.pollForServiceReadiness(12, 70);
      }
      setTimeout(() => {
        window.TemplateAnalyzer = { ready: true };
        window.DashboardRenderer = { render: () => {} };
        window.GitHubClient = { auth: { isAuthenticated: () => true } };
      }, 300);
    });

    await page.waitForFunction(
      () => Array.isArray(window.__ANALYZE_CALLS) && window.__ANALYZE_CALLS.length > 0,
      undefined,
      { timeout: 9000 },
    );
    const calls = await page.evaluate(() => window.__ANALYZE_CALLS);
    expect(calls[0].repoUrl).toBe('https://github.com/test-owner/test-repo');
  });
});
