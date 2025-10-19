// TypeScript migration of templates-data-loader.js
// Loads template index data only after GitHubAuth reports authenticated state.
// Adds lightweight typings; behavior intentionally unchanged.

// Reuse existing global `ScannedTemplateEntry` from global.d.ts.
// (index-data.js populates window.templatesData with this shape.)

(function () {
  // Prevent duplicate loads
  let isLoaded = false;
  let isLoading = false;

  function log(...args: any[]) {
    try {
      console.log('[templates-loader]', ...args);
    } catch (_) {}
  }

  function dispatchLoaded() {
    // Only dispatch template-data-loaded once
    document.dispatchEvent(new CustomEvent('template-data-loaded'));
    log('Dispatched template-data-loaded event');
  }

  function showTilesLoadedDebug(count: number) {
    try {
      if (typeof document === 'undefined') return;
      const mount = () => {
        let el = document.getElementById('td-tiles-banner');
        if (!el) {
          el = document.createElement('div');
          el.id = 'td-tiles-banner';
          el.style.cssText =
            'position:fixed;right:12px;bottom:72px;z-index:9999;background:#111827;color:#fff;padding:8px 12px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.25);font-family:monospace;font-size:12px;opacity:0.9';
          document.body.appendChild(el);
        }
        const ts = new Date().toLocaleTimeString();
        el.textContent = `Tiles loaded: ${count} @ ${ts}`;
        setTimeout(() => {
          if (el) el.style.opacity = '0.2';
        }, 10000);
      };
      if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', mount, { once: true });
      else mount();
    } catch (_) {}
  }

  function loadScript(src: string) {
    return new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  }

  async function loadTemplateData() {
    // Prevent duplicate loads
    if (isLoading || isLoaded) {
      log('Already loaded or loading, skipping duplicate load');
      return;
    }

    isLoading = true;
    log('Loading template data from MongoDB API (auth confirmed)');

    try {
      // Load from MongoDB-backed API instead of filesystem
      const response = await fetch('/api/v4/results/latest?limit=200', {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Transform API response to match expected window.templatesData format
      if (data.results && Array.isArray(data.results)) {
        const templates = data.results.map((r: any) => ({
          repoUrl: r.repoUrl,
          owner: r.owner,
          repo: r.repo,
          ruleSet: r.latestAnalysis?.ruleSet || 'dod',
          timestamp: r.latestAnalysis?.scanDate
            ? new Date(r.latestAnalysis.scanDate).toLocaleDateString()
            : 'Unknown',
          relativePath: `/report.html?repo=${r.owner}/${r.repo}`, // Link to report page
          dashboardPath: `results/${r.owner}-${r.repo}/latest.json`,
          // Match the structure expected by index-data.js
          compliance: {
            percentage: r.latestAnalysis?.compliancePercentage || 0,
            issues: r.latestAnalysis?.issues || 0,
            passed: r.latestAnalysis?.passed || 0,
          },
          tags: r.tags || [],
          // AZD test data (if available)
          azdTest: r.latestAzdTest
            ? {
                status: r.latestAzdTest.status,
                timestamp: r.latestAzdTest.timestamp,
                testId: r.latestAzdTest.testId,
                duration: r.latestAzdTest.duration,
                azdUpSuccess: r.latestAzdTest.result?.azdUpSuccess,
                azdDownSuccess: r.latestAzdTest.result?.azdDownSuccess,
              }
            : null,
          // Also keep latestAnalysis for compatibility
          latestAnalysis: r.latestAnalysis,
        }));
        window.templatesData = templates;
        log('Loaded from MongoDB API:', templates.length, 'templates');
        showTilesLoadedDebug(templates.length);
      } else {
        log('API response missing results array');
        window.templatesData = [];
        showTilesLoadedDebug(0);
      }
    } catch (e: any) {
      log('Failed to load template data from API:', e?.message || e);
      // Fallback to empty array
      if (!Array.isArray(window.templatesData)) window.templatesData = [];
      showTilesLoadedDebug(0);
    } finally {
      isLoading = false;
      isLoaded = true;
      dispatchLoaded();
    }
  }

  let authPollAttempts = 0;
  const AUTH_POLL_MAX = 200; // 200 * (progressive ~100-500ms) < ~1 minute worst case
  const AUTH_POLL_BASE_DELAY = 100;

  function scheduleNextAuthPoll() {
    authPollAttempts++;
    if (authPollAttempts > AUTH_POLL_MAX) {
      log(
        `GitHubAuth not detected after ${AUTH_POLL_MAX} attempts; proceeding with empty templatesData (deferred load)`,
      );
      if (!Array.isArray(window.templatesData)) window.templatesData = [];
      dispatchLoaded();
      return;
    }
    // Progressive backoff: min 100ms, grows to 500ms
    const delay = Math.min(AUTH_POLL_BASE_DELAY * (1 + Math.floor(authPollAttempts / 10)), 500);
    setTimeout(initialize, delay);
  }

  function initialize() {
    if (authPollAttempts % 25 === 0) {
      log('Checking GitHubAuth readiness (attempt ' + authPollAttempts + ')');
    }
    const auth = (window as any).GitHubAuth;
    if (auth && typeof auth.isAuthenticated === 'function') {
      try {
        if (auth.isAuthenticated()) {
          loadTemplateData();
        } else {
          // One-time empty set exposure (avoid repeated log noise)
          if (!Array.isArray(window.templatesData)) {
            log('User not authenticated yet; exposing empty templatesData');
            window.templatesData = [];
            dispatchLoaded();
          }
          // Wait for auth-state-changed event rather than hot looping
        }
      } catch (e) {
        log('Auth check threw error; scheduling retry', (e as any)?.message || e);
        scheduleNextAuthPoll();
        return;
      }
    } else {
      scheduleNextAuthPoll();
    }
  }

  document.addEventListener('auth-state-changed', (e: any) => {
    try {
      if (e.detail && e.detail.authenticated && !isLoaded && !isLoading) {
        log('Auth changed to authenticated; loading templates');
        loadTemplateData();
      }
    } catch (_) {}
  });

  initialize();
})();
