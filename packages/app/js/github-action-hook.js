// Template Doctor - GitHub Action Hook
// Sends analysis results to GitHub to create a PR with the results

/**
 * Submits template analysis results to the GitHub repository
 * @param {Object} result - Analysis result from the analyzer
 * @param {string} username - GitHub username of the person who ran the analysis
 * @returns {Promise<Object>} - Response from GitHub API
 */
async function submitAnalysisToGitHub(result, username) {
  if (!result || !username) {
    console.error('Cannot submit analysis: missing required parameters');
    return { success: false, error: 'Missing parameters' };
  }

  try {
    // Log analysis data for debugging
    console.log('Analysis data being submitted:', {
      repoUrl: result.repoUrl,
      ruleSet: result.ruleSet,
      username,
      timestamp: result.timestamp,
      complianceStats: {
        percentage:
          result.compliance.compliant.find((c) => c.id === 'compliance-summary')?.details
            ?.percentageCompliant || 0,
        passed: result.compliance.compliant.length,
        issues: result.compliance.issues.length,
      },
    });

    // Determine archiving flags (global config + one-time override)
    const cfg = window.TemplateDoctorConfig || {};
    // If a one-time override is set (from ruleset modal), prefer it when global is false
    let archiveEnabled = !!cfg.archiveEnabled;
    const hasOverride = Object.prototype.hasOwnProperty.call(
      cfg,
      'nextAnalysisArchiveEnabledOverride',
    );
    if (!archiveEnabled && hasOverride) {
      archiveEnabled = !!cfg.nextAnalysisArchiveEnabledOverride;
      // Clear one-time override after reading so it only applies to the next submission
      delete cfg.nextAnalysisArchiveEnabledOverride;
      window.TemplateDoctorConfig = cfg;
    }
    const archiveCollection = cfg.archiveCollection || 'aigallery';

    // Optionally allow front-end config to specify the target repo for repository_dispatch
    // Useful when the API environment cannot infer the workflow host repo from env
    const targetRepo = cfg.dispatchTargetRepo || '';

    // Extract necessary data from the result
    const payload = {
      repoUrl: result.repoUrl,
      ruleSet: result.ruleSet,
      username: username,
      timestamp: result.timestamp,
      analysisData: result,
      // Pass through centralized archive preferences so the workflow can act on them
      archiveEnabled,
      archiveCollection,
      // Optional override for the server to choose where to dispatch
      ...(targetRepo ? { targetRepo } : {}),
      compliance: {
        percentage:
          result.compliance.compliant.find((c) => c.id === 'compliance-summary')?.details
            ?.percentageCompliant || 0,
        passed: result.compliance.compliant.length,
        issues: result.compliance.issues.length,
      },
    };

    // Post via server to avoid org OAuth restrictions (uses server GH_WORKFLOW_TOKEN)
    // cfg already defined above
    const apiBase = cfg.apiBase || window.location.origin;
    const serverUrl = `${apiBase.replace(/\/$/, '')}/api/submit-analysis-dispatch`;
    console.log(`Submitting via server endpoint: ${serverUrl}`);

    // Build headers; include function key if provided by runtime config
    const headers = {
      'Content-Type': 'application/json',
    };
    if (cfg.functionKey) {
      headers['x-functions-key'] = cfg.functionKey;
    }

    // If calling a local Azure Function on 7071 and no function key supplied, warn early
    if (/^https?:\/\/localhost:7071\//i.test(serverUrl) && !cfg.functionKey) {
      console.warn('[analysis-dispatch] No functionKey configured for local Functions call; if the function auth level is not anonymous this will 401.');
    }

    console.log('Sending repository_dispatch event via server...');
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event_type: 'template-analysis-completed',
        client_payload: payload,
      }),
    });

    console.log('Server dispatch response status:', response.status);

    if (!response.ok) {
      const rawText = await response.text();
      console.error('Error response body:', rawText);
      let parsed;
      try { parsed = JSON.parse(rawText); } catch(_) {}
      const details = parsed || rawText;

      if (response.status === 404) {
        throw new Error('Endpoint not found (404): Verify the Azure Function name/path and apiBase.');
      }
      if (response.status === 401) {
        // Distinguish between server-to-GitHub bad token vs missing function key
        const textLower = rawText.toLowerCase();
        if (textLower.includes('bad credentials')) {
          throw new Error(
            'Server GitHub token returned Bad credentials. The workflow dispatch token (GH_WORKFLOW_TOKEN / PAT) is invalid or lacks scope.',
          );
        }
        if (!cfg.functionKey && /^https?:\/\/localhost:7071\//i.test(serverUrl)) {
          throw new Error(
            'Unauthorized (401) calling local Function: missing function key. Provide TemplateDoctorConfig.functionKey or set authLevel to anonymous.',
          );
        }
        throw new Error('Unauthorized (401): Server rejected request (check function key or server auth configuration).');
      }
      if (response.status === 403) {
        throw new Error(
          'Permission denied (403): Server token lacks required scopes or SSO not authorized. Approve SSO or update token scopes.',
        );
      }
      if (response.status === 429) {
        throw new Error('Rate limited (429): Please retry later.');
      }
      throw new Error(`Server error (${response.status}): ${typeof details === 'string' ? details : JSON.stringify(details)}`);
    }

    return {
      success: true,
      message: 'Analysis submitted successfully',
    };
  } catch (error) {
    console.error('Error submitting analysis to GitHub:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Export function for use in other modules
window.submitAnalysisToGitHub = submitAnalysisToGitHub;
