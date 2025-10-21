// Migrated from js/config-loader.js (behavior preserved) – now typed.
import { buildApiUrl, API_ENDPOINTS } from './api-constants.js';

interface BackendEnvShape {
  baseUrl?: string;
  functionKey?: string;
  apiVersion?: string;
  [k: string]: any;
}

interface OAuthConfigShape {
  clientId?: string;
  scope?: string;
  redirectUri?: string;
  [k: string]: any;
}

interface EnvironmentVariablesShape {
  backend?: BackendEnvShape;
  GITHUB_CLIENT_ID?: string;
  DEFAULT_RULE_SET?: string;
  REQUIRE_AUTH_FOR_RESULTS?: string;
  AUTO_SAVE_RESULTS?: string;
  ARCHIVE_ENABLED?: string;
  ARCHIVE_COLLECTION?: string;
  DISPATCH_TARGET_REPO?: string;
  [k: string]: any;
}

interface ConfigJsonShape {
  backend?: BackendEnvShape;
  githubOAuth?: OAuthConfigShape;
  DEFAULT_RULE_SET?: string;
  REQUIRE_AUTH_FOR_RESULTS?: string;
  AUTO_SAVE_RESULTS?: string;
  ARCHIVE_ENABLED?: string;
  ARCHIVE_COLLECTION?: string;
  DISPATCH_TARGET_REPO?: string;
  [k: string]: any;
}

interface ConsolidatedConfig extends ConfigJsonShape {
  backend?: BackendEnvShape;
  githubOAuth?: OAuthConfigShape;
}

async function loadEnvironmentVariables(): Promise<EnvironmentVariablesShape> {
  try {
    const isLocalhost = window.location.hostname === 'localhost';

    // REMOVED: Don't skip server endpoint on localhost anymore
    // The Docker/Express setup serves both frontend and backend on same port
    // We need to call /api/v4/client-settings to get GITHUB_CLIENT_ID

    // Detect if the caller explicitly requested a Functions port (query param or global var).
    // We keep a separate flag so the mere DEFAULT value (7071) does not bias ordering when running
    // inside the unified container (e.g., :4000) where we should try same-origin first.
    let localPort: number | string = 7071;
    let explicitFuncPort = false;
    if ((window as any).LOCAL_FUNCTIONS_PORT) {
      localPort = (window as any).LOCAL_FUNCTIONS_PORT;
      explicitFuncPort = true;
    } else if (typeof (window as any).TemplateDoctorConfig?.LOCAL_FUNCTIONS_PORT === 'number') {
      localPort = (window as any).TemplateDoctorConfig.LOCAL_FUNCTIONS_PORT;
      explicitFuncPort = true;
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('funcPort')) {
        const val = urlParams.get('funcPort');
        if (val != null && val.trim().length > 0) {
          // Preserve original behavior: accept string override, but coerce numeric when possible.
          const asNum = Number(val);
          localPort = Number.isFinite(asNum) ? asNum : val;
          explicitFuncPort = true;
        }
      }
    }
    // Use centralized API configuration - much simpler!
    const apiUrl = buildApiUrl(API_ENDPOINTS.CLIENT_SETTINGS);
    const tried: string[] = [];
    const candidates: string[] = [apiUrl];
    let response: Response | null = null;
    let data: EnvironmentVariablesShape = {};
    for (const url of candidates) {
      if (tried.includes(url)) continue;
      tried.push(url);
      try {
        console.log('[config-loader] attempting client-settings fetch:', url);
        response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
          try {
            data = await response.json();
            console.log(
              '[config-loader] loaded client-settings from',
              url,
              'keys:',
              Object.keys(data),
            );
            break;
          } catch (jsonErr) {
            console.warn('[config-loader] JSON parse failed for', url, '- trying next candidate');
            response = null; // Mark as failed so we try next candidate
          }
        } else {
          console.warn('[config-loader] non-OK response', response.status, 'for', url);
        }
      } catch (e) {
        console.warn('[config-loader] fetch error for', url, e);
      }
    }
    if (!response || !response.ok) {
      console.error('[config-loader] failed all client-settings attempts', { tried });
      throw new Error('Failed to load client settings from v4 API');
    }
    return data;
  } catch (error) {
    console.warn('Error loading environment variables:', error);
    return {} as EnvironmentVariablesShape;
  }
}

async function loadConfigJson(): Promise<ConfigJsonShape> {
  const tried: string[] = [];
  // For local development, try config.local.json first for localhost-specific settings
  // Note: config.local.json support removed to prevent browser console 404 errors
  // that confuse users. Use environment variables or config.json for configuration.
  const candidates = [
    '/config.json', // absolute root
    './config.json', // relative
    'config.json',
    '/app/config.json', // fallback in container if mounted differently
  ];
  for (const url of candidates) {
    if (tried.includes(url)) continue;
    tried.push(url);
    try {
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) {
        console.debug('[config-loader] config.json candidate not ok', url, resp.status);
        continue;
      }

      // Check content type to avoid parsing HTML as JSON
      const contentType = resp.headers.get('content-type') || '';
      const txt = await resp.text();

      // Skip if we got HTML (404 page) instead of JSON
      if (
        contentType.includes('text/html') ||
        txt.trim().startsWith('<!doctype') ||
        txt.trim().startsWith('<html')
      ) {
        console.debug(
          '[config-loader] Skipping HTML response for',
          url,
          '(file likely does not exist)',
        );
        continue;
      }

      try {
        const data = JSON.parse(txt);
        console.log('[config-loader] Loaded config.json via', url, 'keys:', Object.keys(data));
        return data as ConfigJsonShape;
      } catch (e) {
        // Only warn about unexpected JSON parse failures (not HTML 404 pages)
        if (!txt.includes('<!doctype') && !txt.includes('<html>')) {
          console.warn(
            '[config-loader] JSON parse failed for',
            url,
            'first 100 chars:',
            txt.slice(0, 100),
          );
        }
      }
    } catch (err) {
      console.debug('[config-loader] fetch error for candidate', url, err?.message || err);
    }
  }
  console.warn('[config-loader] All config.json candidates failed; proceeding with empty config');
  return {} as ConfigJsonShape;
}

async function loadConfig(): Promise<ConsolidatedConfig> {
  const configJson = await loadConfigJson();
  const envVars = await loadEnvironmentVariables();
  const config: ConsolidatedConfig = { ...configJson };
  if (envVars && typeof envVars === 'object') {
    if (envVars.backend && typeof envVars.backend === 'object') {
      const mergedBackend: BackendEnvShape = { ...(config.backend || {}) };
      if (
        typeof envVars.backend.baseUrl === 'string' &&
        envVars.backend.baseUrl.trim().length > 0
      ) {
        mergedBackend.baseUrl = envVars.backend.baseUrl;
      }
      if (
        typeof envVars.backend.functionKey === 'string' &&
        envVars.backend.functionKey.trim().length > 0
      ) {
        mergedBackend.functionKey = envVars.backend.functionKey;
      }
      if (
        typeof envVars.backend.apiVersion === 'string' &&
        envVars.backend.apiVersion.trim().length > 0
      ) {
        mergedBackend.apiVersion = envVars.backend.apiVersion.trim();
      }
      config.backend = mergedBackend;
    }
    if (envVars.GITHUB_CLIENT_ID) {
      config.githubOAuth = {
        ...(config.githubOAuth || {}),
        clientId: envVars.GITHUB_CLIENT_ID,
        scope: (config.githubOAuth && config.githubOAuth.scope) || 'repo read:user',
        redirectUri: (config.githubOAuth && config.githubOAuth.redirectUri) || '',
      };
    }
    if (
      typeof envVars.DEFAULT_RULE_SET === 'string' &&
      envVars.DEFAULT_RULE_SET.trim().length > 0
    ) {
      config.DEFAULT_RULE_SET = envVars.DEFAULT_RULE_SET;
    }
    if (
      typeof envVars.REQUIRE_AUTH_FOR_RESULTS === 'string' &&
      envVars.REQUIRE_AUTH_FOR_RESULTS.trim().length > 0
    ) {
      config.REQUIRE_AUTH_FOR_RESULTS = envVars.REQUIRE_AUTH_FOR_RESULTS;
    }
    if (
      typeof envVars.AUTO_SAVE_RESULTS === 'string' &&
      envVars.AUTO_SAVE_RESULTS.trim().length > 0
    ) {
      config.AUTO_SAVE_RESULTS = envVars.AUTO_SAVE_RESULTS;
    }
    if (typeof envVars.ARCHIVE_ENABLED === 'string' && envVars.ARCHIVE_ENABLED.trim().length > 0) {
      config.ARCHIVE_ENABLED = envVars.ARCHIVE_ENABLED;
    }
    if (
      typeof envVars.ARCHIVE_COLLECTION === 'string' &&
      envVars.ARCHIVE_COLLECTION.trim().length > 0
    ) {
      config.ARCHIVE_COLLECTION = envVars.ARCHIVE_COLLECTION;
    }
    if (
      typeof envVars.DISPATCH_TARGET_REPO === 'string' &&
      envVars.DISPATCH_TARGET_REPO.trim().length > 0
    ) {
      config.DISPATCH_TARGET_REPO = envVars.DISPATCH_TARGET_REPO;
    }
  }
  console.log('Consolidated config:', config);
  return config;
}

(window as any).ConfigLoader = { loadConfig };
export {};
