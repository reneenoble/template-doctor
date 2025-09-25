// Template data loader
// This script loads template data from the results directory index-data.js
// Only authenticated users can see template data
(function () {
  function loadTemplateData() {
    // Check if the user is authenticated using GitHubAuth
    console.log(
      '[templates-data-loader] Checking authentication status:',
      window.GitHubAuth ? 'GitHubAuth exists' : 'GitHubAuth missing',
      window.GitHubAuth?.isAuthenticated
        ? 'isAuthenticated method exists'
        : 'isAuthenticated method missing',
      window.GitHubAuth?.isAuthenticated
        ? 'Auth state: ' + window.GitHubAuth.isAuthenticated()
        : 'Cannot check auth state',
    );

    if (
      window.GitHubAuth &&
      window.GitHubAuth.isAuthenticated &&
      window.GitHubAuth.isAuthenticated()
    ) {
      console.log('[templates-data-loader] User is authenticated, loading template data');

      const cacheBuster = '?_cb=' + new Date().getTime();
      // Load dynamic scan meta first so index-data can merge entries
      const metaScript = document.createElement('script');
      metaScript.src = 'results/scan-meta-backfill.js' + cacheBuster;
      metaScript.async = true;
      metaScript.onload = function () {
        console.log('[templates-data-loader] Loaded scan-meta-backfill.js');
        loadIndexData();
      };
      metaScript.onerror = function () {
        console.warn('[templates-data-loader] scan-meta-backfill.js not found; proceeding without it');
        loadIndexData();
      };
      document.head.appendChild(metaScript);

      function loadIndexData(){
        const script = document.createElement('script');
        script.src = 'results/index-data.js' + cacheBuster;
        script.async = true;
        script.onload = function () {
          console.log('[templates-data-loader] Successfully loaded template data');
          if (window.templatesData && Array.isArray(window.templatesData)) {
            console.log('[templates-data-loader] Loaded templatesData with', window.templatesData.length, 'entries');
            try { showTilesLoadedDebug(window.templatesData.length); } catch(_) {}
          } else {
            console.warn('[templates-data-loader] templatesData is not available or not an array after loading');
            window.templatesData = [];
            try { showTilesLoadedDebug(0); } catch(_) {}
          }
          document.dispatchEvent(new CustomEvent('template-data-loaded'));
        };
        script.onerror = function (error) {
          console.warn('[templates-data-loader] Failed to load template data from results/index-data.js', error);
          window.templatesData = [];
          try { showTilesLoadedDebug(0); } catch(_) {}
          document.dispatchEvent(new CustomEvent('template-data-loaded'));
        };
        document.head.appendChild(script);
      }

      // Visible debug banner to confirm tile count on homepage
      function showTilesLoadedDebug(count){
        if (typeof document === 'undefined') return;
        // Defer until DOM ready
        const mount = () => {
          let el = document.getElementById('td-tiles-banner');
          if (!el) {
            el = document.createElement('div');
            el.id = 'td-tiles-banner';
            el.style.cssText = [
              'position:fixed',
              'right:12px',
              'bottom:72px',
              'z-index:9999',
              'background:#111827',
              'color:#fff',
              'padding:8px 12px',
              'border-radius:6px',
              'box-shadow:0 2px 8px rgba(0,0,0,0.25)',
              'font-family:monospace',
              'font-size:12px',
              'opacity:0.9'
            ].join(';');
            document.body.appendChild(el);
          }
          const ts = new Date().toLocaleTimeString();
          el.textContent = `Tiles loaded: ${count} @ ${ts}`;
          // Auto-fade after 10s to avoid clutter
          setTimeout(() => { if (el) el.style.opacity = '0.2'; }, 10000);
        };
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', mount, { once: true });
        } else {
          mount();
        }
      }
    } else {
      console.log('[templates-data-loader] User is not authenticated, not loading template data');
      // Initialize empty array since user is not authenticated
      window.templatesData = [];
      document.dispatchEvent(new CustomEvent('template-data-loaded'));
    }
  }

  // We need to delay loading until GitHubAuth is initialized
  function initializeLoader() {
    console.log('[templates-data-loader] Checking if GitHubAuth is initialized');
    if (window.GitHubAuth) {
      console.log('[templates-data-loader] GitHubAuth found, loading template data');
      loadTemplateData();
    } else {
      // Wait for GitHubAuth to be initialized
      console.log('[templates-data-loader] Waiting for GitHubAuth to be initialized');
      setTimeout(initializeLoader, 100);
    }
  }

  // Listen for auth-state-changed events
  document.addEventListener('auth-state-changed', function (e) {
    console.log('[templates-data-loader] Received auth-state-changed event:', e.detail);
    if (e.detail && e.detail.authenticated) {
      console.log(
        '[templates-data-loader] Auth state changed to authenticated, loading template data',
      );
      loadTemplateData();
    }
  });

  // Start initialization process
  initializeLoader();
})();
