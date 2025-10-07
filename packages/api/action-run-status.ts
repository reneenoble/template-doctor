import { Context } from "@azure/functions";
import { wrapHttp } from "./shared/http";
import { loadEnv } from "./shared/env";
import { createGitHubHelper } from "./shared/githubClient";
import { isPost, parseOwnerRepo, requireRunId } from "./shared/validation";

interface RequestBody {
    workflowOrgRep?: string; // owner/repo
    workflowRunId?: string | number;
}

export default wrapHttp(async (req: any, ctx: Context, requestId: string) => {
    const methodCheck = isPost(req.method, requestId);
    if (methodCheck.error) return methodCheck.error;

    const body: RequestBody =
        req.body && typeof req.body === "object" ? req.body : {};
    const { workflowOrgRep, workflowRunId } = body;

    const orgRep = parseOwnerRepo(workflowOrgRep, requestId);
    if (orgRep.error) return orgRep.error;
    const runIdParsed = requireRunId(workflowRunId, requestId);
    if (runIdParsed.error) return runIdParsed.error;
    const { owner, repo } = orgRep.value!;
    const env = loadEnv();
    if (!env.GH_WORKFLOW_TOKEN) {
        // Legacy implementation previously allowed unauth fetch; we require token for consistency with other endpoints
        return {
            status: 500,
            body: {
                error: "Server not configured (missing GH_WORKFLOW_TOKEN)",
                requestId,
            },
        };
    }

    try {
        const helper = await createGitHubHelper(ctx, { owner, repo });
        const runIdNum = runIdParsed.value;
        ctx.log("action-run-status: fetching workflow run", {
            owner,
            repo,
            runId: runIdNum,
            requestId,
        });
        const data = await helper.getWorkflowRun(runIdNum as number);
        return {
            status: 200,
            body: {
                error: null,
                data,
                context: { workflowOrgRep, workflowRunId, requestId },
            },
        };
    } catch (err: any) {
        const status = err && typeof err.status === "number" ? err.status : 500;
        const isAuth = status === 401 || status === 403;
        ctx.log.error("action-run-status: error fetching run", {
            requestId,
            status,
            message: err?.message,
        });
        return {
            status: isAuth ? 502 : 500,
            body: {
                error: "GitHub workflow run fetch failed",
                details: err?.message,
                errorType: "GITHUB_API_ERROR",
                requestId,
            },
        };
    }
});
