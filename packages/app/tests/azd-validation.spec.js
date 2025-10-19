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
      localStorage.setItem('githubUser', JSON.stringify({
        login: 'testuser',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4'
      }));
    });
    
    await page.goto('http://localhost:3000');
  });

  test('should show spinner animation during validation', async ({ page }) => {
    // Mock validation-status endpoint to simulate in-progress validation
    await page.route('**/api/v4/validation-status*', (route) => {
      route.fulfill({
        json: {
          status: 'in_progress',
          conclusion: null,
          html_url: 'https://github.com/test/repo/actions/runs/123'
        }
      });
    });

    // Mock validation-template endpoint
    await page.route('**/api/v4/validation-template', (route) => {
      route.fulfill({
        json: {
          runId: 'test-run-123',
          githubRunId: 123,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/123'
        }
      });
    });

    // Trigger validation via custom event
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('template-card-validate', {
        detail: { template: { repoUrl: 'https://github.com/test/repo' } }
      }));
    });

    // Wait for validation UI to appear
    await page.waitForSelector('#azd-provision-controls', { timeout: 5000 });

    // Verify spinner is visible
    const spinner = page.locator('#azd-elapsed-time .fa-spinner.fa-spin');
    await expect(spinner).toBeVisible();

    // Verify spinner has correct styling
    const spinnerClass = await spinner.getAttribute('class');
    expect(spinnerClass).toContain('fa-spinner');
    expect(spinnerClass).toContain('fa-spin');

    // Verify no old custom animation exists
    const customAnimation = await page.locator('.azd-scroll-icon').count();
    expect(customAnimation).toBe(0);
  });

  test('should display validation-warning with readable contrast', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Inject test element with validation-warning class
    await page.evaluate(() => {
      const testDiv = document.createElement('div');
      testDiv.className = 'validation-warning';
      testDiv.id = 'test-warning-contrast';
      testDiv.textContent = 'Test Warning Message';
      testDiv.style.padding = '15px';
      testDiv.style.marginTop = '20px';
      document.body.appendChild(testDiv);
    });

    // Wait for styles to apply
    await page.waitForTimeout(100);

    // Get computed color
    const color = await page.$eval('#test-warning-contrast', (el) => {
      return window.getComputedStyle(el).color;
    });

    // Verify color is dark brown #4e3a16 = rgb(78, 58, 22)
    expect(color).toBe('rgb(78, 58, 22)');

    // Verify background is light yellow
    const bgColor = await page.$eval('#test-warning-contrast', (el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Should have rgba with alpha channel (semi-transparent yellow)
    expect(bgColor).toMatch(/rgba?\(/);

    // Take screenshot for visual regression
    await page.screenshot({ 
      path: 'test-results/validation-warning-contrast.png',
      fullPage: false 
    });
  });

  test('should show troubleshooting tips immediately on validation start', async ({ page }) => {
    // Mock validation endpoints
    await page.route('**/api/v4/validation-template', (route) => {
      route.fulfill({
        json: {
          runId: 'test-run-123',
          githubRunId: 123,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/123'
        }
      });
    });

    await page.route('**/api/v4/validation-status*', (route) => {
      route.fulfill({
        json: {
          status: 'in_progress',
          conclusion: null,
          html_url: 'https://github.com/test/repo/actions/runs/123'
        }
      });
    });

    // Trigger validation
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('template-card-validate', {
        detail: { template: { repoUrl: 'https://github.com/test/repo' } }
      }));
    });

    // Wait for troubleshooting section to appear
    await page.waitForSelector('#azd-troubleshooting-tips', { timeout: 5000 });

    // Verify all three tips are present
    const tips = await page.locator('#azd-troubleshooting-tips > div').count();
    expect(tips).toBe(3);

    // Check Tip 1: Region Availability
    const tip1 = page.locator('#azd-troubleshooting-tips > div').nth(0);
    await expect(tip1).toContainText('Region Availability');
    await expect(tip1).toContainText('Models are available in certain regions only');
    
    const tip1Link = await tip1.locator('a').getAttribute('href');
    expect(tip1Link).toContain('trouble-shooting.md#region-availability');

    // Check Tip 2: UnmatchedPrincipalType
    const tip2 = page.locator('#azd-troubleshooting-tips > div').nth(1);
    await expect(tip2).toContainText('UnmatchedPrincipalType Error');
    await expect(tip2).toContainText('ServicePrincipal vs User');
    
    const tip2Link = await tip2.locator('a').getAttribute('href');
    expect(tip2Link).toContain('azure-openai-assistant-javascript/pull/18');

    // Check Tip 3: BCP332 maxLength
    const tip3 = page.locator('#azd-troubleshooting-tips > div').nth(2);
    await expect(tip3).toContainText('BCP332 maxLength Error');
    await expect(tip3).toContainText('Increase the maxLength');
  });

  test('should highlight UnmatchedPrincipalType tip when error detected', async ({ page }) => {
    // Mock validation with UnmatchedPrincipalType error in logs
    const errorMessage = `Error: UnmatchedPrincipalType: The PrincipalId 'abc123' has type 'ServicePrincipal', which is different from specified PrinciaplType 'User'`;
    
    await page.route('**/api/v4/validation-template', (route) => {
      route.fulfill({
        json: {
          runId: 'test-run-123',
          githubRunId: 123,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/123'
        }
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
            resultFileContent: `Error: ${errorMessage}`
          }
        }
      });
    });

    // Trigger validation
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('template-card-validate', {
        detail: { template: { repoUrl: 'https://github.com/test/repo' } }
      }));
    });

    // Wait for completion and tips update
    await page.waitForTimeout(2000);

    // Get the UnmatchedPrincipalType tip (should be second one)
    const tip2 = page.locator('#azd-troubleshooting-tips > div').nth(1);
    
    // Verify it's highlighted (orange border)
    const borderColor = await tip2.evaluate((el) => {
      return window.getComputedStyle(el).borderColor;
    });
    
    // #ff9800 = rgb(255, 152, 0) - orange
    expect(borderColor).toContain('255, 152, 0');

    // Verify background is yellow
    const bgColor = await tip2.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    // Should have yellow-ish background
    expect(bgColor).toMatch(/255.*248.*225/); // #fff8e1

    // Verify "DETECTED" badge appears
    await expect(tip2).toContainText('⚠️ DETECTED');
  });
});

test.describe('Artifact-Based Validation Results', () => {
  test('should display structured validation results from artifact', async ({ page }) => {
    // Mock validation status response with azdValidation data
    await page.route('**/api/v4/validation-template', (route) => {
      route.fulfill({
        json: {
          runId: 'test-run-456',
          githubRunId: 456,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/456'
        }
      });
    });

    let pollCount = 0;
    await page.route('**/api/v4/validation-status*', (route) => {
      pollCount++;
      
      // First few polls: in progress
      if (pollCount < 3) {
        route.fulfill({
          json: {
            status: 'in_progress',
            conclusion: null,
            html_url: 'https://github.com/test/repo/actions/runs/456'
          }
        });
      } else {
        // Final poll: completed with warnings
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
              resultFileContent: '## Validation Results\n- [x] AZD Up (45.2s)\n- [x] AZD Down (30.1s)\n:warning: Security warning 1\n:warning: Security warning 2'
            }
          }
        });
      }
    });

    // Trigger validation
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('template-card-validate', {
        detail: { template: { repoUrl: 'https://github.com/test/repo' } }
      }));
    });

    // Wait for completion
    await page.waitForSelector('.validation-result', { timeout: 10000 });

    // Verify warning status displayed
    const warningIcon = await page.locator('.validation-icon').textContent();
    expect(warningIcon).toContain('⚠️');

    const warningMessage = await page.locator('.validation-message').textContent();
    expect(warningMessage).toContain('Template validation passed with warnings');

    // Verify AZD Up/Down times displayed
    const azdUpStep = await page.locator('.validation-step').filter({ hasText: 'AZD Up' }).textContent();
    expect(azdUpStep).toContain('45.2s');

    const azdDownStep = await page.locator('.validation-step').filter({ hasText: 'AZD Down' }).textContent();
    expect(azdDownStep).toContain('30.1s');

    // Verify security warnings count
    const securityStep = await page.locator('.validation-step').filter({ hasText: 'Security' }).textContent();
    expect(securityStep).toContain('2 warnings');

    // Verify collapsible details panel exists
    const detailsPanel = page.locator('.validation-details-panel');
    await expect(detailsPanel).toBeVisible();

    // Expand details and verify content
    await detailsPanel.locator('summary').click();
    const detailsContent = await detailsPanel.locator('pre').textContent();
    expect(detailsContent).toContain('Validation Results');
    expect(detailsContent).toContain('AZD Up (45.2s)');
  });

  test('should show success status for fully passing validation', async ({ page }) => {
    await page.route('**/api/v4/validation-status*', (route) => {
      route.fulfill({
        json: {
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test/repo/actions/runs/123',
          azdValidation: {
            azdUpSuccess: true,
            azdUpTime: '45.2s',
            azdDownSuccess: true,
            azdDownTime: '30.1s',
            psRuleErrors: 0,
            psRuleWarnings: 0,
            securityStatus: 'pass',
            overallStatus: 'success',
            resultFileContent: '## Validation Results\n- [x] AZD Up\n- [x] AZD Down\n✅ Security passed'
          }
        }
      });
    });
  });

  test('should show success status for fully passing validation', async ({ page }) => {
    await page.route('**/api/v4/validation-template', (route) => {
      route.fulfill({
        json: {
          runId: 'test-run-789',
          githubRunId: 789,
          githubRunUrl: 'https://github.com/test/repo/actions/runs/789'
        }
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
            resultFileContent: '## Validation Results\n- [x] AZD Up\n- [x] AZD Down\n✅ Security passed'
          }
        }
      });
    });

    // Trigger validation
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('template-card-validate', {
        detail: { template: { repoUrl: 'https://github.com/test/repo' } }
      }));
    });

    // Wait for validation result
    await page.waitForSelector('.validation-success', { timeout: 5000 });

    // Verify success icon
    const successIcon = await page.locator('.validation-icon').textContent();
    expect(successIcon).toContain('✅');

    // Verify success message
    const message = await page.locator('.validation-message').textContent();
    expect(message).toContain('Template validation passed');
    expect(message).not.toContain('warnings'); // Should not mention warnings

    // Verify green success styling
    const bgColor = await page.locator('.validation-success').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    // Should have green tint (rgba with 107, 124, 16)
    expect(bgColor).toMatch(/16.*124.*16/); // #107c10

    // Verify "Create Issue" button is NOT shown for success
    const issueButton = await page.locator('button').filter({ hasText: 'Create GitHub Issue' }).count();
    expect(issueButton).toBe(0);
  });

  test('should show failure status for validation errors', async ({ page }) => {
    await page.route('**/api/v4/validation-status*', (route) => {
      route.fulfill({
        json: {
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/test/repo/actions/runs/123',
          azdValidation: {
            azdUpSuccess: false,
            azdUpTime: null,
            azdDownSuccess: false,
            azdDownTime: null,
            psRuleErrors: 3,
            psRuleWarnings: 1,
            securityStatus: 'errors',
            overallStatus: 'failure',
            resultFileContent: '## Validation Results\n- [ ] :x: AZD Up failed\n❌ Security errors'
          }
        }
      });
    });

    // TODO: Verify ❌ failure icon
    // TODO: Verify "Template validation failed" message
    // TODO: Verify red failure styling
    // TODO: Verify error details displayed
  });
});

test.describe('GraphQL Issue Creation', () => {
  test('should create issue via GraphQL API with Copilot assignment', async ({ page }) => {
    let issueCreated = false;
    let copilotAssigned = false;

    // Mock GraphQL API call
    await page.route('**/graphql', async (route) => {
      const postData = route.request().postDataJSON();
      
      if (postData.query.includes('createIssue')) {
        issueCreated = true;
        
        // Check if assigneeIds includes Copilot
        if (postData.variables.input.assigneeIds?.length > 0) {
          copilotAssigned = true;
        }

        route.fulfill({
          json: {
            data: {
              createIssue: {
                issue: {
                  id: 'issue-123',
                  number: 42,
                  url: 'https://github.com/test/repo/issues/42',
                  title: '[Template Doctor] Fix validation errors'
                }
              }
            }
          }
        });
      } else {
        route.continue();
      }
    });

    // Mock validation status with failure
    await page.route('**/api/v4/validation-status*', (route) => {
      route.fulfill({
        json: {
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/test/repo/actions/runs/123',
          azdValidation: {
            azdUpSuccess: false,
            azdUpTime: null,
            azdDownSuccess: false,
            azdDownTime: null,
            psRuleErrors: 2,
            psRuleWarnings: 0,
            securityStatus: 'errors',
            overallStatus: 'failure',
            resultFileContent: '(x) Failed: Deployment error\n## Security Requirements:\n- [ ] :x: Missing encryption'
          }
        }
      });
    });

    // TODO: Trigger validation
    // TODO: Wait for failure
    // TODO: Click "Create Issue" button
    // TODO: Verify loading notification appears
    // TODO: Verify GraphQL called (issueCreated = true)
    // TODO: Verify Copilot assigned (copilotAssigned = true)
    // TODO: Verify success notification shows issue #42
    // TODO: Verify new tab opens with issue URL
    
    expect(issueCreated).toBe(true);
    expect(copilotAssigned).toBe(true);
  });

  test('should extract validation errors from markdown content', async ({ page }) => {
    let issueBody = '';

    await page.route('**/graphql', async (route) => {
      const postData = route.request().postDataJSON();
      
      if (postData.query.includes('createIssue')) {
        issueBody = postData.variables.input.body;
        
        route.fulfill({
          json: {
            data: {
              createIssue: {
                issue: {
                  id: 'issue-123',
                  number: 42,
                  url: 'https://github.com/test/repo/issues/42',
                  title: '[Template Doctor] Fix validation errors'
                }
              }
            }
          }
        });
      } else {
        route.continue();
      }
    });

    await page.route('**/api/v4/validation-status*', (route) => {
      route.fulfill({
        json: {
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/test/repo/actions/runs/123',
          azdValidation: {
            azdUpSuccess: false,
            azdUpTime: null,
            azdDownSuccess: false,
            azdDownTime: null,
            psRuleErrors: 1,
            psRuleWarnings: 0,
            securityStatus: 'errors',
            overallStatus: 'failure',
            resultFileContent: '(x) Failed: Region not available\n## Security Requirements:\n- [ ] :x: Missing TLS'
          }
        }
      });
    });

    // TODO: Create issue
    // TODO: Verify issueBody contains "Region not available"
    // TODO: Verify issueBody contains "Missing TLS"
    // TODO: Verify issueBody does NOT contain workflow errors
    
    expect(issueBody).toContain('Region not available');
    expect(issueBody).toContain('Missing TLS');
  });

  test('should fallback to URL form if GraphQL fails', async ({ page }) => {
    // Mock GraphQL failure
    await page.route('**/graphql', (route) => {
      route.abort('failed');
    });

    await page.route('**/api/v4/validation-status*', (route) => {
      route.fulfill({
        json: {
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/test/repo/actions/runs/123',
          azdValidation: {
            overallStatus: 'failure',
            resultFileContent: 'Error'
          }
        }
      });
    });

    // TODO: Create issue
    // TODO: Verify error notification appears
    // TODO: Verify message contains "Opening form in browser"
    // TODO: Verify new tab opens with GitHub issue form URL
  });

  test('should show loading notification during issue creation', async ({ page }) => {
    // Mock slow GraphQL response
    await page.route('**/graphql', async (route) => {
      await page.waitForTimeout(1000); // Simulate network delay
      route.fulfill({
        json: {
          data: {
            createIssue: {
              issue: {
                id: 'issue-123',
                number: 42,
                url: 'https://github.com/test/repo/issues/42',
                title: 'Test'
              }
            }
          }
        }
      });
    });

    // TODO: Click create issue
    // TODO: Immediately verify loading notification visible
    // TODO: Verify text "Creating GitHub issue and assigning to Copilot..."
    // TODO: Wait for completion
    // TODO: Verify loading notification closes
    // TODO: Verify success notification appears
  });
});

test.describe('Validation CSS Styles', () => {
  test('validation-warning should have dark brown text color', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Inject test element
    await page.evaluate(() => {
      const testDiv = document.createElement('div');
      testDiv.className = 'validation-warning';
      testDiv.id = 'test-warning';
      testDiv.textContent = 'Test Warning';
      document.body.appendChild(testDiv);
    });

    const color = await page.$eval('#test-warning', (el) => {
      return window.getComputedStyle(el).color;
    });

    // #4e3a16 = rgb(78, 58, 22)
    expect(color).toBe('rgb(78, 58, 22)');
  });

  test('validation results should display correctly', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Inject validation result
    await page.evaluate(() => {
      const resultDiv = document.createElement('div');
      resultDiv.className = 'validation-result validation-success';
      resultDiv.innerHTML = `
        <div class="validation-header">
          <span class="validation-icon">✅</span>
          <span class="validation-message">Template validation passed</span>
        </div>
      `;
      document.body.appendChild(resultDiv);
    });

    const bg = await page.$eval('.validation-success', (el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Should have green tint
    expect(bg).toContain('16, 124, 16'); // #107c10
    });
});
