import { Context, HttpRequest } from "@azure/functions";
import { wrapHttp } from "./shared/http";
import { loadEnv } from "./shared/env";
import { createGitHubHelper } from "./shared/githubClient";

interface DiscoveryRun {
    id: number;
    display_title?: string;
    name?: string;
    head_commit?: { message?: string };
}

function allowOverride(): boolean {
    return (
        !process.env.WEBSITE_INSTANCE_ID ||
        /^true|1|yes$/i.test(String(process.env.ALLOW_REPO_OVERRIDE || ""))
    );
}

function resolveRepo(query: any) {
    let owner = process.env.GITHUB_REPO_OWNER || null;
    let repo = process.env.GITHUB_REPO_NAME || null;
    let repoSource = "env:explicit";
    if (!owner || !repo) {
        const ghRepo = process.env.GITHUB_REPOSITORY;
        if (ghRepo && ghRepo.includes("/")) {
            const [o, r] = ghRepo.split("/");
            owner = owner || o;
            repo = repo || r;
            repoSource = "env:GITHUB_REPOSITORY";
        }
    }
    if (!owner || !repo) {
        owner = owner || "Template-Doctor";
        repo = repo || "template-doctor";
        repoSource = "default";
    }
    if (allowOverride() && query) {
        if (query.owner) {
            owner = query.owner;
            repoSource += "+override";
        }
        if (query.repo) {
            repo = query.repo;
            repoSource += "+override";
        }
    }
    return { owner: owner!, repo: repo!, repoSource };
}

async function discoverRunId(
    ctx: Context,
    helper: ReturnType<typeof createGitHubHelper> extends Promise<infer T>
        ? T
        : any,
    localRunId: string,
    workflowFile: string,
    branch: string,
): Promise<number | null> {
    // Use helper.listRecentWorkflowRuns (already filters by workflow/branch when configured)
    try {
        const runs = await helper.listRecentWorkflowRuns();
        for (const r of runs) {
            const title = (r as any).display_title || r.name || "";
            const msg = r.head_commit?.message || "";
            if (
                (title && title.includes(localRunId)) ||
                msg.includes(localRunId)
            )
                return r.id;
        }
    } catch (e: any) {
        ctx.log.warn(`validation-cancel: discovery list failed: ${e.message}`);
    }
    return null;
}

async function cancelRun(
    owner: string,
    repo: string,
    runId: number,
    token: string,
    ctx: Context,
) {
    const endpoint = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/cancel`;
    ctx.log("validation-cancel: cancel POST", { owner, repo, runId });
    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "template-doctor-functions",
        },
    });
    if (res.status === 202) return true;
    const text = await res.text().catch(() => "");
    throw new Error(
        `GitHub cancel failed: ${res.status} ${res.statusText} - ${text}`,
    );
}

export default wrapHttp(
    async (req: HttpRequest, ctx: Context, requestId: string) => {
        if (req.method !== "POST") {
            return {
                status: 405,
                body: { error: "Method Not Allowed", requestId },
            };
        }
        const env = loadEnv();
        const token = env.GH_WORKFLOW_TOKEN || "";
        const q: any = (req as any).query || {};
        const b: any = (req as any).body || {};
        const { owner, repo, repoSource } = resolveRepo(q);
        let branch = process.env.GITHUB_REPO_BRANCH || "main";
        let workflowFile =
            process.env.GITHUB_WORKFLOW_FILE || "validation-template.yml";
        if (allowOverride()) {
            if (q.branch) branch = q.branch;
            if (q.workflow) workflowFile = q.workflow;
        }
        const localRunId =
            q.runId || b.runId || q.localRunId || b.localRunId || null;
        let githubRunId: string | number | null =
            q.githubRunId || b.githubRunId || null;
        const githubRunUrl = q.githubRunUrl || b.githubRunUrl || null;
        if (!githubRunId && githubRunUrl) {
            const m = /\/actions\/runs\/(\d+)/.exec(String(githubRunUrl));
            if (m && m[1]) githubRunId = m[1];
        }
        if (!githubRunId && !localRunId) {
            return {
                status: 400,
                body: {
                    error: "Missing githubRunId. Provide githubRunId or githubRunUrl, or include runId for discovery.",
                    requestId,
                    hint: "Call validation-status first to resolve githubRunId then retry.",
                },
            };
        }
        try {
            const helper = await createGitHubHelper(ctx, {
                owner,
                repo,
                workflowFile,
                branch,
            });
            if (!githubRunId && localRunId) {
                const discovered = await discoverRunId(
                    ctx,
                    helper,
                    String(localRunId),
                    workflowFile,
                    branch,
                );
                if (discovered) {
                    githubRunId = discovered;
                    ctx.log(
                        `validation-cancel: discovered run ${githubRunId} for local runId ${localRunId}`,
                    );
                } else {
                    return {
                        status: 400,
                        body: {
                            error: "Missing githubRunId and discovery failed",
                            requestId,
                            debug: allowOverride()
                                ? {
                                      owner,
                                      repo,
                                      branch,
                                      workflowFile,
                                      localRunId,
                                  }
                                : undefined,
                        },
                    };
                }
            }
            if (!token) {
                return {
                    status: 401,
                    body: {
                        error: "Missing GH_WORKFLOW_TOKEN",
                        requestId,
                        hint: "Set GH_WORKFLOW_TOKEN with workflow:write scope.",
                    },
                };
            }
            const runIdNum =
                typeof githubRunId === "string"
                    ? parseInt(githubRunId, 10)
                    : (githubRunId as number);
            if (!Number.isFinite(runIdNum)) {
                return {
                    status: 400,
                    body: { error: "githubRunId must be numeric", requestId },
                };
            }
            await cancelRun(owner, repo, runIdNum, token, ctx);
            return {
                status: 200,
                body: {
                    message: `Workflow run ${runIdNum} cancellation requested (202 Accepted).`,
                    githubRunId: runIdNum,
                    runUrl: `https://github.com/${owner}/${repo}/actions/runs/${runIdNum}`,
                    localRunId,
                    repo: `${owner}/${repo}`,
                    requestId,
                },
            };
        } catch (err: any) {
            const msg = err?.message || "Cancellation error";
            const isAuth = /401|403/.test(msg);
            return {
                status: isAuth ? 401 : 500,
                body: {
                    error: msg,
                    requestId,
                    suggestion: isAuth
                        ? "Verify GH_WORKFLOW_TOKEN scopes and SSO authorization."
                        : undefined,
                },
            };
        }
    },
);
