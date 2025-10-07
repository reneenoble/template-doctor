// TypeScript migration of templates-data-loader.js
// Loads template index data only after GitHubAuth reports authenticated state.
// Adds lightweight typings; behavior intentionally unchanged.

// Reuse existing global `ScannedTemplateEntry` from global.d.ts.
// (index-data.js populates window.templatesData with this shape.)

(function () {
  function log(...args: any[]) {
    try {
      console.log('[templates-loader]', ...args);
    } catch (_) {}
  }

  function dispatchLoaded() {
    document.dispatchEvent(new CustomEvent('template-data-loaded'));
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
    log('Loading template data (auth confirmed)');
    const cacheBuster = '?_cb=' + Date.now();
    try {
      await loadScript('results/scan-meta-backfill.js' + cacheBuster).catch(() => {
        log('scan-meta-backfill.js not found; continuing');
      });
      log('scan-meta-backfill.js processed, loading index-data.js');
      await loadScript('results/index-data.js' + cacheBuster);
      if (Array.isArray(window.templatesData)) {
        log('templatesData loaded entries:', window.templatesData.length);
        try {
          showTilesLoadedDebug(window.templatesData.length);
        } catch (_) {}
      } else {
        log('templatesData missing or invalid, initializing empty array');
        window.templatesData = [];
        try {
          showTilesLoadedDebug(0);
        } catch (_) {}
      }
    } catch (e) {
      log('Failed to load template data scripts', e);
      if (!Array.isArray(window.templatesData)) window.templatesData = [];
      try {
        showTilesLoadedDebug(0);
      } catch (_) {}
    } finally {
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
      if (e.detail && e.detail.authenticated) {
        log('Auth changed to authenticated; loading templates');
        loadTemplateData();
      }
    } catch (_) {}
  });

  initialize();
})();
