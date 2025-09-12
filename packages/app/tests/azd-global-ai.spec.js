// @ts-nocheck
import { test, expect } from '@playwright/test';

async function openModal(page, repoUrl = 'https://github.com/test-owner/test-repo') {
  await page.goto('/');
  await page.waitForFunction(() => !!window.showRulesetModal, null, { timeout: 30000 });
}

test.describe('AZD global switch and AI check behavior', () => {
  test('Global checks section hidden when azureDeveloperCliEnabled=false', async ({ page }) => {
    await openModal(page);
    await page.evaluate(() => {
      window.TemplateDoctorConfig = Object.assign({}, window.TemplateDoctorConfig || {}, {
        azureDeveloperCliEnabled: false,
      });
    });
    await page.evaluate(() => window.showRulesetModal('https://github.com/test-owner/test-repo'));
    await expect(page.locator('#ruleset-modal')).toBeVisible();
    await expect(page.locator('#global-checks')).toBeHidden();
  });

  test('Global checks section visible when azureDeveloperCliEnabled=true', async ({ page }) => {
    await openModal(page);
    await page.evaluate(() => {
      window.TemplateDoctorConfig = Object.assign({}, window.TemplateDoctorConfig || {}, {
        azureDeveloperCliEnabled: true,
      });
    });
    await page.evaluate(() => window.showRulesetModal('https://github.com/test-owner/test-repo'));
    await expect(page.locator('#ruleset-modal')).toBeVisible();
    await expect(page.locator('#global-checks')).toBeVisible();
    await expect(page.locator('#ai-deprecation-toggle')).toBeVisible();
  });

  test('AI category appears in results when enabled and azure.yaml present', async ({ page }) => {
    await openModal(page);
    // Force AZD on and AI toggle on
    await page.evaluate(() => {
      window.TemplateDoctorConfig = Object.assign({}, window.TemplateDoctorConfig || {}, {
        azureDeveloperCliEnabled: true,
        aiDeprecationCheckEnabled: true,
      });
    });

    // Stub GitHubClient with an azure.yaml and a simple repo content
    await page.evaluate(() => {
      window.GitHubClient = {
        async getDefaultBranch() { return 'main'; },
        async listAllFiles() {
          return ['azure.yaml', 'README.md'];
        },
        async getFileContent(owner, repo, path) {
          if (path === 'azure.yaml') return 'name: sample\nservices:\n  web:';
          if (path === 'README.md') return '# Readme';
          return '';
        },
        auth: { isAuthenticated() { return true; } },
      };
    });

    // Trigger analysis through the analyzer directly to inspect result
    await page.waitForFunction(() => !!window.TemplateAnalyzer || !!window.checkAnalyzerReady);
    await page.evaluate(() => window.checkAnalyzerReady && window.checkAnalyzerReady());
    const result = await page.evaluate(async () => {
      return await window.TemplateAnalyzer.analyzeTemplate('https://github.com/o/r');
    });

    expect(result).toBeTruthy();
    expect(result.compliance.categories.ai).toBeTruthy();
    // Either compliant or issue should be present (depending on repo content)
    const aiCat = result.compliance.categories.ai;
    expect(Array.isArray(aiCat.issues)).toBeTruthy();
    expect(Array.isArray(aiCat.compliant)).toBeTruthy();
  });
});
