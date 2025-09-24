# Batch Scan Fix for SAML/SSO Repository Access

## Problem

When performing a batch scan, the application fails when it encounters repositories that are protected by SAML/SSO authentication. The current implementation tries to fork these repositories but doesn't handle the SAML/SSO errors gracefully in batch mode, causing the entire batch scan to fail.

## Solution

The solution involves two main changes:

1. Update the `checkAndUpdateRepoUrl` function to handle SAML/SSO errors differently in batch mode
2. Ensure the batch scan process continues with the original repository URL when forking fails due to SAML/SSO requirements

### Changes to `github-client-new.js`

Enhance the `forkRepository` method to better detect SAML/SSO errors:

```javascript
/**
 * Fork a repository to the user's account with better error handling for batch scans
 * @param {string} owner - Original repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} - Fork data or error with special properties
 */
async forkRepository(owner, repo) {
  try {
    const result = await this.request(`/repos/${owner}/${repo}/forks`, {
      method: 'POST',
    });
    return result;
  } catch (error) {
    // Check if this is a SAML or SSO related error
    const isSamlError = 
      (error.response?.status === 403 && /saml|sso/i.test(error.response?.data?.message)) ||
      (error.message && /saml|sso/i.test(error.message));
    
    // Enhance the error object with SAML detection
    error.isSamlError = isSamlError;
    
    console.error(`Error forking repository ${owner}/${repo}:`, error);
    throw error;
  }
}
```

### Changes to `app.js`

Update the `checkAndUpdateRepoUrl` function to accept a `isBatchMode` parameter and handle SAML/SSO errors differently in batch mode:

```javascript
/**
 * Check if a repository belongs to an organization that requires forking,
 * and offers to replace with the current user's fork
 * @param {string} repoUrl - Original repository URL
 * @param {boolean} isBatchMode - Whether this is being called from batch scan
 * @returns {Promise<string>} - New repository URL (might be the same or a user fork)
 */
async function checkAndUpdateRepoUrl(repoUrl, isBatchMode = false) {
  // ... (existing code)

  // Skip confirmation dialog in batch mode
  if (ORGANIZATIONS_CONFIG.requireConfirmationForFork && !dueToSaml && !directiveFork && !isBatchMode) {
    // ... (existing confirmation dialog code)
  }

  // ... (existing fork creation code)

  // For SAML errors in batch mode, just return the original URL instead of throwing an error
  if (isSamlError && isBatchMode) {
    debug('app', `SAML restriction detected for ${owner}/${repo} in batch mode - using original URL`);
    return repoUrl;
  }

  // For batch mode, we want to continue with the original URL on fork errors
  if (isBatchMode) {
    return repoUrl;
  }
  
  // ... (rest of existing code)
}
```

### Changes to Batch Scan Process

Update the repository check in the batch scan process:

```javascript
// First check if the repository needs to be forked
let processedUrl = url;
try {
  // Pass true as the second parameter to indicate batch mode
  processedUrl = await checkAndUpdateRepoUrl(url, true);

  if (processedUrl !== url) {
    itemElement.querySelector('.batch-item-message').textContent =
      'Using fork of the repository...';
  } else {
    itemElement.querySelector('.batch-item-message').textContent =
      'Analyzing repository...';
  }
} catch (forkError) {
  debug('app', `Error during fork check: ${forkError.message}`, forkError);
  itemElement.querySelector('.batch-item-message').textContent =
    'Proceeding with original repository...';
  // Always fall back to original URL on error in batch mode
  processedUrl = url;
}
```

## Implementation Strategy

1. Update `forkRepository` in `github-client-new.js` to detect and flag SAML/SSO errors
2. Modify `checkAndUpdateRepoUrl` in `app.js` to accept a batch mode parameter and handle SAML/SSO errors gracefully in batch mode
3. Update the repository check in the batch scan process to use the updated function with batch mode enabled

This implementation ensures that batch scans will continue processing even when encountering repositories that require SAML/SSO authentication, making the feature more robust and user-friendly.