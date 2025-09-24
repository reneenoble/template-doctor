/**
 * GitHubClient patching module for Template Doctor
 * 
 * This module patches the GitHubClient to improve handling of SAML/SSO protected repositories
 * during batch scan operations.
 */

// Inject enhanced functions into GitHubClient prototype
function patchGitHubClient() {
  console.log('[Patch] Applying GitHub client patches for improved SAML/SSO handling');
  
  if (!window.GitHubClient) {
    console.warn('[Patch] GitHubClient not found, cannot apply patches');
    return false;
  }
  
  try {
    // Get GitHubClient prototype
    const prototype = Object.getPrototypeOf(window.GitHubClient);
    
    // Add waitForForkAvailability if not already present
    if (!prototype.waitForForkAvailability) {
      prototype.waitForForkAvailability = async function(owner, repo, maxAttempts = 10, intervalMs = 1500) {
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
      };
      console.log('[Patch] Added waitForForkAvailability method');
    }
    
    // Patch forkRepository with enhanced version that handles SAML/SSO better
    const originalForkRepository = prototype.forkRepository;
    prototype.forkRepository = async function(owner, repo, isBatchMode = false) {
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
    };
    console.log('[Patch] Enhanced forkRepository method with SAML/SSO detection');
    
    // Save reference to original method
    window.__TemplateDoctorPatches = window.__TemplateDoctorPatches || {};
    window.__TemplateDoctorPatches.originalForkRepository = originalForkRepository;
    
    return true;
  } catch (error) {
    console.error('[Patch] Failed to patch GitHubClient:', error);
    return false;
  }
}

// Create a patch for app.js checkAndUpdateRepoUrl function that's aware of batch mode
function getEnhancedCheckAndUpdateRepoUrl() {
  return async function(repoUrl, isBatchMode = false) {
    // If no URL or not a GitHub URL, return as is
    if (!repoUrl || !repoUrl.includes('github.com/')) {
      return repoUrl;
    }

    // Check if user is logged in
    if (!window.GitHubClient || !window.GitHubClient.auth.isAuthenticated()) {
      debug('app', 'User not logged in, cannot fork repositories');
      return repoUrl;
    }

    // Get current username
    const currentUsername = window.GitHubClient.auth.getUsername();
    if (!currentUsername) {
      debug('app', 'Cannot get current username');
      return repoUrl;
    }

    // Extract owner and repo from URL
    try {
      const urlParts = repoUrl.split('github.com/')[1].split('/');
      const owner = urlParts[0];
      const repo = urlParts[1];

      if (!owner || !repo) {
        throw new Error('Invalid repository URL format');
      }
      
      // If already in user's namespace, nothing to do
      if (owner.toLowerCase() === currentUsername.toLowerCase()) {
        return repoUrl;
      }

      // Determine if fork is desired due to org policy or explicit directive
      const directiveFork = /[?#].*fork/i.test(repoUrl);
      let needsFork = directiveFork || ORGANIZATIONS_CONFIG.organizationsToFork.some(
        (org) => owner.toLowerCase() === org.toLowerCase(),
      );

      // Optional legacy behavior: proactive upstream probe for SAML (guarded by config flag)
      let dueToSaml = false;
      if (window.TemplateDoctorConfig?.proactiveUpstreamProbe) {
        try {
          const tokenAccessor =
            window.GitHubClient?.auth?.getAccessToken?.bind(window.GitHubClient.auth) ||
            window.GitHubClient?.auth?.getToken?.bind(window.GitHubClient.auth);
          const token = tokenAccessor ? tokenAccessor() : null;
          if (token) {
            const probeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
              headers: { Authorization: `token ${token}` },
            });
            if (probeResp.status === 403) {
              let msg = '';
              try { msg = (await probeResp.json()).message || ''; } catch (_) {}
              if (/saml/i.test(msg)) {
                dueToSaml = true;
                needsFork = true;
                debug('app', `SAML enforcement detected (proactive) for ${owner}/${repo}`);
              }
            }
          }
        } catch (probeErr) {
          debug('app', 'Proactive probe error (ignored)', probeErr.message);
        }
      }

      // STEP 1: First check if user already has a fork WITHOUT probing upstream first
      try {
        debug('app', `Checking user namespace for existing fork: ${currentUsername}/${repo}`);
        const accessTokenFn =
          window.GitHubClient?.auth?.getAccessToken?.bind(window.GitHubClient.auth) ||
          window.GitHubClient?.auth?.getToken?.bind(window.GitHubClient.auth);
        const authToken = accessTokenFn ? accessTokenFn() : null;
        
        // Check if the user already has a fork of this repo
        const forkCandidateResp = await fetch(
          `https://api.github.com/repos/${currentUsername}/${repo}`,
          { headers: authToken ? { Authorization: `token ${authToken}` } : {} },
        );
        
        if (forkCandidateResp.ok) {
          const forkMeta = await forkCandidateResp.json().catch(() => null);
          
          // Check if this is actually a fork of the target repo
          if (forkMeta?.fork && forkMeta?.parent?.full_name?.toLowerCase() === `${owner}/${repo}`.toLowerCase()) {
            debug('app', 'Existing fork found; considering upstream sync');
            const forkUrl = `https://github.com/${currentUsername}/${repo}`;
            
            // Attempt to sync with upstream if directive or config requests it
            const shouldSync = /[?#].*fork/i.test(repoUrl) || window.TemplateDoctorConfig?.syncForksOnAnalyze;
            if (shouldSync) {
              try {
                const targetBranch = forkMeta.parent?.default_branch || forkMeta.default_branch || 'main';
                const tokenAccessor =
                  window.GitHubClient?.auth?.getAccessToken?.bind(window.GitHubClient.auth) ||
                  window.GitHubClient?.auth?.getToken?.bind(window.GitHubClient.auth);
                const token = tokenAccessor ? tokenAccessor() : null;
                if (token) {
                  const syncResp = await fetch(`https://api.github.com/repos/${currentUsername}/${repo}/merge-upstream`, {
                    method: 'POST',
                    headers: {
                      Authorization: `token ${token}`,
                      Accept: 'application/vnd.github+json',
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ branch: targetBranch }),
                  });
                  if (syncResp.ok) {
                    debug('app', 'Fork successfully synced with upstream');
                    if (window.NotificationSystem && !isBatchMode) {
                      window.NotificationSystem.showSuccess(
                        'Fork Synced',
                        `Updated fork from upstream (${targetBranch}) before analysis`,
                        4000,
                      );
                    }
                  } else {
                    const txt = await syncResp.text();
                    debug('app', `Fork sync not applied (status ${syncResp.status}): ${txt.substring(0,120)}`);
                  }
                }
              } catch (syncErr) {
                debug('app', `Fork sync error (ignored): ${syncErr.message}`);
              }
            }
            
            if (window.NotificationSystem && !isBatchMode) {
              window.NotificationSystem.showInfo(
                'Using Existing Fork',
                `Analyzing your fork of ${owner}/${repo}`,
                3000,
              );
            }
            return forkUrl;
          }
          
          // Repo exists but is not a fork of target; continue logic (will maybe still use upstream unless forced)
          if (!needsFork) {
            return repoUrl;
          }
        } else if (forkCandidateResp.status !== 404) {
          debug('app', `Unexpected status checking user fork: ${forkCandidateResp.status}`);
        }
      } catch (checkErr) {
        debug('app', 'Error checking user fork (non-fatal)', checkErr.message);
      }

      if (!needsFork) {
        return repoUrl; // No policy or directive requiring fork
      }

      // STEP 2: Construct potential fork URL
      const potentialForkUrl = `https://github.com/${currentUsername}/${repo}`;
      debug('app', `Original repo: ${repoUrl}, potential fork: ${potentialForkUrl}`);

      // STEP 3: Show confirmation dialog if configured and not due to proactive SAML detection
      // Skip confirmation in batch mode
      if (ORGANIZATIONS_CONFIG.requireConfirmationForFork && !dueToSaml && !directiveFork && !isBatchMode) {
        // Use notification system if available
        if (window.Notifications) {
          const result = await new Promise((resolve) => {
            window.Notifications.confirm(
              'Repository Fork',
              `This repository belongs to ${owner}. Would you like to check if you have a fork of this repository and use that instead?`,
              {
                confirmLabel: 'Check For Fork',
                cancelLabel: 'Use Original',
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
              },
            );
          });

          if (!result) {
            return repoUrl; // User declined, use original URL
          }
        } else {
          // Fallback to native confirm
          if (
            !confirm(
              `This repository belongs to ${owner}. Would you like to check if you have a fork of this repository and use that instead?`,
            )
          ) {
            return repoUrl; // User declined, use original URL
          }
        }
      }
      
      // STEP 4: Create fork if we reached this point
      try {
        debug('app', `Creating fork of ${owner}/${repo}`);
        
        // Try using the GitHub client for forking (with batch mode awareness)
        if (window.GitHubClient && typeof window.GitHubClient.forkRepository === 'function') {
          try {
            const forkData = await window.GitHubClient.forkRepository(owner, repo, isBatchMode);
            debug('app', `Fork created via GitHubClient: ${forkData.html_url}`);
            
            // Mark this fork as new this session to suppress history.json fetch
            try {
              window.__TemplateDoctorSession = window.__TemplateDoctorSession || { newForks: new Set() };
              window.__TemplateDoctorSession.newForks.add(`${currentUsername}/${repo}`.toLowerCase());
            } catch(_) {}
            
            return forkData.html_url;
          } catch (clientForkError) {
            // Check if this is a SAML/SSO related error
            const isSamlError = clientForkError.isSamlError || 
              (clientForkError.message && /saml|sso/i.test(clientForkError.message));
            
            if (isSamlError && isBatchMode) {
              debug('app', `SAML error detected in batch mode for ${owner}/${repo} - continuing with original URL`);
              return repoUrl; // Return original URL for batch mode when SAML error occurs
            }
            
            // For explicit fork directive in non-batch mode, rethrow the error
            if (directiveFork && !isBatchMode) {
              throw clientForkError;
            }
            
            // Fallback to direct API call if client method fails for other reasons
            debug('app', `GitHubClient fork failed (non-SAML): ${clientForkError.message}. Trying direct API.`);
          }
        }
        
        // Fallback to direct API call
        const forkTokenFn = window.GitHubClient?.auth?.getAccessToken?.bind(window.GitHubClient.auth) || 
          window.GitHubClient?.auth?.getToken?.bind(window.GitHubClient.auth);
        const forkToken = forkTokenFn ? forkTokenFn() : null;
        
        if (!forkToken) {
          debug('app', 'No auth token available for forking');
          if (directiveFork && !isBatchMode) {
            throw new Error('Authentication token not available for forking');
          }
          return repoUrl; // Return original URL if we can't authenticate
        }
        
        const forkResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/forks`, {
          method: 'POST',
          headers: { 
            Authorization: `token ${forkToken}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json'
          }
        });
        
        if (!forkResponse.ok) {
          let failureMsg = `${forkResponse.status} ${forkResponse.statusText}`;
          let errorData = null;
          
          try { 
            errorData = await forkResponse.json();
            if (errorData?.message) failureMsg = errorData.message;
          } catch(_) {}
          
          // Check for SAML/SSO errors
          const isSamlError = /saml|sso/i.test(failureMsg);
          
          if (isSamlError && window.NotificationSystem && !isBatchMode) {
            window.NotificationSystem.showWarning(
              'SAML Authorization Needed', 
              `GitHub requires SSO authorization before forking <strong>${owner}/${repo}</strong>. Please authorize and retry.`,
              8000
            );
          }
          
          // For SAML errors in batch mode, continue with original URL
          if (isSamlError && isBatchMode) {
            debug('app', `SAML restriction detected for ${owner}/${repo} in batch mode - using original URL`);
            return repoUrl;
          }
          
          // For explicit fork directive in non-batch mode, throw error
          if (directiveFork && !isBatchMode) {
            throw new Error(`Failed to create fork: ${failureMsg}`);
          }
          
          // Otherwise, fall back to original URL
          return repoUrl;
        }
        
        const forkData = await forkResponse.json();
        debug('app', `Fork created (pending availability): ${forkData.html_url}`);
        
        // Poll for default branch availability
        const pollStart = Date.now();
        const targetForkRepo = `${currentUsername}/${repo}`;
        let available = false;
        
        for (let i = 0; i < 18; i++) { // ~27s max
          try {
            const metaResp = await fetch(`https://api.github.com/repos/${targetForkRepo}`, {
              headers: forkToken ? { Authorization: `token ${forkToken}` } : {},
            });
            if (metaResp.ok) {
              const meta = await metaResp.json();
              if (meta?.default_branch) {
                available = true;
                break;
              }
            }
          } catch(_) {}
          await new Promise(r=>setTimeout(r,1500));
        }
        
        debug('app', `Fork availability ${(available?'confirmed':'timeout')} after ${(Date.now()-pollStart)/1000}s`);
        
        if (window.NotificationSystem && !isBatchMode) {
          window.NotificationSystem.showSuccess(
            'Fork Created', 
            `Fork ${available ? 'ready' : 'created'}: ${owner}/${repo} -> ${targetForkRepo}`,
            5000
          );
        }
        
        // Mark this fork as new this session to suppress history.json fetch
        try {
          window.__TemplateDoctorSession = window.__TemplateDoctorSession || { newForks: new Set() };
          window.__TemplateDoctorSession.newForks.add(targetForkRepo.toLowerCase());
        } catch(_) {}
        
        // Optional immediate upstream sync if config demands and fork ready
        if (available && window.TemplateDoctorConfig?.syncForksOnAnalyze) {
          try {
            const syncResp = await fetch(`https://api.github.com/repos/${targetForkRepo}/merge-upstream`, {
              method: 'POST',
              headers: forkToken ? { 
                Authorization: `token ${forkToken}`,
                Accept: 'application/vnd.github+json',
                'Content-Type':'application/json' 
              } : {'Content-Type':'application/json'},
              body: JSON.stringify({ branch: forkData?.default_branch || 'main' }),
            });
            
            if (syncResp.ok) {
              debug('app', 'Post-fork upstream merge applied');
            } else {
              debug('app', `Upstream merge skipped status=${syncResp.status}`);
            }
          } catch(syncErr) { 
            debug('app', `Upstream merge error ignored: ${syncErr.message}`);
          }        
        }
        
        return forkData.html_url;
      } catch (forkErr) {
        debug('app', `Fork creation failed: ${forkErr.message}`, forkErr);
        
        if (window.NotificationSystem && !isBatchMode) {
          window.NotificationSystem.showError('Fork Error', `Failed to create fork: ${forkErr.message}`, 6000);
        }
        
        // For explicit fork directive in non-batch mode, rethrow
        if (directiveFork && !isBatchMode) {
          throw forkErr;
        }
        
        // For batch mode or regular mode fallback to original URL
        return repoUrl;
      }
    } catch (parseError) {
      debug('app', `Error parsing repository URL: ${parseError.message}`, parseError);
      
      // For explicit fork directive in non-batch mode, rethrow
      if (!isBatchMode && /[?#].*fork/i.test(repoUrl)) {
        throw parseError;
      }
      
      return repoUrl; // Use original URL as fallback
    }
  };
}

// Export functions
window.TemplateDoctorPatches = {
  patchGitHubClient,
  getEnhancedCheckAndUpdateRepoUrl
};