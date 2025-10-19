import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { downloadValidationArtifact, parseAzdValidationResult, AzdValidationResult } from "../services/azd-validation.js";

/**
 * Interface for AZD validation results parsed from artifact
 */
// (Parser & artifact download logic moved to services/azd-validation.ts)

const router = Router();

/**
 * POST /api/v4/validation-template
 * Triggers a GitHub workflow to validate an azd template
 */
router.post(
    "/validation-template",
    async (req: Request, res: Response, next: NextFunction) => {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        try {
            const { targetRepoUrl, callbackUrl } = req.body;

            // Validate required parameters
            if (
                !targetRepoUrl ||
                typeof targetRepoUrl !== "string" ||
                !/^https?:\/\//i.test(targetRepoUrl)
            ) {
                return res.status(400).json({
                    error: "targetRepoUrl is required and must be a valid URL",
                    requestId,
                });
            }

            // Generate unique run ID
            const runId = crypto.randomUUID();

            // Derive owner/repo/workflow from environment with defaults
            let owner = process.env.GITHUB_REPO_OWNER;
            let repo = process.env.GITHUB_REPO_NAME;

            if (!owner || !repo) {
                const slug =
                    process.env.GITHUB_REPOSITORY ||
                    "Template-Doctor/template-doctor";
                [owner, repo] = slug.split("/");
            }

            const branch = process.env.GITHUB_REPO_BRANCH || "main";
            const workflowFile =
                process.env.GITHUB_WORKFLOW_FILE || "validation-template.yml";
            const token = process.env.GH_WORKFLOW_TOKEN;

            if (!token) {
                return res.status(500).json({
                    error: "Server not configured (missing GH_WORKFLOW_TOKEN)",
                    requestId,
                });
            }

            // Construct GitHub API URL
            const ghUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;

            // Prepare workflow dispatch payload
            const payload = {
                ref: branch,
                inputs: {
                    target_validate_template_url: targetRepoUrl,
                    callback_url: callbackUrl || "",
                    run_id: runId,
                    customValidators: "azd-up,azd-down",
                },
            };

            console.log("validation-template dispatch", {
                requestId,
                ghUrl,
                branch,
                workflowFile,
            });

            // Trigger workflow dispatch
            const response = await fetch(ghUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error("validation-template dispatch failure", {
                    requestId,
                    status: response.status,
                    text,
                });

                return res.status(502).json({
                    error: `GitHub dispatch failed: ${response.status} ${response.statusText}`,
                    details: text.slice(0, 1000),
                    requestId,
                });
            }

            // After successful dispatch, try to get the workflow run ID
            // Wait a bit for GitHub to create the run
            await new Promise((resolve) => setTimeout(resolve, 2000));

            let workflowRunId: number | null = null;
            let githubRunUrl: string | null = null;

            try {
                const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=10`;
                const runsResponse = await fetch(runsUrl, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                });

                if (runsResponse.ok) {
                    const runsData = await runsResponse.json();
                    // Find the run that was just created (most recent one)
                    const recentRun = runsData.workflow_runs?.[0];
                    if (recentRun) {
                        workflowRunId = recentRun.id;
                        githubRunUrl = recentRun.html_url;
                        console.log("validation-template found workflow run", {
                            requestId,
                            workflowRunId,
                            githubRunUrl,
                        });
                    }
                }
            } catch (err) {
                console.error(
                    "validation-template failed to get workflow run ID",
                    { requestId, error: err },
                );
                // Non-fatal, continue without workflow run ID
            }

            res.json({
                runId,
                workflowRunId,
                githubRunUrl,
                workflowOrgRepo: `${owner}/${repo}`,
                message: "Workflow triggered",
                requestId,
            });
        } catch (err: any) {
            console.error("validation-template exception", {
                requestId,
                error: err?.message,
            });
            next(err);
        }
    },
);

/**
 * POST /api/v4/validation-docker-image
 * Triggers a GitHub workflow to validate Docker image builds
 */
router.post(
    "/validation-docker-image",
    async (req: Request, res: Response, next: NextFunction) => {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        try {
            const { targetRepoUrl, callbackUrl } = req.body;

            if (
                !targetRepoUrl ||
                typeof targetRepoUrl !== "string" ||
                !/^https?:\/\//i.test(targetRepoUrl)
            ) {
                return res.status(400).json({
                    error: "targetRepoUrl is required and must be a valid URL",
                    requestId,
                });
            }

            const runId = crypto.randomUUID();

            let owner = process.env.GITHUB_REPO_OWNER;
            let repo = process.env.GITHUB_REPO_NAME;

            if (!owner || !repo) {
                const slug =
                    process.env.GITHUB_REPOSITORY ||
                    "Template-Doctor/template-doctor";
                [owner, repo] = slug.split("/");
            }

            const branch = process.env.GITHUB_REPO_BRANCH || "main";
            const workflowFile =
                process.env.GITHUB_WORKFLOW_FILE_DOCKER ||
                "validation-docker-image.yml";
            const token = process.env.GH_WORKFLOW_TOKEN;

            if (!token) {
                return res.status(500).json({
                    error: "Server not configured (missing GH_WORKFLOW_TOKEN)",
                    requestId,
                });
            }

            const ghUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;

            const payload = {
                ref: branch,
                inputs: {
                    target_validate_template_url: targetRepoUrl,
                    callback_url: callbackUrl || "",
                    run_id: runId,
                },
            };

            console.log("validation-docker-image dispatch", {
                requestId,
                ghUrl,
                branch,
                workflowFile,
            });

            const response = await fetch(ghUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error("validation-docker-image dispatch failure", {
                    requestId,
                    status: response.status,
                    text,
                });

                return res.status(502).json({
                    error: `GitHub dispatch failed: ${response.status} ${response.statusText}`,
                    details: text.slice(0, 1000),
                    requestId,
                });
            }

            res.json({
                runId,
                message: "Docker image validation workflow triggered",
                requestId,
            });
        } catch (err: any) {
            console.error("validation-docker-image exception", {
                requestId,
                error: err?.message,
            });
            next(err);
        }
    },
);

/**
 * POST /api/v4/validation-ossf
 * Triggers a GitHub workflow to run OSSF Scorecard validation
 */
router.post(
    "/validation-ossf",
    async (req: Request, res: Response, next: NextFunction) => {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        try {
            const { targetRepoUrl, callbackUrl } = req.body;

            if (
                !targetRepoUrl ||
                typeof targetRepoUrl !== "string" ||
                !/^https?:\/\//i.test(targetRepoUrl)
            ) {
                return res.status(400).json({
                    error: "targetRepoUrl is required and must be a valid URL",
                    requestId,
                });
            }

            const runId = crypto.randomUUID();

            let owner = process.env.GITHUB_REPO_OWNER;
            let repo = process.env.GITHUB_REPO_NAME;

            if (!owner || !repo) {
                const slug =
                    process.env.GITHUB_REPOSITORY ||
                    "Template-Doctor/template-doctor";
                [owner, repo] = slug.split("/");
            }

            const branch = process.env.GITHUB_REPO_BRANCH || "main";
            const workflowFile =
                process.env.GITHUB_WORKFLOW_FILE_OSSF || "validation-ossf.yml";
            const token = process.env.GH_WORKFLOW_TOKEN;

            if (!token) {
                return res.status(500).json({
                    error: "Server not configured (missing GH_WORKFLOW_TOKEN)",
                    requestId,
                });
            }

            const ghUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;

            const payload = {
                ref: branch,
                inputs: {
                    target_validate_template_url: targetRepoUrl,
                    callback_url: callbackUrl || "",
                    run_id: runId,
                },
            };

            console.log("validation-ossf dispatch", {
                requestId,
                ghUrl,
                branch,
                workflowFile,
            });

            const response = await fetch(ghUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error("validation-ossf dispatch failure", {
                    requestId,
                    status: response.status,
                    text,
                });

                return res.status(502).json({
                    error: `GitHub dispatch failed: ${response.status} ${response.statusText}`,
                    details: text.slice(0, 1000),
                    requestId,
                });
            }

            res.json({
                runId,
                message: "OSSF Scorecard validation workflow triggered",
                requestId,
            });
        } catch (err: any) {
            console.error("validation-ossf exception", {
                requestId,
                error: err?.message,
            });
            next(err);
        }
    },
);

/**
 * GET /api/v4/validation-status
 * Checks the status of a validation workflow run
 * Accepts either workflowRunId (numeric GitHub run ID) or runId (UUID for lookup)
 */
router.get(
    "/validation-status",
    async (req: Request, res: Response, next: NextFunction) => {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        try {
            const {
                workflowOrgRepo,
                workflowRunId,
                runId: uuidRunId,
            } = req.query;

            // Derive owner/repo from parameter or environment
            let owner: string;
            let repo: string;

            if (workflowOrgRepo && typeof workflowOrgRepo === "string") {
                const parts = workflowOrgRepo.split("/");
                if (parts.length !== 2 || !parts[0] || !parts[1]) {
                    return res.status(400).json({
                        error: "workflowOrgRepo must be in owner/repo format",
                        errorType: "INVALID_FORMAT",
                        requestId,
                    });
                }
                [owner, repo] = parts;
            } else {
                // Fallback to environment
                owner = process.env.GITHUB_REPO_OWNER || "";
                repo = process.env.GITHUB_REPO_NAME || "";

                if (!owner || !repo) {
                    const slug =
                        process.env.GITHUB_REPOSITORY ||
                        "Template-Doctor/template-doctor";
                    [owner, repo] = slug.split("/");
                }
            }

            // Accept either workflowRunId (numeric) or runId (UUID)
            let runIdToCheck: number;

            if (workflowRunId) {
                runIdToCheck = parseInt(workflowRunId as string, 10);
                if (!Number.isFinite(runIdToCheck)) {
                    return res.status(400).json({
                        error: "workflowRunId must be numeric",
                        errorType: "INVALID_FORMAT",
                        requestId,
                    });
                }
            } else if (uuidRunId && typeof uuidRunId === "string") {
                // UUID provided - need to find corresponding GitHub workflow run
                // This is a fallback for legacy clients that only send UUID
                return res.status(400).json({
                    error: "Please provide workflowRunId (numeric GitHub run ID) instead of runId (UUID)",
                    errorType: "DEPRECATED_PARAMETER",
                    hint: "The validation-template endpoint now returns workflowRunId - use that value",
                    requestId,
                });
            } else {
                return res.status(400).json({
                    error: "Either workflowRunId or runId is required",
                    errorType: "MISSING_PARAMETER",
                    requestId,
                });
            }

            const token = process.env.GH_WORKFLOW_TOKEN;
            if (!token) {
                return res.status(500).json({
                    error: "Server not configured (missing GH_WORKFLOW_TOKEN)",
                    requestId,
                });
            }

            // Fetch workflow run status from GitHub API
            const ghUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runIdToCheck}`;

            console.log("validation-status check", {
                requestId,
                ghUrl,
                workflowRunId: runIdToCheck,
            });

            const response = await fetch(ghUrl, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            });

            if (!response.ok) {
                const text = await response.text();
                console.error("validation-status fetch failure", {
                    requestId,
                    status: response.status,
                    text,
                });

                return res.status(502).json({
                    error: `GitHub API failed: ${response.status} ${response.statusText}`,
                    details: text.slice(0, 1000),
                    requestId,
                });
            }

            const data = await response.json();

            // Fetch jobs for this workflow run to get detailed error information
            let jobs: any[] = [];
            let failedJobs: any[] = [];
            let errorSummary = "";

            if (data.status === "completed" && data.conclusion === "failure") {
                try {
                    const jobsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runIdToCheck}/jobs`;
                    const jobsResponse = await fetch(jobsUrl, {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: "application/vnd.github+json",
                            "X-GitHub-Api-Version": "2022-11-28",
                        },
                    });

                    if (jobsResponse.ok) {
                        const jobsData = await jobsResponse.json();
                        jobs = jobsData.jobs || [];
                        failedJobs = jobs.filter(
                            (job: any) => job.conclusion === "failure",
                        );

                        // Build error summary from failed job steps
                        if (failedJobs.length > 0) {
                            const errorLines: string[] = [];
                            failedJobs.forEach((job: any) => {
                                errorLines.push(
                                    `Job: ${job.name} - ${job.conclusion}`,
                                );
                                const failedSteps = (job.steps || []).filter(
                                    (step: any) =>
                                        step.conclusion === "failure",
                                );
                                failedSteps.forEach((step: any) => {
                                    errorLines.push(
                                        `  Step: ${step.name} - Failed`,
                                    );
                                });
                            });
                            errorSummary = errorLines.join("\n");
                        }
                    }
                } catch (err) {
                    console.error("validation-status failed to fetch jobs", {
                        requestId,
                        error: err,
                    });
                    // Non-fatal, continue without job details
                }
            }

            // NEW: Fetch and parse artifact if workflow completed
            let azdValidation: AzdValidationResult | null = null;
            if (data.status === 'completed') {
                const artifactContent = await downloadValidationArtifact(
                    owner,
                    repo,
                    runIdToCheck,
                    token
                );

                if (artifactContent) {
                    azdValidation = parseAzdValidationResult(artifactContent);
                    console.log('validation-status parsed artifact', {
                        requestId,
                        overallStatus: azdValidation.overallStatus,
                        azdUpSuccess: azdValidation.azdUpSuccess,
                        azdDownSuccess: azdValidation.azdDownSuccess,
                        psRuleErrors: azdValidation.psRuleErrors,
                        psRuleWarnings: azdValidation.psRuleWarnings,
                    });
                } else {
                    console.log('validation-status no artifact available yet', {
                        requestId,
                        workflowStatus: data.status,
                        workflowConclusion: data.conclusion,
                    });
                }
            }

            res.json({
                status: data.status,
                conclusion: data.conclusion,
                html_url: data.html_url,
                created_at: data.created_at,
                updated_at: data.updated_at,
                jobs: jobs.map((job: any) => ({
                    id: job.id,
                    name: job.name,
                    status: job.status,
                    conclusion: job.conclusion,
                    html_url: job.html_url,
                    started_at: job.started_at,
                    completed_at: job.completed_at,
                })),
                failedJobs: failedJobs.map((job: any) => ({
                    id: job.id,
                    name: job.name,
                    conclusion: job.conclusion,
                    html_url: job.html_url,
                    failedSteps: (job.steps || [])
                        .filter((step: any) => step.conclusion === "failure")
                        .map((step: any) => ({
                            name: step.name,
                            conclusion: step.conclusion,
                            number: step.number,
                        })),
                })),
                errorSummary,
                azdValidation,
                requestId,
            });
        } catch (err: any) {
            console.error("validation-status exception", {
                requestId,
                error: err?.message,
            });
            next(err);
        }
    },
);

/**
 * POST /api/v4/validation-cancel
 * Cancels a running validation workflow
 */
router.post(
    "/validation-cancel",
    async (req: Request, res: Response, next: NextFunction) => {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        try {
            const { workflowOrgRepo, workflowRunId } = req.body;

            // Validate workflowOrgRepo parameter
            if (!workflowOrgRepo || typeof workflowOrgRepo !== "string") {
                return res.status(400).json({
                    error: "workflowOrgRepo is required",
                    errorType: "MISSING_PARAMETER",
                    requestId,
                });
            }

            const parts = workflowOrgRepo.split("/");
            if (parts.length !== 2 || !parts[0] || !parts[1]) {
                return res.status(400).json({
                    error: "workflowOrgRepo must be in owner/repo format",
                    errorType: "INVALID_FORMAT",
                    requestId,
                });
            }

            const [owner, repo] = parts;

            // Validate workflowRunId parameter
            if (!workflowRunId) {
                return res.status(400).json({
                    error: "workflowRunId is required",
                    errorType: "MISSING_PARAMETER",
                    requestId,
                });
            }

            const runId =
                typeof workflowRunId === "string"
                    ? parseInt(workflowRunId, 10)
                    : workflowRunId;
            if (!Number.isFinite(runId)) {
                return res.status(400).json({
                    error: "workflowRunId must be numeric",
                    errorType: "INVALID_FORMAT",
                    requestId,
                });
            }

            const token = process.env.GH_WORKFLOW_TOKEN;
            if (!token) {
                return res.status(500).json({
                    error: "Server not configured (missing GH_WORKFLOW_TOKEN)",
                    requestId,
                });
            }

            // Cancel workflow run via GitHub API
            const ghUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/cancel`;

            console.log("validation-cancel request", {
                requestId,
                ghUrl,
                runId,
            });

            const response = await fetch(ghUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            });

            if (!response.ok) {
                const text = await response.text();
                console.error("validation-cancel failure", {
                    requestId,
                    status: response.status,
                    text,
                });

                return res.status(502).json({
                    error: `GitHub API failed: ${response.status} ${response.statusText}`,
                    details: text.slice(0, 1000),
                    requestId,
                });
            }

            res.json({
                message: "Workflow run cancelled",
                runId,
                requestId,
            });
        } catch (err: any) {
            console.error("validation-cancel exception", {
                requestId,
                error: err?.message,
            });
            next(err);
        }
    },
);

/**
 * POST /api/v4/validation-callback
 * Webhook callback for validation workflow completion
 */
router.post(
    "/validation-callback",
    async (req: Request, res: Response, next: NextFunction) => {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        try {
            const { runId, status, conclusion, artifactsUrl } = req.body;

            console.log("validation-callback received", {
                requestId,
                runId,
                status,
                conclusion,
                artifactsUrl,
            });

            // Store callback data (in production, this might write to a database or queue)
            // For now, just log and acknowledge receipt

            res.json({
                message: "Callback received",
                runId,
                requestId,
            });
        } catch (err: any) {
            console.error("validation-callback exception", {
                requestId,
                error: err?.message,
            });
            next(err);
        }
    },
);

export { router as validationRouter };
