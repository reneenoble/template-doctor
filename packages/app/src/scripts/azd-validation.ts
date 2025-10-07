/* AZD Provision Test and Live Log Streaming */
import { ApiClient } from './api-client';

let currentRunId: string | null = null;
let currentGithubRunId: string | null = null;
let currentWorkflowOrgRepo: string | null = null;
let currentGithubRunUrl: string | null = null;
let pollingInterval: number | null = null;
let logElement: HTMLPreElement | null = null;
let stopButton: HTMLButtonElement | null = null;
let isValidationRunning = false;

function notify() {
  return (window as any).NotificationSystem || (window as any).Notifications;
}

function showInfo(title: string, message: string) {
  const n = notify();
  if (n?.showInfo) n.showInfo(title, message, 4000);
  else console.log(`${title}: ${message}`);
}

function showError(title: string, message: string) {
  const n = notify();
  if (n?.showError) n.showError(title, message, 8000);
  else console.error(`${title}: ${message}`);
}

function showSuccess(title: string, message: string) {
  const n = notify();
  if (n?.showSuccess) n.showSuccess(title, message, 3000);
  else console.log(`${title}: ${message}`);
}

function showLoading(title: string, message: string) {
  const n = notify();
  if (n?.loading) return n.loading(title, message);
  console.log(`${title}: ${message}`);
  return null;
}

function appendLog(logEl: HTMLPreElement | Console, message: string) {
  const timestamp = new Date().toISOString().substring(11, 19);
  const line = `[${timestamp}] ${message}\n`;

  if (logEl instanceof HTMLPreElement) {
    logEl.textContent += line;
    logEl.scrollTop = logEl.scrollHeight;
  } else {
    console.log(line);
  }
}

function createLogContainer(): HTMLPreElement {
  // Remove existing log container if present
  const existing = document.getElementById('azd-provision-logs');
  if (existing) existing.remove();

  const existingControls = document.getElementById('azd-provision-controls');
  if (existingControls) existingControls.remove();

  // Create or get validation section container
  let validationSection = document.getElementById('validation-section') as HTMLElement | null;

  if (!validationSection) {
    validationSection = document.createElement('section');
    validationSection.id = 'validation-section';
    validationSection.className = 'validation-section';
    validationSection.style.cssText = `
      display: block;
      margin: 20px auto;
      max-width: 1200px;
      padding: 20px;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;

    // Find best insertion point
    const searchSection = document.getElementById('search-section');
    const analysisSection = document.getElementById('analysis-section');
    const main = document.querySelector('main') || document.body;

    if (searchSection && searchSection.style.display !== 'none') {
      // Insert after search section
      searchSection.parentNode?.insertBefore(validationSection, searchSection.nextSibling);
    } else if (analysisSection) {
      // Insert before analysis section
      analysisSection.parentNode?.insertBefore(validationSection, analysisSection);
    } else {
      // Insert at beginning of main
      main.insertBefore(validationSection, main.firstChild);
    }

    // Add section header
    const header = document.createElement('h2');
    header.style.cssText = 'margin: 0 0 15px 0; color: #0078d4; font-size: 1.5rem;';
    header.innerHTML = '<i class="fas fa-rocket"></i> AZD Validation';
    validationSection.appendChild(header);
  }

  // Make sure validation section is visible
  validationSection.style.display = 'block';

  // Create log container
  const logEl = document.createElement('pre');
  logEl.id = 'azd-provision-logs';
  logEl.style.cssText = `
    max-height: 400px;
    overflow: auto;
    background: #0b0c0c;
    color: #d0d0d0;
    padding: 20px;
    border-radius: 6px;
    font-size: 12px;
    margin: 10px 0 20px 0;
    font-family: 'Courier New', monospace;
  `;

  // Append to validation section
  validationSection.appendChild(logEl);

  // Create controls row with cancel button
  const controls = document.createElement('div');
  controls.id = 'azd-provision-controls';
  controls.style.cssText = 'margin: 0 0 10px 0; display: flex; gap: 8px; align-items: center;';

  const stopBtn = document.createElement('button');
  stopBtn.id = 'azd-stop-btn';
  stopBtn.textContent = 'Cancel Validation';
  stopBtn.style.cssText = `
    padding: 8px 16px;
    background: #b10e1e;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0,0,0,0.15);
    font-size: 14px;
    font-weight: 500;
  `;
  stopBtn.disabled = true;

  controls.appendChild(stopBtn);
  validationSection.insertBefore(controls, logEl);

  stopButton = stopBtn;

  // Scroll to validation section
  setTimeout(() => {
    validationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);

  return logEl;
}

export async function testAzdProvision(repoUrl?: string) {
  // Prevent duplicate execution
  if (isValidationRunning) {
    console.warn('[azd-validation] Validation already running, ignoring duplicate request');
    showInfo('Validation Running', 'A validation is already in progress');
    return;
  }

  console.log('[azd-validation] Starting new validation request', { repoUrl });

  // Get report data from window or use provided repoUrl
  const reportData = (window as any).reportData;

  if (!repoUrl && !reportData) {
    showError('Error', 'No report data available to test AZD provision');
    return;
  }

  const templateUrl = repoUrl || reportData?.repoUrl;

  if (!templateUrl) {
    showError('Error', 'No repository URL found');
    return;
  }

  // Show confirmation dialog
  const n = notify();
  if (n?.confirm) {
    n.confirm(
      'Test AZD Provision',
      'This will trigger the template validation GitHub workflow for this repository. Proceed?',
      {
        confirmLabel: 'Start Validation',
        cancelLabel: 'Cancel',
        onConfirm: () => runValidation(templateUrl),
        onCancel: () => console.log('Validation cancelled by user'),
      },
    );
  } else {
    if (
      confirm(
        'This will trigger the template validation GitHub workflow for this repository. Proceed?',
      )
    ) {
      runValidation(templateUrl);
    }
  }
}

async function runValidation(templateUrl: string) {
  // Set running flag
  isValidationRunning = true;

  // Create log container
  logElement = createLogContainer();

  appendLog(logElement, 'Starting AZD validation...');
  appendLog(logElement, `Target repository: ${templateUrl}`);

  // Get API base
  const cfg: any = (window as any).TemplateDoctorConfig || {};
  const apiBase = cfg.apiBase || window.location.origin;

  appendLog(logElement, `API base: ${apiBase}`);

  // Show button loading state
  const testProvisionButton =
    document.getElementById('testProvisionButton') ||
    document.getElementById('testProvisionButton-direct') ||
    document.getElementById('testProvisionButton-fallback');

  let originalText = '';
  if (testProvisionButton) {
    originalText = testProvisionButton.innerHTML;
    testProvisionButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting…';
    (testProvisionButton as HTMLButtonElement).disabled = true;
  }

  const loadingNotification = showLoading(
    'Starting AZD Provision',
    'Triggering validation workflow...',
  );

  try {
    // Call validation-template endpoint
    const endpoint = `${apiBase}/api/v4/validation-template`;
    appendLog(logElement, `Calling: POST ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetRepoUrl: templateUrl,
        callbackUrl: window.location.href,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Validation start failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = await response.json();
    currentRunId = data.runId || null;
    // Backend now returns workflowRunId instead of githubRunId
    currentGithubRunId = data.workflowRunId || data.githubRunId || null;
    currentWorkflowOrgRepo = data.workflowOrgRepo || null;
    currentGithubRunUrl = data.githubRunUrl || null;

    appendLog(logElement, `✓ Validation started`);
    appendLog(logElement, `Run ID: ${currentRunId}`);

    if (currentGithubRunId) {
      appendLog(logElement, `GitHub Run ID: ${currentGithubRunId}`);
    }

    if (currentGithubRunUrl) {
      appendLog(logElement, `GitHub Run URL: ${currentGithubRunUrl}`);

      // Add clickable button (not auto-open)
      const linkDiv = document.createElement('div');
      linkDiv.style.cssText =
        'margin: 10px 0; padding: 8px; background: #1a1b1c; border-left: 3px solid #0078d4;';

      const linkButton = document.createElement('button');
      linkButton.textContent = '🔗 View GitHub Actions Run';
      linkButton.style.cssText =
        'background: #0078d4; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;';
      linkButton.onclick = () => window.open(currentGithubRunUrl!, '_blank');

      linkDiv.appendChild(linkButton);
      logElement.appendChild(linkDiv);
    }

    // Store in localStorage for correlation
    if (currentRunId) {
      try {
        localStorage.setItem(
          `validation_${currentRunId}`,
          JSON.stringify({
            githubRunId: currentGithubRunId,
            githubRunUrl: currentGithubRunUrl,
            templateUrl,
          }),
        );
        localStorage.setItem(
          'lastValidationRunInfo',
          JSON.stringify({
            runId: currentRunId,
            githubRunId: currentGithubRunId,
            githubRunUrl: currentGithubRunUrl,
            templateUrl,
          }),
        );
      } catch (e) {
        console.warn('Failed to save validation info to localStorage:', e);
      }
    }

    if (loadingNotification?.success) {
      loadingNotification.success(
        'Validation Started',
        currentGithubRunUrl
          ? 'Workflow started. Opening GitHub run in a new tab.'
          : 'Workflow started. Monitor status below.',
      );
    } else {
      showSuccess('Validation Started', 'Workflow triggered successfully');
    }

    // Enable cancel button
    if (stopButton && currentRunId) {
      stopButton.disabled = false;
      stopButton.onclick = () => cancelValidation();
    }

    // Start polling for status
    if (currentRunId) {
      startStatusPolling(apiBase, currentRunId);
    }
  } catch (error: any) {
    appendLog(logElement, `✗ Error: ${error.message}`);
    showError('Validation Failed', error.message || 'Failed to start validation');

    // Clear running flag on error
    isValidationRunning = false;

    if (loadingNotification?.error) {
      loadingNotification.error('Validation Failed', error.message);
    }
  } finally {
    // Restore button state
    if (testProvisionButton) {
      setTimeout(() => {
        testProvisionButton.innerHTML = originalText || 'Test AZD Provision';
        (testProvisionButton as HTMLButtonElement).disabled = false;
        (testProvisionButton as HTMLButtonElement).style.backgroundColor = '';
      }, 500);
    }
  }
}

async function cancelValidation() {
  if (!currentRunId || !logElement || !stopButton) return;

  stopButton.disabled = true;
  const prevText = stopButton.textContent;
  stopButton.textContent = 'Cancelling…';

  appendLog(logElement, 'Requesting cancellation...');

  try {
    const cfg: any = (window as any).TemplateDoctorConfig || {};
    const apiBase = cfg.apiBase || window.location.origin;
    const endpoint = `${apiBase}/api/v4/validation-cancel`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: currentRunId,
        githubRunId: currentGithubRunId,
        githubRunUrl: currentGithubRunUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cancel failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    appendLog(
      logElement,
      `✓ Cancellation requested for GitHub run ${data.githubRunId || currentGithubRunId}`,
    );
    appendLog(logElement, 'Waiting for status to reflect "cancelled"...');

    showInfo('Cancellation Requested', 'Workflow will stop shortly');
  } catch (error: any) {
    appendLog(logElement, `✗ Cancel error: ${error.message}`);
    showError('Cancel Failed', error.message);
    stopButton.disabled = false;
    stopButton.textContent = prevText || 'Cancel Validation';
  }
}

function startStatusPolling(apiBase: string, runId: string) {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  let attempts = 0;
  const MAX_ATTEMPTS = 60; // ~30 minutes at 30s intervals

  const poll = async () => {
    attempts++;

    if (!logElement || attempts > MAX_ATTEMPTS) {
      stopPolling();
      if (logElement) {
        appendLog(logElement, 'Polling stopped (max attempts reached)');
      }
      return;
    }

    try {
      const url = new URL(`${apiBase}/api/v4/validation-status`);
      // Send workflowRunId (numeric GitHub run ID) and workflowOrgRepo
      if (currentGithubRunId) {
        url.searchParams.set('workflowRunId', currentGithubRunId);
      } else {
        // Fallback to runId if workflowRunId not available (shouldn't happen)
        console.warn(
          'Fallback: workflowRunId not available, using runId instead. This should not happen.',
          { runId, currentGithubRunId },
        );
        url.searchParams.set('runId', runId);
      }
      if (currentWorkflowOrgRepo) {
        url.searchParams.set('workflowOrgRepo', currentWorkflowOrgRepo);
      }
      url.searchParams.set('includeLogsUrl', '1');
      if (currentGithubRunId) {
        url.searchParams.set('githubRunId', currentGithubRunId);
      }

      const response = await fetch(url.toString(), {
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const status = await response.json();

      if (status.status) {
        const statusMsg = status.conclusion
          ? `${status.status} (${status.conclusion})`
          : status.status;
        appendLog(logElement!, `[status] ${statusMsg}`);
      }

      // Check for logs archive URL
      if (status.logsArchiveUrl && !document.getElementById('gh-logs-archive-link')) {
        const linkDiv = document.createElement('div');
        linkDiv.id = 'gh-logs-archive-link';
        linkDiv.style.cssText =
          'margin: 10px 0; padding: 8px; background: #1a1b1c; border-left: 3px solid #28a745;';
        linkDiv.innerHTML = `<a href="${status.logsArchiveUrl}" target="_blank" style="color: #4fc3f7; text-decoration: none;">📥 Download Logs Archive</a>`;
        logElement!.appendChild(linkDiv);
      }

      // Check if workflow is complete
      if (status.status === 'completed' || status.conclusion) {
        stopPolling();

        // Clear running flag
        isValidationRunning = false;

        if (status.conclusion === 'success') {
          appendLog(logElement!, '✓ Validation completed successfully!');

          // Show celebratory success tile
          const successTile = document.createElement('div');
          successTile.style.cssText =
            'margin: 15px 0; padding: 20px; background: linear-gradient(135deg, #1e4620 0%, #2d5a2e 100%); border-left: 4px solid #4caf50; border-radius: 8px; box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);';
          successTile.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
              <div style="font-size: 48px;">🏆</div>
              <div style="flex: 1;">
                <h3 style="margin: 0 0 8px 0; color: #4caf50; font-size: 20px; font-weight: bold;">Validation Passed!</h3>
                <p style="margin: 0; color: #a5d6a7; font-size: 14px;">All checks completed successfully. Your template meets all requirements! 🎉</p>
              </div>
            </div>
          `;
          logElement!.appendChild(successTile);

          showSuccess('Validation Complete', 'Template validation passed!');
        } else if (status.conclusion === 'failure') {
          appendLog(logElement!, '✗ Validation failed');

          // Show error details if available
          if (status.errorSummary) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText =
              'margin: 10px 0; padding: 12px; background: #2d1f1f; border-left: 3px solid #f44336; font-family: monospace; font-size: 12px; white-space: pre-wrap;';
            errorDiv.innerHTML = `<strong style="color: #f44336;">Error Details:</strong>\n${status.errorSummary}`;
            logElement!.appendChild(errorDiv);
          }

          // Add links to failed jobs
          if (status.failedJobs && status.failedJobs.length > 0) {
            const jobsDiv = document.createElement('div');
            jobsDiv.style.cssText =
              'margin: 10px 0; padding: 12px; background: #1a1b1c; border-left: 3px solid #ff9800;';

            let jobsHtml = '<strong style="color: #ff9800;">Failed Jobs:</strong><br>';
            status.failedJobs.forEach((job: any) => {
              jobsHtml += `<a href="${job.html_url}" target="_blank" style="color: #4fc3f7; text-decoration: none; display: block; margin: 5px 0;">📋 ${job.name}</a>`;
              if (job.failedSteps && job.failedSteps.length > 0) {
                jobsHtml += '<div style="margin-left: 20px; color: #999;">';
                job.failedSteps.forEach((step: any) => {
                  jobsHtml += `  ❌ Step ${step.number}: ${step.name}<br>`;
                });
                jobsHtml += '</div>';
              }
            });
            jobsDiv.innerHTML = jobsHtml;
            logElement!.appendChild(jobsDiv);
          }

          // Add "Create Issue" button
          if (status.html_url) {
            const issueDiv = document.createElement('div');
            issueDiv.style.cssText =
              'margin: 10px 0; padding: 12px; background: #1a1b1c; border-left: 3px solid #0078d4;';

            const issueButton = document.createElement('button');
            issueButton.textContent = '🐛 Create GitHub Issue';
            issueButton.style.cssText =
              'background: #0078d4; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;';
            issueButton.onclick = () => createValidationIssue(status);

            issueDiv.appendChild(issueButton);
            logElement!.appendChild(issueDiv);
          }

          showError('Validation Failed', 'Template validation encountered errors');
        } else if (status.conclusion === 'cancelled') {
          appendLog(logElement!, '⚠ Validation cancelled');
          showInfo('Validation Cancelled', 'Workflow was cancelled');
        } else {
          appendLog(logElement!, `⚠ Validation ended: ${status.conclusion || 'unknown'}`);
        }

        // Disable cancel button
        if (stopButton) {
          stopButton.disabled = true;
          stopButton.textContent = 'Validation Complete';
        }
      }
    } catch (error: any) {
      console.error('Status polling error:', error);
      appendLog(logElement!, `⚠ Status check failed: ${error.message}`);
    }
  };

  // Poll immediately, then every 30 seconds
  poll();
  pollingInterval = window.setInterval(poll, 30000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  // Clear running flag when polling stops
  isValidationRunning = false;
}

/**
 * Create a GitHub issue for validation failures
 */
function createValidationIssue(status: any) {
  const targetRepoInput = document.getElementById('targetRepoUrl') as HTMLInputElement;
  const targetRepoUrl = targetRepoInput?.value || '';

  if (!targetRepoUrl) {
    showError('Missing Information', 'Cannot determine target repository');
    return;
  }

  // Extract owner/repo from URL
  const match = targetRepoUrl.match(/https?:\/\/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    showError('Invalid URL', 'Could not parse repository from URL');
    return;
  }

  const [, owner, repo] = match;

  // Build issue title
  const title = `[Template Doctor] AZD Validation Failed`;

  // Build issue body
  let body = `## AZD Validation Failure Report\n\n`;
  body += `**Repository:** ${targetRepoUrl}\n`;
  body += `**Validation Run:** ${status.html_url || 'N/A'}\n`;
  body += `**Status:** ${status.status} (${status.conclusion})\n`;
  body += `**Date:** ${new Date().toISOString()}\n\n`;

  if (status.errorSummary) {
    body += `### Error Summary\n\n\`\`\`\n${status.errorSummary}\n\`\`\`\n\n`;
  }

  if (status.failedJobs && status.failedJobs.length > 0) {
    body += `### Failed Jobs\n\n`;
    status.failedJobs.forEach((job: any) => {
      body += `- [${job.name}](${job.html_url})\n`;
      if (job.failedSteps && job.failedSteps.length > 0) {
        job.failedSteps.forEach((step: any) => {
          body += `  - ❌ Step ${step.number}: ${step.name}\n`;
        });
      }
    });
    body += `\n`;
  }

  body += `### Next Steps\n\n`;
  body += `1. Review the [workflow run logs](${status.html_url})\n`;
  body += `2. Check for common issues:\n`;
  body += `   - Missing or incorrect Azure infrastructure files\n`;
  body += `   - Invalid azd template configuration\n`;
  body += `   - Docker image build failures\n`;
  body += `   - Resource deployment errors\n`;
  body += `3. Fix identified issues and re-run validation\n\n`;
  body += `---\n`;
  body += `*This issue was created automatically by [Template Doctor](https://github.com/Template-Doctor/template-doctor)*`;

  // Create GitHub issue URL with pre-filled data
  const issueUrl =
    `https://github.com/${owner}/${repo}/issues/new?` +
    `title=${encodeURIComponent(title)}&` +
    `body=${encodeURIComponent(body)}&` +
    `labels=bug,azd-validation`;

  // Open in new tab
  window.open(issueUrl, '_blank');

  showInfo('Issue Created', 'Opening GitHub issue form in new tab');
}

// Track if listeners are already registered to prevent duplicates
let listenersRegistered = false;

// Expose globally for compatibility
(window as any).testAzdProvision = testAzdProvision;

// Listen for validation requests from template cards and dashboard
if (!listenersRegistered) {
  document.addEventListener('template-card-validate', (e: any) => {
    const template = e.detail?.template;
    if (template?.repoUrl) {
      testAzdProvision(template.repoUrl);
    }
  });

  // Listen for dashboard button clicks (when reportData is available)
  document.addEventListener('DOMContentLoaded', () => {
    // Wire up test provision button if it exists
    const testProvisionButton =
      document.getElementById('testProvisionButton') ||
      document.getElementById('testProvisionButton-direct') ||
      document.getElementById('testProvisionButton-fallback');

    if (testProvisionButton) {
      testProvisionButton.addEventListener('click', () => {
        testAzdProvision();
      });
    }
  });

  listenersRegistered = true;
}

export { testAzdProvision as default };
