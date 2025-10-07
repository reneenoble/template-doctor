import { Context } from "@azure/functions";
import { wrapHttp } from "./shared/http";
import { loadEnv } from "./shared/env";
import { isPost, parseOwnerRepo, requireRunId } from "./shared/validation";

interface RequestBody {
    workflowOrgRep?: string;
    workflowRunId?: string | number;
}

async function fetchArtifacts(
    owner: string,
    repo: string,
    runId: string | number,
    token: string,
    ctx: Context,
) {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${runId}/artifacts`;
    ctx.log("action-run-artifacts: fetching artifacts", { owner, repo, runId });
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    });
    if (!res.ok) {
        const text = await res.text();
        ctx.log.error("action-run-artifacts: fetch failed", {
            status: res.status,
            text: text.slice(0, 500),
        });
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

export default wrapHttp(async (req: any, ctx: Context, requestId: string) => {
    const methodCheck = isPost(req.method, requestId);
    if (methodCheck.error) return methodCheck.error;
    const env = loadEnv();
    const body: RequestBody =
        req.body && typeof req.body === "object" ? req.body : {};
    const { workflowOrgRep, workflowRunId } = body;
    const orgRep = parseOwnerRepo(workflowOrgRep, requestId);
    if (orgRep.error) return orgRep.error;
    const runIdParsed = requireRunId(workflowRunId, requestId);
    if (runIdParsed.error) return runIdParsed.error;
    const { owner, repo } = orgRep.value!;
    const token = env.GH_WORKFLOW_TOKEN;
    if (!token) {
        return {
            status: 500,
            body: {
                error: "Server not configured (missing GH_WORKFLOW_TOKEN)",
                requestId,
            },
        };
    }
    try {
        const result = await fetchArtifacts(
            owner,
            repo,
            runIdParsed.value as number,
            token,
            ctx,
        );
        if (!result.ok) {
            const isAuth = result.status === 401 || result.status === 403;
            return {
                status: isAuth ? 502 : 500,
                body: {
                    error: `GitHub artifacts fetch failed: ${result.status} ${result.statusText}`,
                    details: result.text?.slice(0, 500),
                    errorType: "GITHUB_API_ERROR",
                    requestId,
                },
            };
        }
        const artifactCount = result.json.total_count || 0;
        return {
            status: 200,
            body: {
                error: null,
                data: result.json,
                context: {
                    ownerRepo: `${owner}/${repo}`,
                    requestId,
                    workflowRunId,
                    artifactCount,
                },
            },
        };
    } catch (err: any) {
        ctx.log.error("action-run-artifacts: unexpected error", {
            requestId,
            error: err?.message,
        });
        return {
            status: 500,
            body: {
                error: "Internal Server Error",
                errorType: "SERVER_ERROR",
                requestId,
            },
        };
    }
});
