// Lightweight runtime config loader for Template Doctor
// Looks for a config.json alongside index.html and exposes window.TemplateDoctorConfig
// Shape example: { "apiBase": "https://your-functions.azurewebsites.net" }


(function () {
  const DEFAULTS = {
    // Prefer same-origin by default; override via config.json / env / meta tag
    apiBase: `${window.location.origin}`,
    defaultRuleSet: 'dod',
    requireAuthForResults: true,
    autoSaveResults: false,
    archiveEnabled: false,
    archiveCollection: 'aigallery',
    // Global deployment method switch: Azure Developer CLI enablement
    azureDeveloperCliEnabled: true,
    // Optional: explicit workflow host repo to dispatch to (owner/repo)
    dispatchTargetRepo: '',
    // Optional: enable AI enrichment on issue bodies (set via env/config)
    issueAIEnabled: false,
  };

  // Initialize with defaults so consumers have something synchronously
  window.TemplateDoctorConfig = Object.assign({}, DEFAULTS);

  // Use the ConfigLoader if available, otherwise fallback to direct fetch
  const loadConfig = async () => {
    try {
      if (window.ConfigLoader && window.ConfigLoader.loadConfig) {
        // Use our new unified ConfigLoader
        const config = await window.ConfigLoader.loadConfig();
        console.log('[runtime-config] loaded config via ConfigLoader');

        // Back-compat mapping: support both top-level { apiBase } and nested { backend: { baseUrl, functionKey } }
        const mapped = { ...config };
        if (!mapped.apiBase && config.backend && typeof config.backend.baseUrl === 'string') {
          mapped.apiBase = config.backend.baseUrl;
        }
        if (config.backend && typeof config.backend.functionKey === 'string') {
          mapped.functionKey = config.backend.functionKey;
        }

        // Also check for direct environment variables
        if (config.API_BASE_URL) {
          mapped.apiBase = config.API_BASE_URL;
        }
        if (config.FUNCTION_KEY) {
          mapped.functionKey = config.FUNCTION_KEY;
        }
        if (config.DISPATCH_TARGET_REPO) {
          mapped.dispatchTargetRepo = config.DISPATCH_TARGET_REPO;
        }
        // Feature flags propagated from server runtime-config
        if (typeof config.AZURE_DEVELOPER_CLI_ENABLED !== 'undefined') {
          const v3 = String(config.AZURE_DEVELOPER_CLI_ENABLED).trim().toLowerCase();
          mapped.azureDeveloperCliEnabled = /^(1|true|yes|on)$/i.test(v3);
        }
        if (typeof config.ISSUE_AI_ENABLED !== 'undefined') {
          const v = String(config.ISSUE_AI_ENABLED).trim().toLowerCase();
            mapped.issueAIEnabled = /^(1|true|yes|on)$/i.test(v);
        }
        // Map frontend overrides
        if (config.DEFAULT_RULE_SET) {
          mapped.defaultRuleSet = String(config.DEFAULT_RULE_SET).toLowerCase();
        }
        if (
          typeof config.REQUIRE_AUTH_FOR_RESULTS !== 'undefined' &&
          config.REQUIRE_AUTH_FOR_RESULTS !== null
        ) {
          const v = String(config.REQUIRE_AUTH_FOR_RESULTS).trim().toLowerCase();
          mapped.requireAuthForResults = /^(1|true|yes|on)$/i.test(v);
        }
        if (typeof config.AUTO_SAVE_RESULTS !== 'undefined' && config.AUTO_SAVE_RESULTS !== null) {
          const v2 = String(config.AUTO_SAVE_RESULTS).trim().toLowerCase();
          mapped.autoSaveResults = /^(1|true|yes|on)$/i.test(v2);
        }

        sanitizeAndAssign(mapped);
        return;
      }

  // Fallback to direct fetch
      const response = await fetch('config.json', { cache: 'no-store' });
      if (response.ok) {
        const cfg = await response.json();
        if (cfg && typeof cfg === 'object') {
          // Back-compat mapping: support both top-level { apiBase } and nested { backend: { baseUrl, functionKey } }
          const mapped = { ...cfg };
          if (!mapped.apiBase && cfg.backend && typeof cfg.backend.baseUrl === 'string') {
            mapped.apiBase = cfg.backend.baseUrl;
          }
          if (cfg.backend && typeof cfg.backend.functionKey === 'string') {
            mapped.functionKey = cfg.backend.functionKey;
          }
          if (cfg.defaultRuleSet) {
            mapped.defaultRuleSet = String(cfg.defaultRuleSet).toLowerCase();
          }
          if (typeof cfg.requireAuthForResults === 'boolean') {
            mapped.requireAuthForResults = cfg.requireAuthForResults;
          }
          if (typeof cfg.autoSaveResults === 'boolean') {
            mapped.autoSaveResults = cfg.autoSaveResults;
          }
          if (typeof cfg.archiveEnabled === 'boolean') {
            mapped.archiveEnabled = cfg.archiveEnabled;
          }
          if (typeof cfg.archiveCollection === 'string') {
            mapped.archiveCollection = cfg.archiveCollection;
          }
          if (typeof cfg.dispatchTargetRepo === 'string') {
            mapped.dispatchTargetRepo = cfg.dispatchTargetRepo;
          }
          if (typeof cfg.azureDeveloperCliEnabled === 'boolean') {
            mapped.azureDeveloperCliEnabled = cfg.azureDeveloperCliEnabled;
          } else if (typeof cfg.AZURE_DEVELOPER_CLI_ENABLED === 'string') {
            const v3 = cfg.AZURE_DEVELOPER_CLI_ENABLED.trim().toLowerCase();
            mapped.azureDeveloperCliEnabled = /^(1|true|yes|on)$/i.test(v3);
          }
          if (typeof cfg.issueAIEnabled === 'boolean') {
            mapped.issueAIEnabled = cfg.issueAIEnabled;
          } else if (typeof cfg.ISSUE_AI_ENABLED === 'string') {
            const v = cfg.ISSUE_AI_ENABLED.trim().toLowerCase();
            mapped.issueAIEnabled = /^(1|true|yes|on)$/i.test(v);
          }
          sanitizeAndAssign(mapped);
          console.log('[runtime-config] loaded config.json');
        } else {
          console.log('[runtime-config] no config.json found, using defaults');
        }
      }
    } catch (error) {
      console.error('[runtime-config] error loading config:', error);
      console.log('[runtime-config] using default configuration');
    }
  };

  /**
   * Central API base resolver.
   * Resolution precedence (first non-empty wins):
   * 1. ?apiBase= query parameter
   * 2. <meta name="template-doctor-api-base" content="...">
   * 3. Config / env provided apiBase
   * 4. Same-origin
   * Additionally, if we are NOT on localhost and the resolved apiBase still points to localhost,
   * we overwrite it with same-origin to avoid production calling back to dev endpoints.
   */
  function resolveApiBase(candidate) {
    try {
      const params = new URLSearchParams(window.location.search);
      const qp = params.get('apiBase');
      const meta = document.querySelector('meta[name="template-doctor-api-base"]');
      const metaContent = meta && meta.getAttribute('content');
      const fromConfig = candidate || '';
      let resolved = qp || metaContent || fromConfig || window.location.origin;

      const host = window.location.hostname;
      const isLocal = host === 'localhost' || host === '127.0.0.1';

      // GitHub-hosted CSP guard: if running on *.github.io or github.com context, block external apiBase
      // unless user explicitly opts in via forceExternalApi=1 (or allowExternalApi=1 for backwards naming tolerance).
      try {
        const pageHost = host;
        const externalOptIn = /^(1|true|yes|on)$/i.test(
          params.get('forceExternalApi') || params.get('allowExternalApi') || '',
        );
        let resolvedHost = null;
        try { resolvedHost = new URL(resolved).host; } catch {}
        const githubHosted = /\.github\.io$/i.test(pageHost) || /github\.com$/i.test(pageHost);
        if (
          githubHosted &&
          resolvedHost &&
          resolvedHost !== pageHost &&
          !externalOptIn &&
          !isLocal
        ) {
          console.warn(
            '[runtime-config] External apiBase blocked on GitHub-hosted page; falling back to same-origin. Append ?forceExternalApi=1 to override.',
            { attempted: resolved, pageHost },
          );
          resolved = window.location.origin;
          document.dispatchEvent(
            new CustomEvent('templatedoctor-apibase-external-blocked', {
              detail: { attempted: candidate, fallback: resolved },
            }),
          );
        }
      } catch (ghGuardErr) {
        console.debug('[runtime-config] github-hosted guard evaluation skipped', ghGuardErr);
      }

      // If deployed (not local) and apiBase references localhost, sanitize
      if (!isLocal && /localhost(:\d+)?/i.test(resolved)) {
        resolved = window.location.origin;
      }

      // Normalize: strip trailing slash
      if (resolved.endsWith('/')) resolved = resolved.slice(0, -1);
      return resolved;
    } catch (e) {
      console.warn('[runtime-config] resolveApiBase failed, falling back to origin', e);
      return window.location.origin;
    }
  }

  function sanitizeAndAssign(mapped) {
    const clone = { ...mapped };
    clone.apiBase = resolveApiBase(clone.apiBase);
    // Expose helper so other scripts have a single source of truth
    window.getTemplateDoctorApiBase = function () {
      return clone.apiBase || DEFAULTS.apiBase;
    };
    window.TemplateDoctorConfig = Object.assign({}, DEFAULTS, clone);
    // After assignment, probe for CSP or network blockage and fallback if necessary
    setTimeout(() => {
      try {
        const base = window.getTemplateDoctorApiBase();
        const origin = window.location.origin;
        if (!base || base === origin) return; // nothing to do
        const sameHost = (() => {
          try { return new URL(base).host === window.location.host; } catch { return false; }
        })();
        if (sameHost) return; // same host should already be allowed
        const probeUrl = base.replace(/\/$/, '') + '/api/client-settings?csp_probe=' + Date.now();
        // Use a short timeout race so we don't hang if blocked silently
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        fetch(probeUrl, { method: 'GET', cache: 'no-store', signal: controller.signal })
          .then((res) => {
            clearTimeout(timeout);
            if (!res.ok) {
              console.warn('[runtime-config] apiBase probe returned non-OK status', res.status, 'falling back to same-origin');
              forceSameOriginFallback();
            }
          })
          .catch((err) => {
            clearTimeout(timeout);
            // Likely CSP/network block
            console.warn('[runtime-config] apiBase probe failed, possible CSP block; falling back to same-origin', err);
            forceSameOriginFallback();
          });
      } catch (e) {
        console.warn('[runtime-config] apiBase probe setup failed', e);
      }
    }, 0);
  }

  function forceSameOriginFallback() {
    try {
      const origin = window.location.origin;
      window.TemplateDoctorConfig.apiBase = origin;
      window.getTemplateDoctorApiBase = function () { return origin; };
      console.log('[runtime-config] apiBase fallback applied ->', origin);
      document.dispatchEvent(new CustomEvent('templatedoctor-apibase-fallback', { detail: { apiBase: origin } }));
    } catch {}
  }

  // Execute the config loading
  loadConfig()
    .catch(() => {
      console.log('[runtime-config] failed to load config, using defaults');
    })
    .finally(() => {
      // If assignment never happened (e.g., early failure), ensure helpers exist
      if (typeof window.getTemplateDoctorApiBase !== 'function') {
        window.getTemplateDoctorApiBase = function () {
          // Last-resort sanitation
            const base = resolveApiBase(window.TemplateDoctorConfig && window.TemplateDoctorConfig.apiBase);
            return base;
        };
        // Re-sanitize existing global config in case it had localhost leakage
        const current = window.TemplateDoctorConfig || DEFAULTS;
        sanitizeAndAssign(current);
      }
    });
})();
