// Migrated from js/api-routes.js (behavior preserved) – now typed.

interface ApiRouteBuildOptions {
  versionOverride?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
}

interface TemplateDoctorConfigShape {
  apiBase?: string;
  apiVersion?: string;
  backend?: {
    apiVersion?: string;
    baseUrl?: string;
  };
  [k: string]: any; // keep loose until full config typing pass
}

interface ApiRoutesGlobal {
  build: (path: string, options?: ApiRouteBuildOptions) => string;
  currentVersion: () => string | null;
}

(function initApiRoutes() {
  function normalizeBase(rawBase: unknown): string {
    if (!rawBase) return '';
    return String(rawBase).replace(/\/$/, '');
  }

  function getApiBase(): string {
    const cfg: TemplateDoctorConfigShape = (window as any).TemplateDoctorConfig || {};

    // SIMPLIFIED: Trust the config. Period.
    // Runtime-config.ts and config-loader.ts handle all the complex logic.
    // We just read the final answer.
    console.log('[api-routes] getApiBase called, config:', {
      hasConfig: !!cfg,
      apiBase: cfg.apiBase,
      backendBaseUrl: cfg.backend?.baseUrl,
    });

    if (cfg.apiBase) {
      console.log('[api-routes] Using cfg.apiBase:', cfg.apiBase);
      return normalizeBase(cfg.apiBase);
    }
    if (cfg.backend?.baseUrl) {
      console.log('[api-routes] Using cfg.backend.baseUrl:', cfg.backend.baseUrl);
      return normalizeBase(cfg.backend.baseUrl);
    }

    // Emergency fallback only - this should never happen if config loaded properly
    console.warn(
      '[api-routes] No apiBase in config! Using window.location.origin as emergency fallback',
    );
    return normalizeBase(window.location.origin);
  }

  function getVersionPrefix(path: string, version: string | undefined): string {
    // Always use v4 for now - simplify the logic
    const defaultVersion = 'v4';
    const effectiveVersion = version || defaultVersion;

    const trimmed = path.replace(/^\//, '');

    // If the path already includes the full API prefix, just return /api
    if (trimmed.startsWith(`api/${effectiveVersion}/`)) {
      return '/api';
    }

    // Otherwise, add the version prefix
    return `/api/${effectiveVersion}`;
  }

  function build(path: string, options?: ApiRouteBuildOptions): string {
    const cfg: TemplateDoctorConfigShape = (window as any).TemplateDoctorConfig || {};
    const version: string | undefined =
      (options && options.versionOverride) || cfg.apiVersion || cfg.backend?.apiVersion || '';
    const trimmed = String(path || '').replace(/^\//, '');
    const prefix = getVersionPrefix(trimmed, version);
    const base = getApiBase();
    let url = `${base}${prefix}/${trimmed}`.replace(/([^:])\/+/, '$1/');
    const query = options && options.query;
    if (query && typeof query === 'object') {
      const qp = Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      if (qp) url += (url.includes('?') ? '&' : '?') + qp;
    }
    return url;
  }

  function currentVersion(): string | null {
    if (!(window as any).TemplateDoctorConfig) return null;
    const cfg: TemplateDoctorConfigShape = (window as any).TemplateDoctorConfig;
    return cfg.apiVersion || cfg.backend?.apiVersion || null;
  }

  // Expose dynamic property-style routes for backward compatibility with legacy tests/code
  // Each property is a getter so that changes to apiBase or version are reflected lazily.
  const routes: any = { build, currentVersion };

  const endpointMap: Record<string, string> = {
    // Legacy name -> canonical function route
    runtimeConfig: 'client-settings', // old frontend expected /runtime-config; now served at /client-settings
    clientSettings: 'client-settings',
    analyzeTemplate: 'analyze-template',
    validationTemplate: 'validation-template',
    validationStatus: 'validation-status',
    validationCancel: 'validation-cancel',
    validationOssf: 'validation-ossf',
    validationDockerImage: 'validation-docker-image',
    issueCreate: 'issue-create',
    githubOAuthToken: 'github-oauth-token',
    setup: 'setup',
  };

  for (const [prop, path] of Object.entries(endpointMap)) {
    Object.defineProperty(routes, prop, {
      get: () => build(path),
      enumerable: true,
      configurable: false,
    });
  }

  // Provide eagerly-evaluated snapshot properties for early tests that simply check truthiness.
  // These will not auto-update if apiBase changes post-load, but runtime-config loads immediately after.
  try {
    (routes as any).runtimeConfig = build('client-settings');
    (routes as any).clientSettings = build('client-settings');
  } catch {}

  (window as any).ApiRoutes = routes as ApiRoutesGlobal & Record<string, string>;
})();

export {}; // ensure this file is a module
