/**
 * Centralized API endpoint configuration
 * All API calls should use these constants to ensure consistent paths
 */

/**
 * Get the API base URL based on environment
 * - Localhost: http://localhost:7071
 * - Azure SWA: same-origin (uses /api prefix automatically)
 */
export function getApiBase(): string {
  // Check for configured API base in TemplateDoctorConfig
  const cfg = (window as any).TemplateDoctorConfig || {};

  // Use configured apiBase if available
  if (cfg.apiBase) return cfg.apiBase.replace(/\/$/, '');

  // Check for backend.baseUrl configuration
  if (cfg.backend?.baseUrl) return cfg.backend.baseUrl.replace(/\/$/, '');

  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (isLocalhost) {
    // If served from same origin (e.g., Express serves both frontend and API), use same origin
    // This handles Docker/Express setup on port 3000, or any other single-server deployment
    return window.location.origin;
  }

  // Production: use same-origin (Azure SWA will route /api/* to Functions)
  return window.location.origin;
}

/**
 * Get the API prefix (always includes /api for Azure Functions routing)
 */
export function getApiPrefix(): string {
  return '/api/v4';
}

/**
 * Build a complete API URL for an endpoint
 * @param endpoint - The endpoint name (without /api/v4 prefix)
 * @returns Complete URL for the API endpoint
 */
export function buildApiUrl(endpoint: string): string {
  const base = getApiBase();
  const prefix = getApiPrefix();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${prefix}${cleanEndpoint}`;
}

/**
 * API endpoint names (without prefix)
 */
export const API_ENDPOINTS = {
  CLIENT_SETTINGS: '/client-settings',
  GITHUB_OAUTH_TOKEN: '/github-oauth-token',
  ANALYZE_TEMPLATE: '/analyze-template',
  REPO_FORK: '/repo-fork',
  ISSUE_CREATE: '/issue-create',
  ISSUE_AI: '/issue-ai',
  SETUP: '/setup',
  ADD_TEMPLATE_PR: '/add-template-pr',
  BATCH_SCAN_START: '/batch-scan-start',
  ARCHIVE_COLLECTION: '/archive-collection',
  SUBMIT_ANALYSIS_DISPATCH: '/submit-analysis-dispatch',
  VALIDATION_TEMPLATE: '/validation-template',
  VALIDATION_STATUS: '/validation-status',
  VALIDATION_CANCEL: '/validation-cancel',
  VALIDATION_CALLBACK: '/validation-callback',
  VALIDATION_DOCKER_IMAGE: '/validation-docker-image',
  VALIDATION_OSSF: '/validation-ossf',
  WORKFLOW_TRIGGER: '/workflow-trigger',
  WORKFLOW_RUN_STATUS: '/workflow-run-status',
  WORKFLOW_RUN_ARTIFACTS: '/workflow-run-artifacts',
} as const;
