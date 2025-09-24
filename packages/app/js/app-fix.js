/**
 * Check if a repository belongs to an organization that requires forking,
 * and offers to replace with the current user's fork
 * @param {string} repoUrl - Original repository URL
 * @param {boolean} isBatchMode - Whether this is being called from batch scan
 * @returns {Promise<string>} - New repository URL (might be the same or a user fork)
 */
async function checkAndUpdateRepoUrl(repoUrl, isBatchMode = false) {
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

    // First (new ordering): check if user already has fork WITHOUT probing upstream first
    try {
      debug('app', `Checking user namespace for existing fork: ${currentUsername}/${repo}`);
      const accessTokenFn =
        window.GitHubClient?.auth?.getAccessToken?.bind(window.GitHubClient.auth) ||
        window.GitHubClient?.auth?.getToken?.bind(window.GitHubClient.auth);
      const authToken = accessTokenFn ? accessTokenFn() : null;
      const forkCandidateResp = await fetch(
        `https://api.github.com/repos/${currentUsername}/${repo}`,
        { headers: authToken ? { Authorization: `token ${authToken}` } : {} },
      );
      if (forkCandidateResp.ok) {
        const forkMeta = await forkCandidateResp.json().catch(() => null);
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
                  if (window.NotificationSystem) {
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

    // Construct potential fork URL
    const potentialForkUrl = `https://github.com/${currentUsername}/${repo}`;
    debug('app', `Original repo: ${repoUrl}, potential fork: ${potentialForkUrl}`);

    // Show confirmation dialog if configured and not due to proactive SAML detection
    // Skip confirmation dialog in batch mode
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
    
    // Create fork (with optional confirmation above) if we got here
    let shouldCreateFork = true; // if we reach here, either directive or policy requested it

    if (shouldCreateFork) {
      try {
        debug('app', `Creating fork of ${owner}/${repo}`);
        if (window.NotificationSystem && !isBatchMode) {
          window.NotificationSystem.showInfo('Creating Fork', `Forking ${owner}/${repo} into your namespace...`, 4500);
        }
        const forkTokenFn = window.GitHubClient?.auth?.getAccessToken?.bind(window.GitHubClient.auth) || window.GitHubClient?.auth?.getToken?.bind(window.GitHubClient.auth);
        const forkToken = forkTokenFn ? forkTokenFn() : null;
        const forkResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/forks`, {
          method: 'POST',
          headers: forkToken ? { Authorization: `token ${forkToken}` } : {},
        });
        
        if (!forkResponse.ok) {
          let failureMsg = `${forkResponse.status} ${forkResponse.statusText}`;
          try { const j = await forkResponse.json(); if (j?.message) failureMsg = j.message; } catch(_) {}
          
          // Check if this is a SAML or SSO related error
          const isSamlError = /saml|sso/i.test(failureMsg);
          
          if (isSamlError && window.NotificationSystem && !isBatchMode) {
            window.NotificationSystem.showWarning('SAML Authorization Needed', `GitHub requires SSO authorization before forking <strong>${owner}/${repo}</strong>. Please authorize and retry.`, 8000);
          }
          
          // For SAML errors in batch mode, just return the original URL instead of throwing an error
          if (isSamlError && isBatchMode) {
            debug('app', `SAML restriction detected for ${owner}/${repo} in batch mode - using original URL`);
            return repoUrl;
          }
          
          throw new Error(`Failed to create fork: ${failureMsg}`);
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
          window.NotificationSystem.showSuccess('Fork Created', `Fork ${available ? 'ready' : 'created'}: ${owner}/${repo} -> ${targetForkRepo}`, 5000);
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
              headers: forkToken ? { Authorization: `token ${forkToken}`, Accept: 'application/vnd.github+json','Content-Type':'application/json' } : {'Content-Type':'application/json'},
              body: JSON.stringify({ branch: forkData?.default_branch || 'main' }),
            });
            if (syncResp.ok) {
              debug('app', 'Post-fork upstream merge applied');
            } else {
              debug('app', `Upstream merge skipped status=${syncResp.status}`);
            }
          } catch(syncErr) { debug('app', `Upstream merge error ignored: ${syncErr.message}`);}        
        }
        return forkData.html_url;
      } catch (forkErr) {
        debug('app', `Fork creation failed: ${forkErr.message}`, forkErr);
        
        // Check if this is a SAML/SSO related error for batch mode
        if (isBatchMode && (forkErr.isSamlError || /saml|sso/i.test(forkErr.message))) {
          debug('app', `SAML error detected during batch scan for ${owner}/${repo} - continuing with original URL`);
          return repoUrl; // Use original URL in batch mode for SAML errors
        }
        
        if (window.NotificationSystem && !isBatchMode) {
          window.NotificationSystem.showError('Fork Error', `Failed to create fork: ${forkErr.message}`, 6000);
        }
        
        // For batch mode, we want to continue with the original URL on fork errors
        if (isBatchMode) {
          return repoUrl;
        }
        
        // For explicit fork requests that fail, throw the error to prevent proceeding
        if (directiveFork) {
          throw forkErr;
        }
        
        return repoUrl; // fallback to upstream
      }
    }
    return repoUrl; // fallback if creation not pursued
  } catch (parseError) {
    debug('app', `Error parsing repository URL: ${parseError.message}`, parseError);
    
    // For batch mode, always return the original URL on errors
    if (isBatchMode) {
      return repoUrl;
    }
    
    // For explicit fork directives, throw the error
    if (/[?#].*fork/i.test(repoUrl)) {
      throw parseError;
    }
    
    return repoUrl; // Use original URL as fallback
  }
}