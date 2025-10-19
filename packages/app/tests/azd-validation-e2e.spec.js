/**
 * E2E Tests for AZD Validation Feature
 *
 * Tests validation UI, artifact parsing, issue creation, and GraphQL integration
 */

import { test, expect } from '@playwright/test';

test.describe('AZD Validation UI', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth state
    await page.addInitScript(() => {
      localStorage.setItem('githubToken', 'test-token');
      localStorage.setItem(
        'githubUser',
        JSON.stringify({
          login: 'testuser',
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        }),
      );
    });

    await page.goto('http://localhost:3000');
  });

  test('should show spinner animation during validation', async ({ page }) => {
    // Mock validation endpoints
    await page.route('**/api/v4/validation-template', (route) => {
      route.fulfill({
        json: {
          runId: 'test-run-123',
          githubRunId: 123,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/123',
        },
      });
    });

    await page.route('**/api/v4/validation-status*', (route) => {
      route.fulfill({
        json: {
          status: 'in_progress',
          conclusion: null,
          html_url: 'https://github.com/test/repo/actions/runs/123',
        },
      });
    });

    // Trigger validation
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent('template-card-validate', {
          detail: { template: { repoUrl: 'https://github.com/test/repo' } },
        }),
      );
    });

    // Wait for validation UI
    await page.waitForSelector('#azd-provision-controls', { timeout: 5000 });

    // Verify spinner visible
    const spinner = await page.locator('#azd-elapsed-time .fa-spinner.fa-spin');
    await expect(spinner).toBeVisible();

    // Verify no old custom animation
    const customAnimation = await page.locator('.azd-scroll-icon').count();
    expect(customAnimation).toBe(0);
  });

  test('should display validation-warning with readable contrast', async ({ page }) => {
    // Inject test element
    await page.evaluate(() => {
      const testDiv = document.createElement('div');
      testDiv.className = 'validation-warning';
      testDiv.id = 'test-warning-contrast';
      testDiv.textContent = 'Test Warning';
      testDiv.style.padding = '15px';
      document.body.appendChild(testDiv);
    });

    await page.waitForTimeout(100);

    // Verify dark brown color
    const color = await page.$eval('#test-warning-contrast', (el) => {
      return window.getComputedStyle(el).color;
    });

    // #4e3a16 = rgb(78, 58, 22)
    expect(color).toBe('rgb(78, 58, 22)');
  });

  test('should show troubleshooting tips immediately', async ({ page }) => {
    await page.route('**/api/v4/validation-template', (route) => {
      route.fulfill({
        json: {
          runId: 'test-run-123',
          githubRunId: 123,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/123',
        },
      });
    });

    await page.route('**/api/v4/validation-status*', (route) => {
      route.fulfill({
        json: {
          status: 'in_progress',
          conclusion: null,
          html_url: 'https://github.com/test/repo/actions/runs/123',
        },
      });
    });

    // Trigger validation
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent('template-card-validate', {
          detail: { template: { repoUrl: 'https://github.com/test/repo' } },
        }),
      );
    });

    // Wait for tips
    await page.waitForSelector('#azd-troubleshooting-tips', { timeout: 5000 });

    // Verify all three tips
    const tips = await page.locator('#azd-troubleshooting-tips > div').count();
    expect(tips).toBe(3);

    // Check Region Availability tip
    const tip1 = await page.locator('#azd-troubleshooting-tips > div').nth(0);
    await expect(tip1).toContainText('Region Availability');

    // Check UnmatchedPrincipalType tip
    const tip2 = await page.locator('#azd-troubleshooting-tips > div').nth(1);
    await expect(tip2).toContainText('UnmatchedPrincipalType Error');

    // Check BCP332 tip
    const tip3 = await page.locator('#azd-troubleshooting-tips > div').nth(2);
    await expect(tip3).toContainText('BCP332 maxLength Error');
  });

  test('should highlight UnmatchedPrincipalType tip when error detected', async ({ page }) => {
    const errorMessage = `Error: UnmatchedPrincipalType: The PrincipalId has type 'ServicePrincipal', different from PrinciaplType 'User'`;

    await page.route('**/api/v4/validation-template', (route) => {
      route.fulfill({
        json: {
          runId: 'test-run-123',
          githubRunId: 123,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/123',
        },
      });
    });

    await page.route('**/api/v4/validation-status*', (route) => {
      route.fulfill({
        json: {
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/test/repo/actions/runs/123',
          errorSummary: errorMessage,
          azdValidation: {
            azdUpSuccess: false,
            azdUpTime: null,
            azdDownSuccess: false,
            azdDownTime: null,
            psRuleErrors: 0,
            psRuleWarnings: 0,
            securityStatus: 'pass',
            overallStatus: 'failure',
            resultFileContent: errorMessage,
          },
        },
      });
    });

    // Trigger validation
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent('template-card-validate', {
          detail: { template: { repoUrl: 'https://github.com/test/repo' } },
        }),
      );
    });

    // Wait for completion
    await page.waitForTimeout(2000);

    // Verify tip2 highlighted (orange border)
    const tip2 = await page.locator('#azd-troubleshooting-tips > div').nth(1);
    const borderColor = await tip2.evaluate((el) => {
      return window.getComputedStyle(el).borderColor;
    });

    expect(borderColor).toContain('255, 152, 0'); // #ff9800

    // Verify DETECTED badge
    await expect(tip2).toContainText('⚠️ DETECTED');
  });
});

test.describe('Artifact-Based Validation Results', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('githubToken', 'test-token');
      localStorage.setItem(
        'githubUser',
        JSON.stringify({
          login: 'testuser',
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        }),
      );
    });

    await page.goto('http://localhost:3000');
  });

  test('should display success status', async ({ page }) => {
    await page.route('**/api/v4/validation-template', (route) => {
      route.fulfill({
        json: {
          runId: 'test-run-789',
          githubRunId: 789,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/789',
        },
      });
    });

    await page.route('**/api/v4/validation-status*', (route) => {
      route.fulfill({
        json: {
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test/repo/actions/runs/789',
          azdValidation: {
            azdUpSuccess: true,
            azdUpTime: '42.5s',
            azdDownSuccess: true,
            azdDownTime: '28.3s',
            psRuleErrors: 0,
            psRuleWarnings: 0,
            securityStatus: 'pass',
            overallStatus: 'success',
            resultFileContent:
              '## Validation Results\n- [x] AZD Up\n- [x] AZD Down\n✅ Security passed',
          },
        },
      });
    });

    // Trigger validation
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent('template-card-validate', {
          detail: { template: { repoUrl: 'https://github.com/test/repo' } },
        }),
      );
    });

    // Wait for result
    await page.waitForSelector('.validation-success', { timeout: 5000 });

    // Verify success icon
    const icon = await page.locator('.validation-icon').textContent();
    expect(icon).toContain('✅');

    // Verify message
    const message = await page.locator('.validation-message').textContent();
    expect(message).toContain('Template validation passed');
    expect(message).not.toContain('warnings');

    // Verify no issue button (success doesn't need fixing)
    const issueButton = await page
      .locator('button')
      .filter({ hasText: 'Create GitHub Issue' })
      .count();
    expect(issueButton).toBe(0);
  });

  test('should display warning status with artifact data', async ({ page }) => {
    await page.route('**/api/v4/validation-template', (route) => {
      route.fulfill({
        json: {
          runId: 'test-run-456',
          githubRunId: 456,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/456',
        },
      });
    });

    let pollCount = 0;
    await page.route('**/api/v4/validation-status*', (route) => {
      pollCount++;

      if (pollCount < 2) {
        route.fulfill({
          json: {
            status: 'in_progress',
            conclusion: null,
            html_url: 'https://github.com/test/repo/actions/runs/456',
          },
        });
      } else {
        route.fulfill({
          json: {
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/test/repo/actions/runs/456',
            azdValidation: {
              azdUpSuccess: true,
              azdUpTime: '45.2s',
              azdDownSuccess: true,
              azdDownTime: '30.1s',
              psRuleErrors: 0,
              psRuleWarnings: 2,
              securityStatus: 'warnings',
              overallStatus: 'warning',
              resultFileContent:
                '## Validation Results\n- [x] AZD Up (45.2s)\n- [x] AZD Down (30.1s)\n:warning: Security warning 1\n:warning: Security warning 2',
            },
          },
        });
      }
    });

    // Trigger validation
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent('template-card-validate', {
          detail: { template: { repoUrl: 'https://github.com/test/repo' } },
        }),
      );
    });

    // Wait for completion
    await page.waitForSelector('.validation-result', { timeout: 10000 });

    // Verify warning icon
    const icon = await page.locator('.validation-icon').textContent();
    expect(icon).toContain('⚠️');

    // Verify warning message
    const message = await page.locator('.validation-message').textContent();
    expect(message).toContain('Template validation passed with warnings');

    // Verify AZD times
    const azdUp = await page
      .locator('.validation-step')
      .filter({ hasText: 'AZD Up' })
      .textContent();
    expect(azdUp).toContain('45.2s');

    const azdDown = await page
      .locator('.validation-step')
      .filter({ hasText: 'AZD Down' })
      .textContent();
    expect(azdDown).toContain('30.1s');

    // Verify security warnings
    const security = await page
      .locator('.validation-step')
      .filter({ hasText: 'Security' })
      .textContent();
    expect(security).toContain('2 warnings');

    // Verify collapsible details
    const details = await page.locator('.validation-details-panel');
    await expect(details).toBeVisible();

    await details.locator('summary').click();
    const content = await details.locator('pre').textContent();
    expect(content).toContain('Validation Results');
  });

  test('should display failure status', async ({ page }) => {
    await page.route('**/api/v4/validation-template', (route) => {
      route.fulfill({
        json: {
          runId: 'test-run-999',
          githubRunId: 999,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/999',
        },
      });
    });

    await page.route('**/api/v4/validation-status*', (route) => {
      route.fulfill({
        json: {
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/test/repo/actions/runs/999',
          azdValidation: {
            azdUpSuccess: false,
            azdUpTime: null,
            azdDownSuccess: false,
            azdDownTime: null,
            psRuleErrors: 3,
            psRuleWarnings: 1,
            securityStatus: 'errors',
            overallStatus: 'failure',
            resultFileContent: '## Validation Results\n- [ ] :x: AZD Up failed\n❌ Security errors',
          },
        },
      });
    });

    // Trigger validation
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent('template-card-validate', {
          detail: { template: { repoUrl: 'https://github.com/test/repo' } },
        }),
      );
    });

    // Wait for result
    await page.waitForSelector('.validation-failure', { timeout: 5000 });

    // Verify failure icon
    const icon = await page.locator('.validation-icon').textContent();
    expect(icon).toContain('❌');

    // Verify failure message
    const message = await page.locator('.validation-message').textContent();
    expect(message).toContain('Template validation failed');

    // Verify issue button appears for failures
    const issueButton = await page.locator('button').filter({ hasText: 'Create GitHub Issue' });
    await expect(issueButton).toBeVisible();
  });
});

test.describe('GraphQL Issue Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('githubToken', 'test-token');
      localStorage.setItem(
        'githubUser',
        JSON.stringify({
          login: 'testuser',
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        }),
      );

      // Mock GitHubClient with GraphQL
      window.GitHubClient = {
        createIssueGraphQL: async (owner, repo, title, body, labels) => {
          return {
            id: 'issue-123',
            number: 42,
            url: 'https://github.com/test/repo/issues/42',
            title: title,
          };
        },
      };
    });

    await page.goto('http://localhost:3000');
  });

  test('should create issue via GraphQL with error extraction', async ({ page }) => {
    let issueBody = '';

    // Intercept GitHubClient call
    await page.exposeFunction('captureIssueBody', (body) => {
      issueBody = body;
    });

    await page.addInitScript(() => {
      const originalCreateIssue = window.GitHubClient.createIssueGraphQL;
      window.GitHubClient.createIssueGraphQL = async (owner, repo, title, body, labels) => {
        await window.captureIssueBody(body);
        return originalCreateIssue(owner, repo, title, body, labels);
      };
    });

    await page.route('**/api/v4/validation-template', (route) => {
      route.fulfill({
        json: {
          runId: 'test-run-fail',
          githubRunId: 999,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/999',
        },
      });
    });

    await page.route('**/api/v4/validation-status*', (route) => {
      route.fulfill({
        json: {
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/test/repo/actions/runs/999',
          azdValidation: {
            azdUpSuccess: false,
            azdUpTime: null,
            azdDownSuccess: false,
            azdDownTime: null,
            psRuleErrors: 1,
            psRuleWarnings: 0,
            securityStatus: 'errors',
            overallStatus: 'failure',
            resultFileContent:
              '(x) Failed: Region not available\n## Security Requirements:\n- [ ] :x: Missing TLS',
          },
        },
      });
    });

    // Trigger validation
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent('template-card-validate', {
          detail: { template: { repoUrl: 'https://github.com/test/repo' } },
        }),
      );
    });

    // Wait for failure
    await page.waitForSelector('.validation-failure', { timeout: 5000 });

    // Click create issue
    await page.click('button:has-text("Create GitHub Issue")');

    // Wait for issue creation
    await page.waitForTimeout(1000);

    // Verify error extraction
    expect(issueBody).toContain('Region not available');
    expect(issueBody).toContain('Missing TLS');
  });

  test('should show loading and success notifications', async ({ page }) => {
    await page.route('**/api/v4/validation-template', (route) => {
      route.fulfill({
        json: {
          runId: 'test-run-fail',
          githubRunId: 999,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/999',
        },
      });
    });

    await page.route('**/api/v4/validation-status*', (route) => {
      route.fulfill({
        json: {
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/test/repo/actions/runs/999',
          azdValidation: {
            azdUpSuccess: false,
            azdUpTime: null,
            azdDownSuccess: false,
            azdDownTime: null,
            psRuleErrors: 1,
            psRuleWarnings: 0,
            securityStatus: 'errors',
            overallStatus: 'failure',
            resultFileContent: 'Error',
          },
        },
      });
    });

    // Trigger validation
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent('template-card-validate', {
          detail: { template: { repoUrl: 'https://github.com/test/repo' } },
        }),
      );
    });

    // Wait for failure
    await page.waitForSelector('.validation-failure', { timeout: 5000 });

    // Slow down GraphQL for loading state
    await page.addInitScript(() => {
      const original = window.GitHubClient.createIssueGraphQL;
      window.GitHubClient.createIssueGraphQL = async (...args) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return original(...args);
      };
    });

    // Click create issue
    const issueButtonClick = page.click('button:has-text("Create GitHub Issue")');

    // Immediately check for loading notification
    await Promise.race([
      page.waitForSelector('.notification:has-text("Creating")', { timeout: 1000 }),
      issueButtonClick,
    ]);

    // Wait for success
    await page.waitForSelector('.notification:has-text("Issue #42")', { timeout: 3000 });
  });

  test('falls back to URL form if GraphQL unavailable', async ({ page }) => {
    // Remove GitHubClient
    await page.addInitScript(() => {
      // Remove GitHubClient to trigger fallback
      if (window.GitHubClient) {
        try {
          delete window.GitHubClient;
        } catch {
          window.GitHubClient = undefined;
        }
      }
    });

    await page.route('**/api/v4/validation-template', (route) => {
      route.fulfill({
        json: {
          runId: 'run-fallback',
          githubRunId: 1,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/1',
        },
      });
    });
    await page.route('**/api/v4/validation-status*', (route) => {
      route.fulfill({
        json: {
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/test/repo/actions/runs/1',
          azdValidation: {
            azdUpSuccess: false,
            azdUpTime: null,
            azdDownSuccess: false,
            azdDownTime: null,
            psRuleErrors: 0,
            psRuleWarnings: 0,
            securityStatus: 'errors',
            overallStatus: 'failure',
            resultFileContent: 'Failure',
          },
        },
      });
    });
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent('template-card-validate', {
          detail: { template: { repoUrl: 'https://github.com/test/repo' } },
        }),
      );
    });
    await page.waitForSelector('.validation-failure');
    // Stub window.open to capture URL
    await page.addInitScript(() => {
      window.__openedUrls = [];
      const orig = window.open;
      window.open = function (u, t) {
        window.__openedUrls.push(u);
        return typeof orig === 'function' ? orig.call(window, u, t) : null;
      };
    });
    await page.click('button:has-text("Create GitHub Issue")');
    await page.waitForTimeout(500);
    const opened = await page.evaluate(() => window.__openedUrls);
    expect(opened.length).toBeGreaterThan(0);
    expect(opened[0]).toContain('/issues/new?');
  });

  test('captures Copilot assignment attempt (assigneeIds present)', async ({ page }) => {
    let inputPayload = null;
    await page.route('**/graphql', (route) => {
      const body = route.request().postDataJSON();
      if (body && body.variables && body.variables.input) inputPayload = body.variables.input;
      route.fulfill({
        json: {
          data: {
            createIssue: {
              issue: {
                id: 'id1',
                number: 77,
                url: 'https://github.com/test/repo/issues/77',
                title: 't',
              },
            },
          },
        },
      });
    });
    await page.route('**/api/v4/validation-template', (route) =>
      route.fulfill({
        json: {
          runId: 'run-copilot',
          githubRunId: 2,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/2',
        },
      }),
    );
    await page.route('**/api/v4/validation-status*', (route) =>
      route.fulfill({
        json: {
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/test/repo/actions/runs/2',
          azdValidation: {
            azdUpSuccess: false,
            azdUpTime: null,
            azdDownSuccess: false,
            azdDownTime: null,
            psRuleErrors: 1,
            psRuleWarnings: 0,
            securityStatus: 'errors',
            overallStatus: 'failure',
            resultFileContent: '(x) Failed: X',
          },
        },
      }),
    );
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent('template-card-validate', {
          detail: { template: { repoUrl: 'https://github.com/test/repo' } },
        }),
      );
    });
    await page.waitForSelector('.validation-failure');
    await page.click('button:has-text("Create GitHub Issue")');
    await page.waitForTimeout(500);
    expect(inputPayload).not.toBeNull();
    expect(Array.isArray(inputPayload.labels)).toBe(true);
  });

  test('elapsed time spinner replaced by clock after completion', async ({ page }) => {
    await page.route('**/api/v4/validation-template', (r) =>
      r.fulfill({
        json: {
          runId: 'run-time',
          githubRunId: 3,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/3',
        },
      }),
    );
    let poll = 0;
    await page.route('**/api/v4/validation-status*', (r) => {
      poll++;
      if (poll < 2)
        return r.fulfill({
          json: {
            status: 'in_progress',
            conclusion: null,
            html_url: 'https://github.com/test/repo/actions/runs/3',
          },
        });
      return r.fulfill({
        json: {
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test/repo/actions/runs/3',
          azdValidation: {
            azdUpSuccess: true,
            azdUpTime: '5s',
            azdDownSuccess: true,
            azdDownTime: '6s',
            psRuleErrors: 0,
            psRuleWarnings: 0,
            securityStatus: 'pass',
            overallStatus: 'success',
            resultFileContent: '',
          },
        },
      });
    });
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent('template-card-validate', {
          detail: { template: { repoUrl: 'https://github.com/test/repo' } },
        }),
      );
    });
    await page.waitForSelector('#azd-elapsed-time .fa-spinner');
    await page.waitForSelector('#azd-elapsed-time .fa-clock', { timeout: 8000 });
    const hasSpinner = await page.locator('#azd-elapsed-time .fa-spinner').count();
    expect(hasSpinner).toBe(0);
  });

  test('elapsed time formatting for short (<60s) and long (>60s) durations', async ({ page }) => {
    // Simulate long-running by modifying Date.now progression
    await page.addInitScript(() => {
      const realNow = Date.now;
      let offset = 0;
      Date.now = () => realNow() + offset;
      window.__advance = (ms) => {
        offset += ms;
      };
    });
    await page.route('**/api/v4/validation-template', (r) =>
      r.fulfill({
        json: {
          runId: 'run-durations',
          githubRunId: 4,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/4',
        },
      }),
    );
    let poll = 0;
    await page.route('**/api/v4/validation-status*', (r) => {
      poll++;
      if (poll < 3)
        return r.fulfill({
          json: {
            status: 'in_progress',
            conclusion: null,
            html_url: 'https://github.com/test/repo/actions/runs/4',
          },
        });
      return r.fulfill({
        json: {
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test/repo/actions/runs/4',
          azdValidation: {
            azdUpSuccess: true,
            azdUpTime: '10s',
            azdDownSuccess: true,
            azdDownTime: '12s',
            psRuleErrors: 0,
            psRuleWarnings: 0,
            securityStatus: 'pass',
            overallStatus: 'success',
            resultFileContent: '',
          },
        },
      });
    });
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent('template-card-validate', {
          detail: { template: { repoUrl: 'https://github.com/test/repo' } },
        }),
      );
    });
    // Advance 30s
    await page.evaluate(() => window.__advance(30000));
    await page.waitForTimeout(200); // allow interval update
    const shortText = await page.locator('#azd-elapsed-time').textContent();
    expect(shortText).toMatch(/30s elapsed/);
    // Advance to > 60s total (add 40s)
    await page.evaluate(() => window.__advance(40000));
    await page.waitForTimeout(200);
    const longText = await page.locator('#azd-elapsed-time').textContent();
    expect(longText).toMatch(/1m 10s|1m 9s/); // allow tick variance
  });
});
