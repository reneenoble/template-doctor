// Enhanced GitHubClient methods to handle SAML/SSO repository forking properly

/**
 * Wait for a fork to become available in the user's namespace
 * @param {string} owner - Original repository owner
 * @param {string} repo - Repository name
 * @param {number} maxAttempts - Maximum number of polling attempts
 * @param {number} intervalMs - Interval between polling attempts in ms
 * @returns {Promise<Object|null>} - Fork repository data or null if timeout
 */
async function waitForForkAvailability(owner, repo, maxAttempts = 10, intervalMs = 1500) {
  const username = this.auth.getUsername();
  if (!username) {
    console.warn('[GitHubClient] Cannot poll fork availability: username unknown');
    return null;
  }

  console.log(`[GitHubClient] Polling for fork availability: ${username}/${repo}`);
  const startTime = Date.now();
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Wait before checking (except first attempt)
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
      
      // Check if fork exists and is ready
      const forkData = await this.request(`/repos/${username}/${repo}`);
      
      // Verify it's actually a fork of the target repo
      if (forkData?.fork && 
          forkData?.parent?.full_name?.toLowerCase() === `${owner}/${repo}`.toLowerCase() &&
          forkData?.default_branch) {
        
        const elapsed = (Date.now() - startTime) / 1000;
        console.log(`[GitHubClient] Fork available after ${elapsed.toFixed(1)}s (attempt ${attempt + 1}/${maxAttempts})`);
        return forkData;
      }
      
      console.log(`[GitHubClient] Fork not ready yet (attempt ${attempt + 1}/${maxAttempts})`);
    } catch (error) {
      if (error.status === 404) {
        console.log(`[GitHubClient] Fork not found yet (attempt ${attempt + 1}/${maxAttempts})`);
      } else {
        console.warn(`[GitHubClient] Error checking fork status: ${error.message || error}`);
      }
    }
  }
  
  console.warn(`[GitHubClient] Fork availability check timed out after ${maxAttempts} attempts`);
  return null;
}

/**
 * Fork a repository to the user's account with improved SAML/SSO error handling
 * @param {string} owner - Original repository owner
 * @param {string} repo - Repository name
 * @param {boolean} isBatchMode - Whether this is being called from batch scan
 * @returns {Promise<Object>} - Fork data
 */
async function forkRepository(owner, repo, isBatchMode = false) {
  if (window.NotificationSystem && !isBatchMode) {
    window.NotificationSystem.showInfo(
      'Creating Fork',
      `Creating a fork of ${owner}/${repo}...`,
      3000,
    );
  }

  try {
    const result = await this.request(`/repos/${owner}/${repo}/forks`, {
      method: 'POST',
    });

    if (window.NotificationSystem && !isBatchMode) {
      window.NotificationSystem.showSuccess(
        'Fork Created',
        `Successfully forked ${owner}/${repo} to your account`,
        3000,
      );
    }

    // After initiating the fork, wait until it becomes available under the user's namespace
    try {
      const confirmed = await this.waitForForkAvailability(owner, repo);
      if (confirmed) return confirmed; // Prefer returning the confirmed repo info
    } catch (e) {
      console.warn('[GitHubClient] Fork availability polling failed:', e?.message || e);
    }
    // Fall back to returning the immediate result if confirmation fails
    return result;
  } catch (error) {
    // Check if this is a SAML or SSO related error
    const isSamlError = error.status === 403 && 
      (error.data?.message?.toLowerCase().includes('saml') || 
        error.data?.message?.toLowerCase().includes('sso') ||
        error.message?.toLowerCase().includes('saml') ||
        error.message?.toLowerCase().includes('sso') ||
        error.data?.message?.toLowerCase().includes('organization access policy') ||
        error.message?.toLowerCase().includes('organization access policy') ||
        error.data?.message?.toLowerCase().includes('resource protected by organization') ||
        error.message?.toLowerCase().includes('resource protected by organization'));
    
    // Enhance the error object with SAML detection
    error.isSamlError = isSamlError;
    
    // In batch mode, we'll handle this differently in the caller
    if (isBatchMode && isSamlError) {
      console.warn(`SAML protection detected for ${owner}/${repo} in batch mode`);
    } else if (isSamlError && window.NotificationSystem) {
      window.NotificationSystem.showWarning(
        'SAML Authorization Needed', 
        `GitHub requires SSO authorization before forking <strong>${owner}/${repo}</strong>. Please authorize and retry.`,
        8000
      );
    }
    
    throw error;
  }
}