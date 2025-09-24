/**
 * Template Doctor SAML/SSO Batch Scan Patch Loader
 * 
 * This script patches the GitHub client and repository URL handling functions 
 * to improve support for SAML/SSO protected repositories in batch scan mode.
 * 
 * Usage:
 * 1. Include this script after the main application scripts
 * 2. It will automatically apply the patches when loaded
 */

(function() {
  // Wait for document to be ready
  function initPatches() {
    console.log('[PatchLoader] Initializing Template Doctor SAML/SSO batch scan patches');
    
    // Check if we've already been initialized
    if (window.__TemplateDoctorPatchesApplied) {
      console.log('[PatchLoader] Patches already applied, skipping');
      return;
    }
    
    try {
      // Apply patches when GitHubClient is available
      const checkAndApplyPatches = () => {
        if (window.GitHubClient) {
          // Apply GitHub client patches
          if (window.TemplateDoctorPatches?.patchGitHubClient) {
            const clientPatched = window.TemplateDoctorPatches.patchGitHubClient();
            console.log(`[PatchLoader] GitHubClient patch ${clientPatched ? 'succeeded' : 'failed'}`);
          } else {
            console.warn('[PatchLoader] GitHubClient patch function not found');
          }
          
          // Replace checkAndUpdateRepoUrl function to handle batch mode
          if (typeof window.checkAndUpdateRepoUrl === 'function' && 
              window.TemplateDoctorPatches?.getEnhancedCheckAndUpdateRepoUrl) {
            // Save original function for reference
            window.__originalCheckAndUpdateRepoUrl = window.checkAndUpdateRepoUrl;
            
            // Replace with enhanced version
            window.checkAndUpdateRepoUrl = window.TemplateDoctorPatches.getEnhancedCheckAndUpdateRepoUrl();
            console.log('[PatchLoader] checkAndUpdateRepoUrl function enhanced for batch mode');
          } else if (typeof window.checkAndUpdateRepoUrl !== 'function') {
            console.warn('[PatchLoader] checkAndUpdateRepoUrl function not found, patches may not be fully applied');
          }
          
          // Enhance batch scan handlers if available
          if (window.processBatchUrls && typeof window.processBatchUrls === 'function') {
            const originalProcessBatchUrls = window.processBatchUrls;
            window.processBatchUrls = async function(urls, options) {
              console.log('[PatchLoader] Using enhanced batch processing with SAML/SSO handling');
              
              // Process each URL with batch mode flag
              try {
                // Filter out empty URLs
                const validUrls = urls.filter(url => url && url.trim());
                
                // Map to enrich with fork handling
                const processPromises = validUrls.map(async (url) => {
                  try {
                    // Pass batch mode flag to checkAndUpdateRepoUrl
                    const resolvedUrl = await window.checkAndUpdateRepoUrl(url, true);
                    return resolvedUrl;
                  } catch (err) {
                    console.warn(`[PatchLoader] Error in batch URL processing for ${url}:`, err.message);
                    return url; // Continue with original URL on error
                  }
                });
                
                // Wait for all URLs to be processed
                const resolvedUrls = await Promise.all(processPromises);
                
                // Call original function with resolved URLs
                return originalProcessBatchUrls.call(this, resolvedUrls, options);
              } catch (err) {
                console.error('[PatchLoader] Error in batch processing:', err);
                return originalProcessBatchUrls.call(this, urls, options);
              }
            };
            console.log('[PatchLoader] processBatchUrls function enhanced for SAML/SSO handling');
          }
          
          // Mark patches as applied
          window.__TemplateDoctorPatchesApplied = true;
          console.log('[PatchLoader] All patches applied successfully');
          
          // Remove init callback
          document.removeEventListener('DOMContentLoaded', checkAndApplyPatches);
          window.removeEventListener('load', checkAndApplyPatches);
          clearInterval(patchInterval);
        }
      };
      
      // Define interval variable first to avoid reference error
      let patchInterval;
      
      // Try to apply patches now if document is already loaded
      checkAndApplyPatches();
      
      // Set up event listeners and interval to ensure patches are applied
      document.addEventListener('DOMContentLoaded', checkAndApplyPatches);
      window.addEventListener('load', checkAndApplyPatches);
      patchInterval = setInterval(checkAndApplyPatches, 500);
      
      // Safety timeout to clear interval if patches never apply
      setTimeout(() => {
        if (!window.__TemplateDoctorPatchesApplied) {
          clearInterval(patchInterval);
          console.warn('[PatchLoader] Timed out waiting for GitHubClient to be available');
        }
      }, 30000);
    } catch (err) {
      console.error('[PatchLoader] Error initializing patches:', err);
    }
  }
  
  // Initialize patches
  initPatches();
})();