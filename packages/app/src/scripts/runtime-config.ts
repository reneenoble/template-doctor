// TypeScript migration of legacy js/runtime-config.js
// Provides a unified runtime configuration resolver exposed via window.TemplateDoctorConfig
// and helper window.getTemplateDoctorApiBase(). The logic is intentionally a near‑parity
// port with incremental typing and small internal refactors for clarity.

/* eslint-disable @typescript-eslint/no-explicit-any */

interface RuntimeConfig {
  apiBase: string;
  defaultRuleSet: string;
  requireAuthForResults: boolean;
  autoSaveResults: boolean;
  archiveEnabled: boolean;
  archiveCollection: string;
  azureDeveloperCliEnabled: boolean;
  dispatchTargetRepo: string;
  issueAIEnabled: boolean;
  functionKey?: string;
  [k: string]: any; // Allow forwards compatible flags
}

// (No additional global Window augmentation here – rely on declarations in global.d.ts to avoid conflicts.)

const DEFAULTS: RuntimeConfig = {
  apiBase: window.location.origin,
  defaultRuleSet: 'dod',
  requireAuthForResults: true,
  autoSaveResults: false,
  archiveEnabled: false,
  archiveCollection: 'aigallery',
  azureDeveloperCliEnabled: true,
  dispatchTargetRepo: '',
  issueAIEnabled: false,
};

// Pre‑seed so synchronous consumers have a shape.
// Use a typed cast rather than interface augmentation to avoid duplicate declaration conflicts.
const W = window as any;
W.TemplateDoctorConfig = { ...DEFAULTS };

// Config readiness promise - other modules can await this
let configReadyResolve: () => void;
W.TemplateDoctorConfigReady = new Promise<void>((resolve) => {
  configReadyResolve = resolve;
});

async function loadConfig(): Promise<void> {
  try {
    if (W.ConfigLoader?.loadConfig) {
      const raw = await W.ConfigLoader.loadConfig();
      console.log('[runtime-config.ts] loaded via ConfigLoader');
      assignMapped(raw);
      return;
    }
    // Fallback to direct config.json fetch
    const res = await fetch('config.json', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      console.log('[runtime-config.ts] loaded config.json');
      assignMapped(json);
    } else {
      console.log('[runtime-config.ts] no config.json (status ' + res.status + '), using defaults');
    }
  } catch (err) {
    console.error('[runtime-config.ts] error loading config', err);
  } finally {
    // Ensure helpers exist even on failure
    if (typeof W.getTemplateDoctorApiBase !== 'function') {
      W.getTemplateDoctorApiBase = () => resolveApiBase(W.TemplateDoctorConfig.apiBase);
      sanitizeAndAssign(W.TemplateDoctorConfig);
    }
  }
}

function coerceBoolean(v: any): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (v == null) return undefined;
  const s = String(v).trim().toLowerCase();
  if (!s) return undefined;
  return /^(1|true|yes|on)$/i.test(s);
}

function assignMapped(input: Record<string, any>): void {
  const mapped: Record<string, any> = { ...input };
  // Back compat nested backend
  // Previously this only applied if apiBase was falsy. However we seed apiBase with window.location.origin
  // before fetching config.json, so backend.baseUrl in the config was silently ignored.
  // New logic: if backend.baseUrl exists and the current apiBase is still the seeded origin (or empty),
  // promote backend.baseUrl to apiBase. An explicit apiBase property still wins.
  try {
    const seededOrigin = window.location.origin;
    const current = mapped.apiBase;
    if (input.backend?.baseUrl) {
      if (!current || current === seededOrigin) {
        mapped.apiBase = input.backend.baseUrl;
        console.log('[runtime-config.ts] Promoted backend.baseUrl to apiBase:', mapped.apiBase);
      }
    }
  } catch {
    /* non-browser safety */
  }
  if (input.backend?.functionKey) mapped.functionKey = input.backend.functionKey;
  if (input.API_BASE_URL) mapped.apiBase = input.API_BASE_URL;
  if (input.FUNCTION_KEY) mapped.functionKey = input.FUNCTION_KEY;
  if (input.DISPATCH_TARGET_REPO) mapped.dispatchTargetRepo = input.DISPATCH_TARGET_REPO;

  // Feature flags / mappings
  const azureCli = coerceBoolean(
    input.azureDeveloperCliEnabled ?? input.AZURE_DEVELOPER_CLI_ENABLED,
  );
  if (typeof azureCli === 'boolean') mapped.azureDeveloperCliEnabled = azureCli;
  const issueAI = coerceBoolean(input.issueAIEnabled ?? input.ISSUE_AI_ENABLED);
  if (typeof issueAI === 'boolean') mapped.issueAIEnabled = issueAI;
  const requireAuth = coerceBoolean(input.requireAuthForResults ?? input.REQUIRE_AUTH_FOR_RESULTS);
  if (typeof requireAuth === 'boolean') mapped.requireAuthForResults = requireAuth;
  const autoSave = coerceBoolean(input.autoSaveResults ?? input.AUTO_SAVE_RESULTS);
  if (typeof autoSave === 'boolean') mapped.autoSaveResults = autoSave;
  if (input.defaultRuleSet || input.DEFAULT_RULE_SET) {
    mapped.defaultRuleSet = String(input.defaultRuleSet || input.DEFAULT_RULE_SET).toLowerCase();
  }
  if (typeof input.archiveEnabled === 'boolean') mapped.archiveEnabled = input.archiveEnabled;
  if (typeof input.archiveCollection === 'string')
    mapped.archiveCollection = input.archiveCollection;

  sanitizeAndAssign(mapped as RuntimeConfig);
}

function resolveApiBase(candidate?: string): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const qp = params.get('apiBase');
    const meta = document.querySelector('meta[name="template-doctor-api-base"]');
    const metaContent = meta?.getAttribute('content');
    const fromConfig = candidate || '';
    let resolved = qp || metaContent || fromConfig || window.location.origin;
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';

    // GitHub hosted guard
    try {
      const externalOptIn = /^(1|true|yes|on)$/i.test(
        params.get('forceExternalApi') || params.get('allowExternalApi') || '',
      );
      let resolvedHost: string | null = null;
      try {
        resolvedHost = new URL(resolved).host;
      } catch {}
      const githubHosted = /\.github\.io$/i.test(host) || /github\.com$/i.test(host);
      if (githubHosted && resolvedHost && resolvedHost !== host && !externalOptIn && !isLocal) {
        console.warn(
          '[runtime-config.ts] External apiBase blocked on GitHub-hosted page; falling back to same-origin',
          { attempted: resolved, host },
        );
        resolved = window.location.origin;
        document.dispatchEvent(
          new CustomEvent('templatedoctor-apibase-external-blocked', {
            detail: { attempted: candidate, fallback: resolved },
          }),
        );
      }
    } catch (guardErr) {
      console.debug('[runtime-config.ts] github-hosted guard skipped', guardErr);
    }

    if (!isLocal && /localhost(:\d+)?/i.test(resolved)) {
      resolved = window.location.origin;
    }
    if (resolved.endsWith('/')) resolved = resolved.slice(0, -1);
    return resolved;
  } catch (e) {
    console.warn('[runtime-config.ts] resolveApiBase failed', e);
    return window.location.origin;
  }
}

function sanitizeAndAssign(partial: Partial<RuntimeConfig>): void {
  const clone: RuntimeConfig = { ...DEFAULTS, ...partial } as RuntimeConfig;
  console.log('[runtime-config.ts] sanitizeAndAssign input apiBase:', clone.apiBase);
  clone.apiBase = resolveApiBase(clone.apiBase);
  console.log('[runtime-config.ts] sanitizeAndAssign after resolveApiBase:', clone.apiBase);
  // If a global BASE environment variable (injected via Vite define or inline script) exists
  // and apiBase still equals the window origin, prefer BASE to align with .env expectation.
  try {
    const seededOrigin = window.location.origin;
    const baseEnv = (window as any).BASE || (window as any).VITE_BASE || (window as any).ENV_BASE;
    if (baseEnv && clone.apiBase === seededOrigin) {
      clone.apiBase = String(baseEnv).replace(/\/$/, '');
    }
  } catch {}
  W.getTemplateDoctorApiBase = () => clone.apiBase || DEFAULTS.apiBase;
  W.TemplateDoctorConfig = clone;

  // Probe for CSP/network blockage to fallback if necessary (disabled in local dev to prevent false-positive fallback)
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isLocal) {
    console.log(
      '[runtime-config.ts] Skipping probe in local dev; apiBase preserved:',
      clone.apiBase,
    );
    return; // skip probe on localhost
  }
  setTimeout(() => {
    try {
      const base = W.getTemplateDoctorApiBase();
      if (!base || base === window.location.origin) return;
      const sameHost = (() => {
        try {
          return new URL(base).host === window.location.host;
        } catch {
          return false;
        }
      })();
      if (sameHost) return;
      const probeBase = base.replace(/\/$/, '');
      // Prefer new client-settings endpoint; retain legacy runtimeConfig alias via ApiRoutes for back-compat
      const versioned =
        probeBase +
        (window.ApiRoutes?.clientSettings ||
          window.ApiRoutes?.runtimeConfig ||
          '/api/v4/client-settings');
      const probeUrl = versioned + '?csp_probe=' + Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      fetch(probeUrl, { method: 'GET', cache: 'no-store', signal: controller.signal })
        .then((r) => {
          clearTimeout(timeout);
          if (!r.ok) forceSameOriginFallback();
        })
        .catch(() => {
          clearTimeout(timeout);
          forceSameOriginFallback();
        });
    } catch (e) {
      console.warn('[runtime-config.ts] probe setup failed', e);
    }
  }, 0);
}

function forceSameOriginFallback(): void {
  try {
    const origin = window.location.origin;
    W.TemplateDoctorConfig.apiBase = origin;
    W.getTemplateDoctorApiBase = () => origin;
    console.log('[runtime-config.ts] apiBase fallback ->', origin);
    document.dispatchEvent(
      new CustomEvent('templatedoctor-apibase-fallback', { detail: { apiBase: origin } }),
    );
  } catch {}
}

// Kick off async load.
loadConfig()
  .then(() => {
    console.log('[runtime-config.ts] Config loaded and ready');
    configReadyResolve();
  })
  .catch(() => {
    console.log('[runtime-config.ts] loadConfig failed; defaults in place');
    configReadyResolve(); // Resolve anyway so other code doesn't hang
  });

export {}; // ensure this file is a module
