import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all GitHub Actions endpoints
router.use(requireAuth);

interface TriggerBody {
  workflowOrgRep?: string;
  workflowId?: string | number;
  workflowInput?: Record<string, any>;
  runIdInputProperty?: string;
}

interface StatusBody {
  workflowOrgRep?: string;
  workflowRunId?: string | number;
}

interface ArtifactsBody {
  workflowOrgRep?: string;
  workflowRunId?: string | number;
}

// Helper: Build GitHub API URL with query parameters
function buildGitHubApiUrl(path: string, params?: Record<string, string | number>): string {
  const url = new URL(`https://api.github.com${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  return url.toString();
}

// Helper: Parse owner/repo
function parseOwnerRepo(
  orgRep: string | undefined,
  requestId: string,
): { owner: string; repo: string } | null {
  if (!orgRep || typeof orgRep !== 'string') {
    throw {
      status: 400,
      body: {
        error: 'workflowOrgRep is required (format: owner/repo)',
        errorType: 'MISSING_PARAMETER',
        requestId,
      },
    };
  }
  const parts = orgRep.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw {
      status: 400,
      body: {
        error: 'Invalid workflowOrgRep format (expected: owner/repo)',
        errorType: 'INVALID_FORMAT',
        requestId,
      },
    };
  }
  return { owner: parts[0], repo: parts[1] };
}

// Helper: Dispatch workflow
async function dispatchWorkflow(
  owner: string,
  repo: string,
  workflowId: string | number,
  inputs: Record<string, any>,
  token: string,
) {
  const url = buildGitHubApiUrl(
    `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
  );
  const body = { ref: 'main', inputs };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return res;
}

// Helper: List recent workflow runs
async function listRecentRuns(
  owner: string,
  repo: string,
  workflowId: string | number,
  token: string,
  sinceIso: string,
): Promise<{ ok: boolean; status?: number; text?: string; json?: any }> {
  // Build URL using helper function for consistency and maintainability
  const url = buildGitHubApiUrl(`/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs`, {
    event: 'workflow_dispatch',
    per_page: 100,
    branch: 'main',
    created: `>${sinceIso}`, // GitHub API uses 'created' with comparison operators
  });

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, text };
  }

  const json = await res.json();
  return { ok: true, json };
}

// Helper: Fetch workflow artifacts
async function fetchArtifacts(
  owner: string,
  repo: string,
  runId: string | number,
  token: string,
): Promise<{
  ok: boolean;
  status?: number;
  statusText?: string;
  text?: string;
  json?: any;
}> {
  const url = buildGitHubApiUrl(`/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      status: res.status,
      statusText: res.statusText,
      text,
    };
  }

  const json = await res.json();
  return { ok: true, json };
}

// POST /api/v4/workflow-trigger
// Triggers a GitHub Actions workflow and polls for the run ID
router.post('/workflow-trigger', async (req: Request, res: Response, next: NextFunction) => {
  const requestId = uuidv4();

  try {
    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token) {
      return res.status(500).json({
        error: 'Server not configured (missing GH_WORKFLOW_TOKEN)',
        requestId,
      });
    }

    const body: TriggerBody = req.body || {};
    const { workflowOrgRep, workflowId, workflowInput = {}, runIdInputProperty } = body;

    const ownerRepo = parseOwnerRepo(workflowOrgRep, requestId);
    if (!ownerRepo) {
      throw new Error('Failed to parse owner/repo');
    }
    const { owner, repo } = ownerRepo;

    if (workflowId === undefined || workflowId === null || workflowId === '') {
      return res.status(400).json({
        error: 'workflowId is required',
        errorType: 'MISSING_PARAMETER',
        requestId,
      });
    }

    if (!runIdInputProperty) {
      return res.status(400).json({
        error: 'runIdInputProperty is required',
        errorType: 'MISSING_PARAMETER',
        requestId,
      });
    }

    const uniqueInputId = Object.prototype.hasOwnProperty.call(workflowInput, runIdInputProperty)
      ? workflowInput[runIdInputProperty]
      : undefined;

    if (!uniqueInputId) {
      return res.status(400).json({
        error: `Input property ${runIdInputProperty} is missing in workflowInput`,
        errorType: 'MISSING_INPUT_PROPERTY',
        requestId,
      });
    }

    // Dispatch workflow
    const dispatchRes = await dispatchWorkflow(owner, repo, workflowId, workflowInput, token);

    if (!dispatchRes.ok) {
      const text = await dispatchRes.text();
      return res.status(502).json({
        error: `GitHub dispatch failed: ${dispatchRes.status} ${dispatchRes.statusText}`,
        details: text.slice(0, 1000),
        errorType: 'GITHUB_API_ERROR',
        requestId,
      });
    }

    // Poll for run (5 attempts with incremental backoff: 5s, 10s, 15s, 20s, 25s)
    const tenMinutesAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const maxAttempts = 5;
    let foundRun: any = null;

    for (let attempt = 1; attempt <= maxAttempts && !foundRun; attempt++) {
      const waitMs = 5000 * attempt;
      console.log(
        `[workflow-trigger] Waiting ${waitMs / 1000}s before polling (attempt ${attempt}/${maxAttempts})`,
      );
      await new Promise((r) => setTimeout(r, waitMs));

      const list = await listRecentRuns(owner, repo, workflowId, token, tenMinutesAgoIso);
      if (!list.ok) continue;

      const runs = list.json.workflow_runs || [];
      for (const r of runs) {
        const title = r.display_title || r.name || '';
        const msg = r.head_commit?.message || '';
        if (
          (title && title.includes(String(uniqueInputId))) ||
          (msg && msg.includes(String(uniqueInputId)))
        ) {
          foundRun = r;
          break;
        }
      }

      if (foundRun) {
        return res.status(200).json({
          error: null,
          data: { runId: foundRun.id, attempts: attempt },
          context: {
            uniqueInputId,
            ownerRepo: `${owner}/${repo}/actions/workflows/${workflowId}/runs`,
            run: foundRun,
            requestId,
          },
        });
      }
    }

    // Run not found after all attempts
    return res.status(404).json({
      error: `Could not find the triggered workflow run after ${maxAttempts} attempts`,
      errorType: 'RUN_NOT_FOUND',
      data: null,
      context: {
        uniqueInputId,
        ownerRepo: `${owner}/${repo}/actions/workflows/${workflowId}/runs`,
        attempts: maxAttempts,
        requestId,
      },
    });
  } catch (err: any) {
    if (err.status && err.body) {
      return res.status(err.status).json(err.body);
    }
    next(err);
  }
});

// POST /api/v4/workflow-run-status
// Gets the status of a GitHub Actions workflow run
router.post('/workflow-run-status', async (req: Request, res: Response, next: NextFunction) => {
  const requestId = uuidv4();

  try {
    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token) {
      return res.status(500).json({
        error: 'Server not configured (missing GH_WORKFLOW_TOKEN)',
        requestId,
      });
    }

    const body: StatusBody = req.body || {};
    const { workflowOrgRep, workflowRunId } = body;

    const ownerRepo = parseOwnerRepo(workflowOrgRep, requestId);
    if (!ownerRepo) {
      throw new Error('Failed to parse owner/repo');
    }
    const { owner, repo } = ownerRepo;

    if (
      !workflowRunId ||
      (typeof workflowRunId !== 'string' && typeof workflowRunId !== 'number')
    ) {
      return res.status(400).json({
        error: 'workflowRunId is required',
        errorType: 'MISSING_PARAMETER',
        requestId,
      });
    }

    const runIdNum =
      typeof workflowRunId === 'string' ? parseInt(workflowRunId, 10) : workflowRunId;
    if (isNaN(runIdNum)) {
      return res.status(400).json({
        error: 'Invalid workflowRunId (must be numeric)',
        errorType: 'INVALID_PARAMETER',
        requestId,
      });
    }

    // Fetch workflow run status from GitHub API
    const url = buildGitHubApiUrl(`/repos/${owner}/${repo}/actions/runs/${runIdNum}`);
    const apiRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!apiRes.ok) {
      const text = await apiRes.text();
      const isAuth = apiRes.status === 401 || apiRes.status === 403;
      return res.status(isAuth ? 502 : 500).json({
        error: 'GitHub workflow run fetch failed',
        details: text.slice(0, 500),
        errorType: 'GITHUB_API_ERROR',
        requestId,
      });
    }

    const data = await apiRes.json();
    return res.status(200).json({
      error: null,
      data,
      context: { workflowOrgRep, workflowRunId, requestId },
    });
  } catch (err: any) {
    if (err.status && err.body) {
      return res.status(err.status).json(err.body);
    }
    next(err);
  }
});

// POST /api/v4/workflow-run-artifacts
// Lists artifacts for a GitHub Actions workflow run
router.post('/workflow-run-artifacts', async (req: Request, res: Response, next: NextFunction) => {
  const requestId = uuidv4();

  try {
    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token) {
      return res.status(500).json({
        error: 'Server not configured (missing GH_WORKFLOW_TOKEN)',
        requestId,
      });
    }

    const body: ArtifactsBody = req.body || {};
    const { workflowOrgRep, workflowRunId } = body;

    const ownerRepo = parseOwnerRepo(workflowOrgRep, requestId);
    if (!ownerRepo) {
      throw new Error('Failed to parse owner/repo');
    }
    const { owner, repo } = ownerRepo;

    if (
      !workflowRunId ||
      (typeof workflowRunId !== 'string' && typeof workflowRunId !== 'number')
    ) {
      return res.status(400).json({
        error: 'workflowRunId is required',
        errorType: 'MISSING_PARAMETER',
        requestId,
      });
    }

    const runIdNum =
      typeof workflowRunId === 'string' ? parseInt(workflowRunId, 10) : workflowRunId;
    if (isNaN(runIdNum)) {
      return res.status(400).json({
        error: 'Invalid workflowRunId (must be numeric)',
        errorType: 'INVALID_PARAMETER',
        requestId,
      });
    }

    const result = await fetchArtifacts(owner, repo, runIdNum, token);

    if (!result.ok) {
      const isAuth = result.status === 401 || result.status === 403;
      return res.status(isAuth ? 502 : 500).json({
        error: `GitHub artifacts fetch failed: ${result.status} ${result.statusText}`,
        details: result.text?.slice(0, 500),
        errorType: 'GITHUB_API_ERROR',
        requestId,
      });
    }

    const artifactCount = result.json.total_count || 0;
    return res.status(200).json({
      error: null,
      data: result.json,
      context: {
        ownerRepo: `${owner}/${repo}`,
        requestId,
        workflowRunId,
        artifactCount,
      },
    });
  } catch (err: any) {
    if (err.status && err.body) {
      return res.status(err.status).json(err.body);
    }
    next(err);
  }
});

export { router as actionsRouter };
