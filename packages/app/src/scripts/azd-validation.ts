/* AZD Provision Test and Live Log Streaming */
import { ApiClient } from './api-client';

let currentRunId: string | null = null;
let currentGithubRunId: string | null = null;
let currentGithubRunUrl: string | null = null;
let currentWorkflowOrgRepo: string | null = null;
let currentTemplateUrl: string | null = null; // Store the template repo URL being validated
let pollingInterval: number | null = null;
let logElement: HTMLPreElement | null = null;
let stopButton: HTMLButtonElement | null = null;
let isValidationRunning = false;

// AZD validation results (from backend artifact parsing)
interface AzdValidationResult {
  azdUpSuccess: boolean;
  azdUpTime: string | null;
  azdDownSuccess: boolean;
  azdDownTime: string | null;
  psRuleErrors: number;
  psRuleWarnings: number;
  securityStatus: 'pass' | 'warnings' | 'errors';
  overallStatus: 'success' | 'warning' | 'failure';
  resultFileContent: string;
}

/**
 * Shows troubleshooting tips to help user during long workflow runs
 * Called immediately when validation starts to provide guidance
 */
function showTroubleshootingTips(container: HTMLElement, errorText: string = ''): void {
  // Remove existing tips if present
  const existing = document.getElementById('azd-troubleshooting-tips');
  if (existing) {
    existing.remove();
  }

  const troubleshootingSection = document.createElement('div');
  troubleshootingSection.id = 'azd-troubleshooting-tips';
  troubleshootingSection.style.cssText = `
    margin: 20px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  `;

  // Check for specific errors for conditional styling
  const hasUnmatchedPrincipalError =
    /UnmatchedPrincipalType[\s\S]*has type[\s\S]*ServicePrincipal[\s\S]*different from[\s\S]*PrinciaplType[\s\S]*User/i.test(
      errorText,
    );

  // Tip 1: Region Availability
  const tip1 = document.createElement('div');
  tip1.style.cssText = `
    background: #f0f9ff;
    border: 1px solid #0078d4;
    border-radius: 8px;
    padding: 12px 15px;
    display: flex;
    gap: 12px;
    align-items: start;
  `;
  tip1.innerHTML = `
    <span style="font-size: 20px; flex-shrink: 0;">💡</span>
    <div style="flex: 1;">
      <strong style="color: #0078d4; font-size: 14px; display: block; margin-bottom: 6px;">Tip: Region Availability</strong>
      <p style="margin: 0 0 8px 0; color: #555; font-size: 13px; line-height: 1.5;">
        Models are available in certain regions only. If you encounter a Region Availability error, check the troubleshooting guide and update your template's README.md to reflect available regions.
      </p>
      <a href="https://github.com/Azure-Samples/azd-template-artifacts/blob/main/docs/development-guidelines/trouble-shooting.md#region-availability" 
         target="_blank" 
         style="color: #0078d4; text-decoration: none; font-size: 13px; font-weight: 500;">
        📖 View Region Availability Guide →
      </a>
    </div>
  `;

  // Tip 2: UnmatchedPrincipalType Error (highlight if detected)
  const tip2 = document.createElement('div');
  tip2.style.cssText = `
    background: ${hasUnmatchedPrincipalError ? '#fff8e1' : '#f0f9ff'};
    border: 2px solid ${hasUnmatchedPrincipalError ? '#ff9800' : '#0078d4'};
    border-radius: 8px;
    padding: 12px 15px;
    display: flex;
    gap: 12px;
    align-items: start;
  `;
  tip2.innerHTML = `
    <span style="font-size: 20px; flex-shrink: 0;">💡</span>
    <div style="flex: 1;">
      <strong style="color: ${hasUnmatchedPrincipalError ? '#e65100' : '#0078d4'}; font-size: 14px; display: block; margin-bottom: 6px;">
        Tip: UnmatchedPrincipalType Error${hasUnmatchedPrincipalError ? ' ⚠️ DETECTED' : ''}
      </strong>
      <p style="margin: 0 0 4px 0; color: #555; font-size: 13px; line-height: 1.5;">
        <strong>Error:</strong> UnmatchedPrincipalType with ServicePrincipal vs User type mismatch.
      </p>
      <p style="margin: 0 0 8px 0; color: #555; font-size: 13px; line-height: 1.5;">
        <strong>Solution:</strong> Create a flag to avoid assigning principal type to service, assign to current user instead.
      </p>
      <a href="https://github.com/Azure-Samples/azure-openai-assistant-javascript/pull/18/files" 
         target="_blank" 
         style="color: #0078d4; text-decoration: none; font-size: 13px; font-weight: 500;">
        📖 View Example Fix →
      </a>
    </div>
  `;

  // Tip 3: BCP332 maxLength Error
  const tip3 = document.createElement('div');
  tip3.style.cssText = `
    background: #f0f9ff;
    border: 1px solid #0078d4;
    border-radius: 8px;
    padding: 12px 15px;
    display: flex;
    gap: 12px;
    align-items: start;
  `;
  tip3.innerHTML = `
    <span style="font-size: 20px; flex-shrink: 0;">💡</span>
    <div style="flex: 1;">
      <strong style="color: #0078d4; font-size: 14px; display: block; margin-bottom: 6px;">Tip: BCP332 maxLength Error</strong>
      <p style="margin: 0 0 4px 0; color: #555; font-size: 13px; line-height: 1.5;">
        <strong>Error:</strong> Provided value length exceeds maxLength constraint in Bicep parameter.
      </p>
      <p style="margin: 0 0 8px 0; color: #555; font-size: 13px; line-height: 1.5;">
        <strong>Solution:</strong> Increase the maxLength property in main.bicep to accommodate longer inputs.
      </p>
    </div>
  `;

  troubleshootingSection.appendChild(tip1);
  troubleshootingSection.appendChild(tip2);
  troubleshootingSection.appendChild(tip3);

  container.appendChild(troubleshootingSection);
}

/**
 * Displays AZD validation results from artifact data (parsed by backend)
 * Replaces the old log-based parsing approach
 */
function displayAzdValidationResults(
  container: HTMLElement,
  azdValidation: AzdValidationResult,
  githubRunUrl: string,
): void {
  const statusIcon = {
    success: '✅',
    warning: '⚠️',
    failure: '❌',
  }[azdValidation.overallStatus];

  const statusClass = {
    success: 'validation-success',
    warning: 'validation-warning',
    failure: 'validation-failure',
  }[azdValidation.overallStatus];

  const statusMessage = {
    success: 'Template validation passed',
    warning: 'Template validation passed with warnings',
    failure: 'Template validation failed',
  }[azdValidation.overallStatus];

  // Build details HTML
  const azdUpIcon = azdValidation.azdUpSuccess ? '✅' : '❌';
  const azdDownIcon = azdValidation.azdDownSuccess ? '✅' : '❌';
  const azdUpTime = azdValidation.azdUpTime ? ` (${azdValidation.azdUpTime})` : '';
  const azdDownTime = azdValidation.azdDownTime ? ` (${azdValidation.azdDownTime})` : '';

  let securityLine = '';
  if (azdValidation.securityStatus === 'pass') {
    securityLine = '✅ Security Scan passed';
  } else if (azdValidation.securityStatus === 'warnings') {
    securityLine = `⚠️ Security Scan: ${azdValidation.psRuleWarnings} warnings`;
  } else {
    securityLine = `❌ Security Scan: ${azdValidation.psRuleErrors} errors`;
  }

  // Generate unique ID for collapsible details
  const detailsId = `azd-details-${Date.now()}`;

  // Escape HTML in the markdown content for safe display
  const escapedContent = (azdValidation.resultFileContent || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  container.innerHTML = `
        <div class="validation-result ${statusClass}">
            <div class="validation-header">
                <span class="validation-icon">${statusIcon}</span>
                <span class="validation-message">${statusMessage}</span>
            </div>
            <div class="validation-details">
                <div class="validation-step">
                    <span class="step-icon">${azdUpIcon}</span>
                    <span class="step-name">AZD Up${azdUpTime}</span>
                </div>
                <div class="validation-step">
                    <span class="step-icon">${azdDownIcon}</span>
                    <span class="step-name">AZD Down${azdDownTime}</span>
                </div>
                <div class="validation-step">
                    <span class="step-text">${securityLine}</span>
                </div>
            </div>
            <div class="validation-actions">
                <a href="${githubRunUrl}" target="_blank" class="btn-view-logs">
                    View Full Logs
                </a>
            </div>
            ${
              azdValidation.resultFileContent
                ? `
                <details class="validation-details-panel" style="margin-top: 15px;">
                    <summary style="cursor: pointer; padding: 10px; background: rgba(0, 0, 0, 0.05); border-radius: 6px; font-weight: 500; user-select: none;">
                        📋 Show Full Validation Details
                    </summary>
                    <div style="margin-top: 10px; padding: 15px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; max-height: 500px; overflow-y: auto;">
                        <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; line-height: 1.5;">${escapedContent}</pre>
                    </div>
                </details>
            `
                : ''
            }
        </div>
    `;
}

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

  // Remove old status elements if they exist (they'll be recreated in controls container)
  const existingStatusBar = document.getElementById('azd-status-bar');
  if (existingStatusBar) existingStatusBar.remove();
  const existingPrincipalError = document.getElementById('azd-principal-error');
  if (existingPrincipalError) existingPrincipalError.remove();
  const existingIssueSection = document.getElementById('azd-issue-section');
  if (existingIssueSection) existingIssueSection.remove();
  const existingErrorDetails = document.getElementById('azd-error-details');
  if (existingErrorDetails) existingErrorDetails.remove();
  const existingFailedJobs = document.getElementById('azd-failed-jobs');
  if (existingFailedJobs) existingFailedJobs.remove();
  const existingGhRunLink = document.getElementById('azd-gh-run-link');
  if (existingGhRunLink) existingGhRunLink.remove();
  const existingLogsArchive = document.getElementById('azd-logs-archive-link');
  if (existingLogsArchive) existingLogsArchive.remove();
  const existingSuccessTile = document.getElementById('azd-success-tile');
  if (existingSuccessTile) existingSuccessTile.remove();

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

  // Create controls container with cancel button
  const controls = document.createElement('div');
  controls.id = 'azd-provision-controls';
  controls.style.cssText = 'margin: 0 0 10px 0; display: flex; flex-direction: column; gap: 10px;';

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

  // Store template URL and start time for later use
  currentTemplateUrl = templateUrl;
  try {
    localStorage.setItem('lastValidationStartTime', Date.now().toString());
  } catch (e) {
    console.warn('Failed to save validation start time:', e);
  }

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

    const token = localStorage.getItem('gh_access_token');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
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
    currentTemplateUrl = templateUrl; // Store the template URL for issue creation

    appendLog(logElement, `✓ Validation started`);
    appendLog(logElement, `Run ID: ${currentRunId}`);

    if (currentGithubRunId) {
      appendLog(logElement, `GitHub Run ID: ${currentGithubRunId}`);
    }

    if (currentGithubRunUrl) {
      appendLog(logElement, `GitHub Run URL: ${currentGithubRunUrl}`);

      // Add clickable button in controls with dynamic elapsed time
      const controlsContainer = document.getElementById('azd-provision-controls');
      if (controlsContainer && !document.getElementById('azd-gh-run-link')) {
        const linkDiv = document.createElement('div');
        linkDiv.id = 'azd-gh-run-link';
        linkDiv.style.cssText =
          'margin: 0 0 15px 0; padding: 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; gap: 15px;';

        const linkButton = document.createElement('button');
        linkButton.textContent = '🔗 View GitHub Actions Run';
        linkButton.style.cssText =
          'background: #0078d4; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;';
        linkButton.onclick = () => window.open(currentGithubRunUrl!, '_blank');

        // Add elapsed time counter with spinner (same as analysis)
        const elapsedDiv = document.createElement('div');
        elapsedDiv.id = 'azd-elapsed-time';
        elapsedDiv.style.cssText =
          'display: flex; align-items: center; gap: 10px; color: #666; font-size: 14px; font-weight: 500;';

        // Start time tracking
        const startTime = Date.now();
        (window as any).azdStartTime = startTime; // Store for final time calculation
        const updateElapsed = () => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const minutes = Math.floor(elapsed / 60);
          const seconds = elapsed % 60;
          const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

          elapsedDiv.innerHTML = `
            <i class="fas fa-spinner fa-spin" style="color: #0078d4;"></i>
            <span>${timeStr} elapsed</span>
          `;
        };

        updateElapsed();
        const elapsedInterval = setInterval(updateElapsed, 1000);

        // Store interval ID to clear it later
        (window as any).azdElapsedInterval = elapsedInterval;

        linkDiv.appendChild(linkButton);
        linkDiv.appendChild(elapsedDiv);
        controlsContainer.appendChild(linkDiv);
      }
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

    // Save initial test status to database
    try {
      appendLog(logElement, '💾 Saving test status to database...');
      const token = localStorage.getItem('gh_access_token');
      await fetch(`${apiBase}/api/v4/azd-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          repoUrl: templateUrl,
          status: 'running',
          startedAt: new Date().toISOString(),
        }),
      });
      appendLog(logElement, '✓ Test status saved');
    } catch (dbError: any) {
      console.warn('Failed to save test status to database:', dbError);
      appendLog(logElement, `⚠ Database save failed: ${dbError.message}`);
    }

    // Show troubleshooting tips immediately (to help user during long wait)
    if (logElement?.parentElement) {
      showTroubleshootingTips(logElement.parentElement);
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

    const token = localStorage.getItem('gh_access_token');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        runId: currentRunId,
        githubRunId: currentGithubRunId,
        githubRunUrl: currentGithubRunUrl,
        workflowOrgRepo: currentWorkflowOrgRepo,
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

      const token = localStorage.getItem('gh_access_token');
      const response = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
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

      // Check for logs archive URL - move to controls
      if (status.logsArchiveUrl && !document.getElementById('azd-logs-archive-link')) {
        const controlsContainer = document.getElementById('azd-provision-controls');
        if (controlsContainer) {
          const linkDiv = document.createElement('div');
          linkDiv.id = 'azd-logs-archive-link';
          linkDiv.style.cssText =
            'margin: 0 0 15px 0; padding: 12px; background: #f0f9ff; border: 1px solid #0078d4; border-radius: 6px;';
          linkDiv.innerHTML = `<a href="${status.logsArchiveUrl}" target="_blank" style="color: #0078d4; text-decoration: none; font-weight: 500;">📥 Download Logs Archive</a>`;
          controlsContainer.appendChild(linkDiv);
        }
      }

      // Check if workflow is complete
      if (status.status === 'completed' || status.conclusion) {
        stopPolling();
        isValidationRunning = false;

        // Stop the elapsed time counter animation and freeze final time
        if ((window as any).azdElapsedInterval) {
          clearInterval((window as any).azdElapsedInterval);
          (window as any).azdElapsedInterval = null;

          // Update elapsed time one last time and remove animation
          const elapsedDiv = document.getElementById('azd-elapsed-time');
          if (elapsedDiv) {
            const startTime = (window as any).azdStartTime || Date.now();
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

            // Display final time WITHOUT spinner
            elapsedDiv.innerHTML = `
              <i class="fa-regular fa-clock" style="color: #0078d4; font-size: 16px;"></i>
              <span><strong>Total time:</strong> ${timeStr}</span>
            `;
          }
        }

        // Get AZD validation results from artifact data (parsed by backend)
        const azdValidation = status.azdValidation;

        const controlsContainer = document.getElementById('azd-provision-controls');
        if (!controlsContainer) {
          console.error('[azd-validation] Controls container not found!');
          return;
        }

        // Display validation results if artifact data is available
        if (azdValidation) {
          displayAzdValidationResults(controlsContainer, azdValidation, status.html_url);

          // Save validation results to database
          try {
            const startTime = localStorage.getItem('lastValidationStartTime');
            const duration = startTime ? Date.now() - parseInt(startTime, 10) : undefined;

            const token = localStorage.getItem('gh_access_token');
            await fetch(`${apiBase}/api/v4/azd-test`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
              },
              body: JSON.stringify({
                repoUrl: currentTemplateUrl,
                status: azdValidation.overallStatus === 'success' ? 'success' : 'failed',
                completedAt: new Date().toISOString(),
                duration,
                result: {
                  deploymentTime: duration,
                  githubRunUrl: currentGithubRunUrl,
                  azdUpSuccess: azdValidation.azdUpSuccess,
                  azdDownSuccess: azdValidation.azdDownSuccess,
                  azdUpTime: azdValidation.azdUpTime,
                  azdDownTime: azdValidation.azdDownTime,
                  psRuleErrors: azdValidation.psRuleErrors,
                  psRuleWarnings: azdValidation.psRuleWarnings,
                  securityStatus: azdValidation.securityStatus,
                  overallStatus: azdValidation.overallStatus,
                },
              }),
            });
            appendLog(logElement!, '💾 Validation results saved to database');
          } catch (dbError: any) {
            console.warn('Failed to save validation results:', dbError);
          }
        } else {
          // Fallback: artifact not yet available or workflow too old
          const conclusion = status.conclusion || 'unknown';
          controlsContainer.innerHTML = `
            <div class="validation-result validation-${conclusion}">
              <p>Workflow ${conclusion}</p>
              <p>⚠️ Detailed validation results not available. 
                 <a href="${status.html_url}" target="_blank" style="color: #4fc3f7;">View workflow logs</a>
              </p>
            </div>
          `;
        }

        // Update troubleshooting tips with error context (if tips already shown)
        const errorText = status.errorSummary || '';
        if (errorText && logElement?.parentElement) {
          // Refresh tips with error context for conditional highlighting
          showTroubleshootingTips(logElement.parentElement, errorText);
        }

        // Add "Create Issue" button if validation failed or had warnings
        const hasIssues =
          !azdValidation ||
          azdValidation.overallStatus === 'failure' ||
          azdValidation.overallStatus === 'warning';

        if (hasIssues && currentGithubRunUrl && !document.getElementById('azd-issue-section')) {
          const issueSection = document.createElement('div');
          issueSection.id = 'azd-issue-section';
          issueSection.style.cssText =
            'margin: 15px 0; padding: 15px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px;';

          const issueButton = document.createElement('button');
          issueButton.textContent = '🐛 Create GitHub Issue';
          issueButton.style.cssText =
            'width: 100%; background: #0078d4; color: white; border: none; padding: 12px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;';
          issueButton.onmouseover = () => (issueButton.style.background = '#005a9e');
          issueButton.onmouseout = () => (issueButton.style.background = '#0078d4');
          issueButton.onclick = async () => {
            await createValidationIssue(status, azdValidation);
          };

          issueSection.appendChild(issueButton);
          controlsContainer.appendChild(issueSection);
        }

        // Show notification based on overall status
        if (azdValidation) {
          if (azdValidation.overallStatus === 'success') {
            showSuccess('Validation Complete', 'Template validation passed!');
          } else if (azdValidation.overallStatus === 'warning') {
            showInfo('Validation Warning', 'Template passed with warnings');
          } else {
            showError('Validation Failed', 'Template validation encountered errors');
          }
        } else if (status.conclusion === 'success') {
          showSuccess('Validation Complete', 'Workflow completed successfully');
        } else if (status.conclusion === 'failure') {
          showError('Validation Failed', 'Workflow failed');
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
async function createValidationIssue(status: any, azdResults?: AzdValidationResult | null) {
  // Use the stored template URL from the current validation
  const targetRepoUrl = currentTemplateUrl || '';

  if (!targetRepoUrl) {
    showError(
      'Missing Information',
      'Cannot determine target repository. Please ensure validation was started with a valid repo URL.',
    );
    return;
  }

  // Extract owner/repo from URL
  const match = targetRepoUrl.match(/https?:\/\/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    showError('Invalid URL', 'Could not parse repository from URL');
    return;
  }

  const [, owner, repo] = match;

  // Extract actual validation errors from the markdown content
  let errorSummary = '';

  if (azdResults?.resultFileContent) {
    const markdown = azdResults.resultFileContent;

    // Extract failed deployment steps (lines with (x) Failed:)
    const failedSteps = markdown.match(/\(x\) Failed:.*$/gm) || [];

    // Extract security scan warnings/errors (under Security Requirements section)
    const securityMatch = markdown.match(/## Security Requirements:([\s\S]*?)(?=##|$)/);
    const securitySection = securityMatch ? securityMatch[1].trim() : '';

    // Build error summary from actual validation content
    if (failedSteps.length > 0) {
      errorSummary += `**Deployment Failures:**\n`;
      failedSteps.forEach((step) => {
        errorSummary += `- ${step.replace('(x) Failed:', '').trim()}\n`;
      });
      errorSummary += `\n`;
    }

    if (securitySection && (azdResults.psRuleErrors > 0 || azdResults.psRuleWarnings > 0)) {
      errorSummary += `**Security Scan Issues:**\n`;
      errorSummary += securitySection + '\n\n';
    }
  }

  if (!errorSummary) {
    errorSummary = status.errorSummary || 'Validation failed. See workflow logs for details.';
  }

  // Build Copilot-friendly prompt as issue title and body
  const title = `[Template Doctor] Fix validation errors in Azure template`;

  let body = `Please help fix the following Azure template validation errors:\n\n`;

  body += `## Validation Report\n\n`;
  body += `**Repository:** ${targetRepoUrl}\n`;
  body += `**Validation Run:** ${status.html_url || currentGithubRunUrl || 'N/A'}\n`;
  body += `**Date:** ${new Date().toISOString()}\n\n`;

  // Add AZD operation summary
  if (azdResults) {
    body += `## Validation Results\n\n`;
    body += `- **AZD Up:** ${azdResults.azdUpSuccess ? `✅ Success ${azdResults.azdUpTime ? `(${azdResults.azdUpTime})` : ''}` : '❌ Failed'}\n`;
    body += `- **AZD Down:** ${azdResults.azdDownSuccess ? `✅ Success ${azdResults.azdDownTime ? `(${azdResults.azdDownTime})` : ''}` : '❌ Failed'}\n`;
    body += `- **Security Scan:** ${azdResults.securityStatus === 'pass' ? '✅ Pass' : azdResults.securityStatus === 'warnings' ? `⚠️ ${azdResults.psRuleWarnings} warnings` : `❌ ${azdResults.psRuleErrors} errors`}\n`;
    body += `- **Overall Status:** ${azdResults.overallStatus === 'success' ? '✅ Success' : azdResults.overallStatus === 'warning' ? '⚠️ Warning' : '❌ Failure'}\n\n`;
  }

  // Add the actual errors from validation (not workflow errors)
  body += `## Issues Found\n\n`;
  body += errorSummary;

  // Add Copilot task prompt
  body += `## Task\n\n`;
  body += `Please analyze these validation errors and:\n`;
  body += `1. Identify the root cause of each failure\n`;
  body += `2. Suggest specific code changes to fix the issues\n`;
  body += `3. Update the relevant Bicep/infrastructure files\n`;
  body += `4. Ensure the template follows [Azure Developer CLI best practices](https://learn.microsoft.com/azure/developer/azure-developer-cli/)\n\n`;

  // Add reference links
  body += `## References\n\n`;
  body += `- [Validation Workflow Logs](${status.html_url})\n`;
  body += `- [AZD Template Best Practices](https://learn.microsoft.com/azure/developer/azure-developer-cli/make-azd-compatible)\n`;
  body += `- [PSRule for Azure](https://azure.github.io/PSRule.Rules.Azure/)\n\n`;

  // Add full validation details in collapsible section
  if (azdResults?.resultFileContent) {
    body += `<details>\n`;
    body += `<summary>Full Validation Details</summary>\n\n`;
    body += `\`\`\`\n${azdResults.resultFileContent}\n\`\`\`\n\n`;
    body += `</details>\n\n`;
  }

  body += `---\n`;
  body += `*This issue was created automatically by [Template Doctor](https://github.com/Template-Doctor/template-doctor)*`;

  // Use GraphQL API to create issue and auto-assign to Copilot
  const labels = ['bug', 'azd-validation'];

  // Get GitHub client instance
  const gh = (window as any).GitHubClient;

  if (!gh || typeof gh.createIssueGraphQL !== 'function') {
    // Fallback: open issue form in browser
    const issueUrl =
      `https://github.com/${owner}/${repo}/issues/new?` +
      `title=${encodeURIComponent(title)}&` +
      `body=${encodeURIComponent(body)}&` +
      `labels=${labels.join(',')}`;
    window.open(issueUrl, '_blank');
    showInfo('Issue Created', 'Opening GitHub issue form (GraphQL unavailable)');
    return;
  }

  try {
    // Show loading notification
    const loadingNotification = showLoading(
      'Creating Issue',
      'Creating GitHub issue and assigning to Copilot...',
    );

    // Create issue via GraphQL (automatically assigns to copilot-agent-swe if available)
    const createdIssue = await gh.createIssueGraphQL(owner, repo, title, body, labels);

    // Close loading notification
    if (loadingNotification && typeof loadingNotification.close === 'function') {
      loadingNotification.close();
    }

    // Show success and open issue in new tab
    showSuccess('Issue Created', `Issue #${createdIssue.number} created and assigned to Copilot`);
    window.open(createdIssue.url, '_blank');
  } catch (error: any) {
    console.error('Failed to create issue via GraphQL:', error);

    // Fallback: open issue form in browser
    const issueUrl =
      `https://github.com/${owner}/${repo}/issues/new?` +
      `title=${encodeURIComponent(title)}&` +
      `body=${encodeURIComponent(body)}&` +
      `labels=${labels.join(',')}`;
    window.open(issueUrl, '_blank');
    showError(
      'Issue Creation Failed',
      `Could not auto-create issue: ${error.message}. Opening form in browser.`,
    );
  }
}

// Track if listeners are already registered to prevent duplicates
let listenersRegistered = false;

// Expose globally for compatibility
(window as any).testAzdProvision = testAzdProvision;

// Listen for validation requests from template cards and dashboard
if (!listenersRegistered) {
  // Add custom event listener with guard to prevent duplicate triggers
  document.addEventListener('template-card-validate', (e: any) => {
    const template = e.detail?.template;
    if (template?.repoUrl) {
      // Additional guard: check if validation is already running before calling
      if (isValidationRunning) {
        console.warn('[azd-validation] Ignoring duplicate template-card-validate event');
        return;
      }
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
        // Guard against double-click or rapid successive clicks
        if (isValidationRunning) {
          console.warn('[azd-validation] Ignoring click - validation already running');
          return;
        }
        testAzdProvision();
      });
    }
  });

  listenersRegistered = true;
}

export { testAzdProvision as default };
