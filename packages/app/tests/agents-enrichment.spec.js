// @ts-nocheck
import { test, expect } from '@playwright/test';

test.describe('AGENTS.md enrichment', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Wait for dashboard renderer to load
    await page.waitForFunction(() => !!window.DashboardRenderer);
  });

  test('shows "Agents: Missing" badge when agents.md is not found', async ({ page }) => {
    // Mock fetch to return 404 for agents.md
    await page.route('**/*agents.md*', (route) => {
      route.fulfill({ status: 404, body: 'Not Found' });
    });

    const mockResult = {
      repoUrl: 'https://github.com/test/repo',
      ruleSet: 'dod',
      compliance: {
        issues: [],
        compliant: [],
        percentage: 100,
        summary: '100% compliant',
        categories: {
          repositoryManagement: { enabled: true, issues: [], compliant: [], percentage: 0 },
          functionalRequirements: { enabled: true, issues: [], compliant: [], percentage: 0 },
          deployment: { enabled: true, issues: [], compliant: [], percentage: 0 },
          security: { enabled: true, issues: [], compliant: [], percentage: 0 },
          testing: { enabled: true, issues: [], compliant: [], percentage: 0 },
          agents: { enabled: true, issues: [], compliant: [], percentage: 0 },
        },
      },
    };

    await page.evaluate((result) => {
      const container = document.getElementById('dashboard') || document.body;
      if (window.DashboardRenderer) {
        window.DashboardRenderer.render(result, container);
      }
    }, mockResult);

    // Wait for agents enrichment to complete
    await page.waitForTimeout(1500);

    // Verify "Agents: Missing" badge appears
    const badge = page.locator('#agents-status-badge');
    await expect(badge).toBeVisible({ timeout: 3000 });
    await expect(badge).toHaveText('Agents: Missing');

    // Verify badge styling (red background)
    const bgColor = await badge.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bgColor).toContain('217'); // #d9534f contains rgb(217, 83, 79)
  });

  test('shows "Agents: Invalid" badge when agents.md has formatting issues', async ({ page }) => {
    // Mock fetch to return invalid agents.md
    const invalidAgentsMd = `
# Invalid Agents

This is missing the proper table structure.
`;

    await page.route('**/*agents.md*', (route) => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: invalidAgentsMd,
      });
    });

    const mockResult = {
      repoUrl: 'https://github.com/test/repo',
      ruleSet: 'dod',
      compliance: {
        issues: [],
        compliant: [],
        percentage: 100,
        summary: '100% compliant',
        categories: {
          repositoryManagement: { enabled: true, issues: [], compliant: [], percentage: 0 },
          functionalRequirements: { enabled: true, issues: [], compliant: [], percentage: 0 },
          deployment: { enabled: true, issues: [], compliant: [], percentage: 0 },
          security: { enabled: true, issues: [], compliant: [], percentage: 0 },
          testing: { enabled: true, issues: [], compliant: [], percentage: 0 },
          agents: { enabled: true, issues: [], compliant: [], percentage: 0 },
        },
      },
    };

    await page.evaluate((result) => {
      const container = document.getElementById('dashboard') || document.body;
      if (window.DashboardRenderer) {
        window.DashboardRenderer.render(result, container);
      }
    }, mockResult);

    // Wait for agents enrichment
    await page.waitForTimeout(1500);

    // Verify "Agents: Invalid" badge
    const badge = page.locator('#agents-status-badge');
    await expect(badge).toBeVisible({ timeout: 3000 });
    await expect(badge).toHaveText('Agents: Invalid');

    // Verify badge styling (orange background)
    const bgColor = await badge.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bgColor).toContain('240'); // #f0ad4ff0 contains #f0ad4eff
  });

  test('shows "Agents: OK" badge when agents.md is valid', async ({ page }) => {
    // Mock fetch to return valid agents.md
    const validAgentsMd = `
# My Agents

## Agents

| name | description | inputs | outputs | permissions |
|------|-------------|--------|---------|-------------|
| Agent1 | Does stuff | input1 | output1 | read |
| Agent2 | Does more | input2 | output2 | write |
`;

    await page.route('**/*agents.md*', (route) => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: validAgentsMd,
      });
    });

    const mockResult = {
      repoUrl: 'https://github.com/test/repo',
      ruleSet: 'dod',
      compliance: {
        issues: [],
        compliant: [],
        percentage: 100,
        summary: '100% compliant',
        categories: {
          repositoryManagement: { enabled: true, issues: [], compliant: [], percentage: 0 },
          functionalRequirements: { enabled: true, issues: [], compliant: [], percentage: 0 },
          deployment: { enabled: true, issues: [], compliant: [], percentage: 0 },
          security: { enabled: true, issues: [], compliant: [], percentage: 0 },
          testing: { enabled: true, issues: [], compliant: [], percentage: 0 },
          agents: { enabled: true, issues: [], compliant: [], percentage: 0 },
        },
      },
    };

    await page.evaluate((result) => {
      const container = document.getElementById('dashboard') || document.body;
      if (window.DashboardRenderer) {
        window.DashboardRenderer.render(result, container);
      }
    }, mockResult);

    // Wait for agents enrichment
    await page.waitForTimeout(1500);

    // Verify "Agents: Valid" badge
    const badge = page.locator('#agents-status-badge');
    await expect(badge).toBeVisible({ timeout: 3000 });
    await expect(badge).toHaveText('Agents: Valid');

    // Verify badge styling (green background)
    const bgColor = await badge.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bgColor).toContain('40'); // #28a745 contains rgb(40, 167, 69)
  });

  test('updates agents tile styling when agents.md is missing', async ({ page }) => {
    await page.route('**/*agents.md*', (route) => {
      route.fulfill({ status: 404, body: 'Not Found' });
    });

    const mockResult = {
      repoUrl: 'https://github.com/test/repo',
      ruleSet: 'dod',
      compliance: {
        issues: [],
        compliant: [],
        percentage: 100,
        summary: '100% compliant',
        categories: {
          repositoryManagement: { enabled: true, issues: [], compliant: [], percentage: 0 },
          functionalRequirements: { enabled: true, issues: [], compliant: [], percentage: 0 },
          deployment: { enabled: true, issues: [], compliant: [], percentage: 0 },
          security: { enabled: true, issues: [], compliant: [], percentage: 0 },
          testing: { enabled: true, issues: [], compliant: [], percentage: 0 },
          agents: { enabled: true, issues: [], compliant: [], percentage: 0 },
        },
      },
    };

    await page.evaluate((result) => {
      const container = document.getElementById('dashboard') || document.body;
      if (window.DashboardRenderer) {
        window.DashboardRenderer.render(result, container);
      }
    }, mockResult);

    await page.waitForTimeout(1500);

    // Verify agents tile has red styling
    const agentsTile = page.locator('.category-breakdown .tile[data-category="agents"]');
    await expect(agentsTile).toBeVisible();

    const bgColor = await agentsTile.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    // #ffe5e5 is light red rgb(255, 229, 229)
    expect(bgColor).toContain('255');
  });

  test('adds "Create agents.md Issue" button when agents.md is missing', async ({ page }) => {
    await page.route('**/*agents.md*', (route) => {
      route.fulfill({ status: 404, body: 'Not Found' });
    });

    const mockResult = {
      repoUrl: 'https://github.com/test/repo',
      ruleSet: 'dod',
      compliance: {
        issues: [],
        compliant: [],
        percentage: 100,
        summary: '100% compliant',
        categories: {
          repositoryManagement: { enabled: true, issues: [], compliant: [], percentage: 0 },
          functionalRequirements: { enabled: true, issues: [], compliant: [], percentage: 0 },
          deployment: { enabled: true, issues: [], compliant: [], percentage: 0 },
          security: { enabled: true, issues: [], compliant: [], percentage: 0 },
          testing: { enabled: true, issues: [], compliant: [], percentage: 0 },
          agents: { enabled: true, issues: [], compliant: [], percentage: 0 },
        },
      },
    };

    await page.evaluate((result) => {
      const container = document.getElementById('dashboard') || document.body;
      if (window.DashboardRenderer) {
        window.DashboardRenderer.render(result, container);
      }
    }, mockResult);

    await page.waitForTimeout(1500);

    // Verify action button exists
    const actionBtn = page.locator(
      '.category-breakdown .tile[data-category="agents"] .agents-action',
    );
    await expect(actionBtn).toBeVisible({ timeout: 3000 });
    await expect(actionBtn).toContainText('Create agents.md Issue');
  });

  test('uses sessionStorage cache for repeated checks', async ({ page }) => {
    const validAgentsMd = `
# My Agents

## Agents

| name | description | inputs | outputs | permissions |
|------|-------------|--------|---------|-------------|
| Agent1 | Does stuff | input1 | output1 | read |
`;

    let fetchCount = 0;
    await page.route('**/*agents.md*', (route) => {
      fetchCount++;
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: validAgentsMd,
      });
    });

    const mockResult = {
      repoUrl: 'https://github.com/test/repo',
      ruleSet: 'dod',
      compliance: {
        issues: [],
        compliant: [],
        percentage: 100,
        summary: '100% compliant',
        categories: {
          repositoryManagement: { enabled: true, issues: [], compliant: [], percentage: 0 },
          functionalRequirements: { enabled: true, issues: [], compliant: [], percentage: 0 },
          deployment: { enabled: true, issues: [], compliant: [], percentage: 0 },
          security: { enabled: true, issues: [], compliant: [], percentage: 0 },
          testing: { enabled: true, issues: [], compliant: [], percentage: 0 },
          agents: { enabled: true, issues: [], compliant: [], percentage: 0 },
        },
      },
    };

    // First render - should fetch
    await page.evaluate((result) => {
      const container = document.getElementById('dashboard') || document.body;
      if (window.DashboardRenderer) {
        window.DashboardRenderer.render(result, container);
      }
    }, mockResult);

    await page.waitForTimeout(1500);

    // Verify badge appeared
    await expect(page.locator('#agents-status-badge')).toBeVisible();

    // Second render - should use cache
    await page.evaluate((result) => {
      const container = document.getElementById('dashboard') || document.body;
      container.innerHTML = ''; // Clear
      if (window.DashboardRenderer) {
        window.DashboardRenderer.render(result, container);
      }
    }, mockResult);

    await page.waitForTimeout(1500);

    // Verify badge still appears
    await expect(page.locator('#agents-status-badge')).toBeVisible();

    // Verify fetch was called only once (cache worked)
    // Note: Due to CDN fallback, might be called 1-2 times, not 4 times (2 renders × 2 URLs)
    expect(fetchCount).toBeLessThanOrEqual(2);
  });

  test('validates required table columns (name, description, inputs, outputs, permissions)', async ({
    page,
  }) => {
    // Missing 'outputs' column
    const incompleteAgentsMd = `
# My Agents

## Agents

| name | description | inputs | permissions |
|------|-------------|--------|-------------|
| Agent1 | Does stuff | input1 | read |
`;

    await page.route('**/*agents.md*', (route) => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: incompleteAgentsMd,
      });
    });

    const mockResult = {
      repoUrl: 'https://github.com/test/repo',
      ruleSet: 'dod',
      compliance: {
        issues: [],
        compliant: [],
        percentage: 100,
        summary: '100% compliant',
        categories: {
          repositoryManagement: { enabled: true, issues: [], compliant: [], percentage: 0 },
          functionalRequirements: { enabled: true, issues: [], compliant: [], percentage: 0 },
          deployment: { enabled: true, issues: [], compliant: [], percentage: 0 },
          security: { enabled: true, issues: [], compliant: [], percentage: 0 },
          testing: { enabled: true, issues: [], compliant: [], percentage: 0 },
          agents: { enabled: true, issues: [], compliant: [], percentage: 0 },
        },
      },
    };

    await page.evaluate((result) => {
      const container = document.getElementById('dashboard') || document.body;
      if (window.DashboardRenderer) {
        window.DashboardRenderer.render(result, container);
      }
    }, mockResult);

    await page.waitForTimeout(1500);

    // Should show Invalid badge due to missing column
    const badge = page.locator('#agents-status-badge');
    await expect(badge).toBeVisible({ timeout: 3000 });
    await expect(badge).toHaveText('Agents: Invalid');
  });

  test('skips enrichment when agents category already exists from backend', async ({ page }) => {
    let fetchCalled = false;
    await page.route('**/*agents.md*', (route) => {
      fetchCalled = true;
      route.fulfill({ status: 200, body: 'mock' });
    });

    // Include agents items from backend
    const mockResult = {
      repoUrl: 'https://github.com/test/repo',
      ruleSet: 'dod',
      compliance: {
        issues: [
          {
            id: 'agents-missing-file',
            category: 'agents',
            message: 'agents.md missing (from backend)',
          },
        ],
        compliant: [],
        percentage: 0,
        summary: '0% compliant',
        categories: {
          repositoryManagement: { enabled: true, issues: [], compliant: [], percentage: 0 },
          functionalRequirements: { enabled: true, issues: [], compliant: [], percentage: 0 },
          deployment: { enabled: true, issues: [], compliant: [], percentage: 0 },
          security: { enabled: true, issues: [], compliant: [], percentage: 0 },
          testing: { enabled: true, issues: [], compliant: [], percentage: 0 },
          agents: {
            enabled: true,
            issues: [
              {
                id: 'agents-missing-file',
                category: 'agents',
                message: 'agents.md missing (from backend)',
              },
            ],
            compliant: [],
            percentage: 0,
          },
        },
      },
    };

    await page.evaluate((result) => {
      const container = document.getElementById('dashboard') || document.body;
      if (window.DashboardRenderer) {
        window.DashboardRenderer.render(result, container);
      }
    }, mockResult);

    await page.waitForTimeout(1500);

    // Fetch should not be called because backend already provided agents data
    expect(fetchCalled).toBe(false);
  });
});
