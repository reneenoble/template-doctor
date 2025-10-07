import { HttpRequest, Context } from "@azure/functions";
import { wrapHttp } from "./shared/http";
import { loadEnv } from "./shared/env";
import { createGitHubHelper } from "./shared/githubClient";

// Parity TypeScript migration of legacy validation-status logic
// Responsibilities:
//  - Accept runId (query) and optional githubRunId/githubRunUrl
//  - Discover workflow run id by scanning recent runs if not supplied
//  - Support local override of owner/repo/branch/workflow file when allowed
//  - Return status/conclusion plus optional ephemeral logsArchiveUrl and per-job log URLs
//  - Distinguish GitHub API credential errors (502) vs server errors (500)
//  - Preserve pending response when run not yet discovered

interface GhWorkflowRun {
    id: number;
    html_url: string;
    status: string;
    conclusion: string | null;
    run_started_at?: string;
    updated_at?: string;
    display_title?: string;
    name?: string;
    head_commit?: { message?: string };
}

interface GhJobsList {
    jobs?: Array<{
        id: number;
        name: string;
        status: string;
        conclusion: string | null;
        started_at?: string;
        completed_at?: string;
    }>;
}

export default wrapHttp(
    async (req: HttpRequest, ctx: Context, _requestId: string) => {
        const env = loadEnv();

        // Extract runId (mandatory)
        const q = (req as any).query as Record<string, string> | undefined;
        const runId = (
            q?.runId ||
            q?.localRunId ||
            (req as any).params?.runId ||
            ""
        ).trim();
        if (!runId) {
            return {
                status: 400,
                body: { error: "Missing required parameter: runId" },
            };
        }

        // githubRunId can be provided directly OR parse from githubRunUrl
        let githubRunId: string | null = q?.githubRunId || null;
        let runUrl: string | null = q?.githubRunUrl || null;
        if (!githubRunId && runUrl) {
            const m = /\/actions\/runs\/(\d+)/.exec(runUrl);
            if (m && m[1]) {
                githubRunId = m[1];
                ctx.log(
                    `validation-status: parsed githubRunId ${githubRunId} from githubRunUrl`,
                );
            }
        }

        // Repo targeting precedence: explicit env owner/name -> GITHUB_REPOSITORY -> default
        let owner = process.env.GITHUB_REPO_OWNER;
        let repo = process.env.GITHUB_REPO_NAME;
        let repoSource = "env:owner-name";
        if (!owner || !repo) {
            const repoSlug =
                process.env.GITHUB_REPOSITORY ||
                "Template-Doctor/template-doctor";
            [owner, repo] = repoSlug.split("/");
            repoSource = process.env.GITHUB_REPOSITORY
                ? "env:repository"
                : "default";
        }

        const isLocal = !process.env.WEBSITE_INSTANCE_ID;
        const allowRepoOverride =
            isLocal || process.env.ALLOW_REPO_OVERRIDE === "1";
        if (allowRepoOverride) {
            const qOwner = q?.owner;
            const qRepo = q?.repo;
            if (qOwner || qRepo) {
                owner = qOwner || owner;
                repo = qRepo || repo;
                repoSource = "query-override";
                ctx.log(
                    `validation-status: using owner/repo override from query (local only): ${owner}/${repo}`,
                );
            }
        }
        ctx.log(
            `validation-status: targeting repo ${owner}/${repo} (source: ${repoSource})`,
        );

        const token = env.GH_WORKFLOW_TOKEN;
        let branch = process.env.GITHUB_REPO_BRANCH || "main";
        let workflowFile =
            process.env.GITHUB_WORKFLOW_FILE || "validation-template.yml";
        if (allowRepoOverride) {
            const qBranch = q?.branch;
            const qWorkflow = q?.workflow;
            if (qBranch) branch = qBranch;
            if (qWorkflow) workflowFile = qWorkflow;
        }
        ctx.log(
            `validation-status: using workflow '${workflowFile}' on branch '${branch}'`,
        );

        // Build shared helper (handles octokit vs fetch internally)
        const gh = await createGitHubHelper(ctx, {
            owner,
            repo,
            workflowFile,
            branch,
        });

        // Discover run if githubRunId not provided
        if (!githubRunId) {
            const discoveredRun = await gh.findRunByLocalCorrelation(runId);

            if (discoveredRun) {
                githubRunId = String(discoveredRun.id);
                runUrl = discoveredRun.html_url;
                ctx.log(
                    `Discovered workflow run ${githubRunId} for ${owner}/${repo} and local runId ${runId}`,
                );
            } else {
                ctx.log(
                    `validation-status: no matching workflow run found for runId ${runId}; returning pending.`,
                );
                return {
                    status: 200,
                    body: { runId, status: "pending", conclusion: null },
                };
            }
        }

        // Fetch workflow run details
        let ghData: any; // WorkflowRun
        try {
            ghData = await gh.getWorkflowRun(Number(githubRunId));
        } catch (getErr: any) {
            if (
                getErr &&
                (getErr.status === 401 ||
                    /bad credentials/i.test(getErr.message))
            ) {
                const hint =
                    "Private repo access requires a valid GH_WORKFLOW_TOKEN with repo/workflow scopes (or fine-grained: Actions Read, Contents Read, Metadata Read) and SAML SSO authorization if enforced.";
                (ctx.log as any).warn?.(
                    `getWorkflowRun 401 for ${owner}/${repo} run ${githubRunId}. ${hint}`,
                );
                return {
                    status: 502,
                    body: {
                        error: "Bad credentials - https://docs.github.com/rest",
                        type: "github_api_error",
                        errorCode: "GITHUB_API_ERROR",
                        hint,
                        repo: `${owner}/${repo}`,
                        repoSource,
                        githubRunId,
                        timestamp: new Date().toISOString(),
                        ...(isLocal
                            ? {
                                  debug: {
                                      usedAuth: !!token,
                                      overrideEnabled: allowRepoOverride,
                                      workflowFile,
                                      branch,
                                  },
                              }
                            : {}),
                    },
                };
            }
            throw getErr;
        }

        // Optional logs retrieval
        let logsArchiveUrl: string | null | undefined = undefined;
        let jobLogs:
            | Array<{
                  id: number;
                  name: string;
                  status: string;
                  conclusion: string | null;
                  startedAt?: string;
                  completedAt?: string;
                  logsUrl?: string | undefined;
              }>
            | undefined;
        const wantArchive = ["1", "true"].includes(
            (q?.includeLogsUrl || "").toLowerCase(),
        );
        const wantJobLogs = ["1", "true"].includes(
            (q?.includeJobLogs || "").toLowerCase(),
        );
        if (wantArchive || wantJobLogs) {
            try {
                const baseHeaders: Record<string, string> = {
                    accept: "application/vnd.github.v3+json",
                    "user-agent": "TemplateDoctorApp",
                };
                if (token) baseHeaders["authorization"] = `token ${token}`;

                if (wantArchive) {
                    logsArchiveUrl = await gh.fetchLogsArchiveRedirect(
                        Number(githubRunId),
                    );
                }
                if (wantJobLogs) {
                    const jobs = await gh.listJobs(Number(githubRunId));
                    jobLogs = [];
                    for (const j of jobs) {
                        const url = await gh.fetchJobLogRedirect(j.id);
                        jobLogs.push({
                            id: j.id,
                            name: j.name,
                            status: j.status,
                            conclusion: j.conclusion,
                            startedAt: j.started_at,
                            completedAt: j.completed_at,
                            logsUrl: url,
                        });
                    }
                }
            } catch (logErr: any) {
                (ctx.log as any).warn?.(
                    `validation-status: fetching logs URLs failed: ${logErr.message}`,
                );
            }
        }

        return {
            status: 200,
            body: {
                runId,
                githubRunId,
                status: ghData.status,
                conclusion: ghData.conclusion,
                runUrl: runUrl || ghData.html_url,
                startTime: ghData.run_started_at,
                endTime: ghData.updated_at,
                ...(wantArchive ? { logsArchiveUrl } : {}),
                ...(wantJobLogs ? { jobLogs } : {}),
                ...(isLocal
                    ? {
                          debug: {
                              repo: `${owner}/${repo}`,
                              repoSource,
                              usedAuth: !!token,
                              overrideEnabled: allowRepoOverride,
                              workflowFile,
                              branch,
                          },
                      }
                    : {}),
            },
        };
    },
);
