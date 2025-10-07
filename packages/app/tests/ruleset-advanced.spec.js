// @ts-nocheck
import { test, expect } from '@playwright/test';

async function openModal(page) {
  await page.goto('/');
  await page.waitForFunction(() => !!window.showRulesetModal, null, { timeout: 30000 });
  // Ensure a stable default config
  await page.evaluate(() => {
    window.TemplateDoctorConfig = Object.assign({}, window.TemplateDoctorConfig || {}, {
      archiveEnabled: false,
      archiveCollection: 'aigallery',
    });
  });
  await page.evaluate(() => window.showRulesetModal('https://github.com/test-owner/test-repo'));
  await expect(page.locator('#ruleset-modal')).toBeVisible();
}

async function getAdvancedStates(page) {
  // Return a map of category -> checked boolean
  return await page.evaluate(() => {
    const q = (val) =>
      !!document.querySelector(`input[name="adv-category"][value="${val}"]`)?.checked;
    return {
      repositoryManagement: q('repositoryManagement'),
      functionalRequirements: q('functionalRequirements'),
      deployment: q('deployment'),
      security: q('security'),
      testing: q('testing'),
    };
  });
}

async function selectPreset(page, preset) {
  await page.locator(`input[name="ruleset"][value="${preset}"]`).check();
}

test.describe('Ruleset modal - Advanced category checkboxes', () => {
  test('DoD preset preselects expected categories', async ({ page }) => {
    await openModal(page);
    // DoD is default, verify state
    const states = await getAdvancedStates(page);
    expect(states).toEqual({
      repositoryManagement: true,
      functionalRequirements: true,
      deployment: true,
      security: true,
      testing: false,
    });
  });

  test('Partner preset selects functional/deployment/security only', async ({ page }) => {
    await openModal(page);
    await selectPreset(page, 'partner');
    const states = await getAdvancedStates(page);
    expect(states).toEqual({
      repositoryManagement: false,
      functionalRequirements: true,
      deployment: true,
      security: true,
      testing: false,
    });
  });

  test('Docs preset selects repo/functional/security only', async ({ page }) => {
    await openModal(page);
    await selectPreset(page, 'docs');
    const states = await getAdvancedStates(page);
    expect(states).toEqual({
      repositoryManagement: true,
      functionalRequirements: true,
      deployment: false,
      security: true,
      testing: false,
    });
  });

  test('Custom preset deselects all categories', async ({ page }) => {
    await openModal(page);
    await selectPreset(page, 'custom');
    const states = await getAdvancedStates(page);
    expect(states).toEqual({
      repositoryManagement: false,
      functionalRequirements: false,
      deployment: false,
      security: false,
      testing: false,
    });
  });

  test.skip('Manual selection is passed to analyze on click', async ({ page }) => {
    await openModal(page);
    // Choose custom then toggle some categories
    await selectPreset(page, 'custom');
    // Toggle testing and repositoryManagement on
    await page.locator('input[name="adv-category"][value="repositoryManagement"]').check();
    await page.locator('input[name="adv-category"][value="testing"]').check();

    // Stub analyzeRepo to capture args
    await page.evaluate(() => {
      window.__lastAnalyzeArgs = null;
      window.analyzeRepo = (repoUrl, ruleSet, selectedCategories) => {
        window.__lastAnalyzeArgs = { repoUrl, ruleSet, selectedCategories };
      };
    });

    // Click Analyze
    await page.locator('#analyze-with-ruleset-btn').click();

    const captured = await page.evaluate(() => window.__lastAnalyzeArgs);
    expect(captured).toBeTruthy();
    expect(captured.ruleSet).toBe('custom');
    expect(captured.selectedCategories).toEqual({
      repositoryManagement: true,
      functionalRequirements: false,
      deployment: false,
      security: false,
      testing: true,
    });
  });
});
