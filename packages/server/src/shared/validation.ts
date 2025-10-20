/** Shared request validation helpers.
 *  Goal: eliminate repetitive owner/repo/runId parsing while preserving existing
 *  external error shapes and HTTP status codes used by migrated functions.
 */

export interface ParsedOwnerRepo {
  owner: string;
  repo: string;
}

export function parseOwnerRepo(value: string | undefined, requestId: string) {
  if (!value) {
    return {
      error: {
        status: 400,
        body: {
          error: 'workflowOrgRepo is required',
          errorType: 'MISSING_PARAMETER',
          requestId,
        },
      },
    };
  }
  const parts = value.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return {
      error: {
        status: 400,
        body: {
          error: 'workflowOrgRepo must be in owner/repo format',
          errorType: 'INVALID_FORMAT',
          requestId,
        },
      },
    };
  }
  return { value: { owner: parts[0], repo: parts[1] } };
}

export function requireRunId(runId: string | number | undefined, requestId: string) {
  if (!runId) {
    return {
      error: {
        status: 400,
        body: {
          error: 'workflowRunId is required',
          errorType: 'MISSING_PARAMETER',
          requestId,
        },
      },
    };
  }
  let numeric: number | undefined;
  if (typeof runId === 'string') {
    numeric = parseInt(runId, 10);
  } else if (typeof runId === 'number') {
    numeric = runId;
  }
  if (!Number.isFinite(numeric)) {
    return {
      error: {
        status: 400,
        body: {
          error: 'workflowRunId must be numeric',
          errorType: 'INVALID_FORMAT',
          requestId,
        },
      },
    };
  }
  return { value: numeric as number };
}

export function isPost(method: string, requestId: string) {
  if (method !== 'POST') {
    return {
      error: {
        status: 405,
        body: { error: 'Method Not Allowed', requestId },
      },
    };
  }
  return {};
}
