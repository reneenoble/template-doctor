import { Context } from "@azure/functions";
import { wrapHttp } from "./shared/http";

interface CallbackBody {
    runId?: string;
    githubRunId?: string | number;
    status?: string;
    result?: any;
}

// Stateless callback: validates payload, emits log, sets cookie with runId for frontend polling.
export default wrapHttp(async (req: any, ctx: Context, requestId: string) => {
    if (req.method !== "POST") {
        return {
            status: 405,
            body: { error: "Method Not Allowed", requestId },
        };
    }
    const body: CallbackBody =
        req.body && typeof req.body === "object" ? req.body : {};
    const { runId, githubRunId, status, result } = body;
    if (!runId || !githubRunId) {
        return {
            status: 400,
            body: { error: "runId and githubRunId are required", requestId },
        };
    }
    const repoSlug =
        process.env.GITHUB_REPOSITORY || "Template-Doctor/template-doctor";
    const runUrl = `https://github.com/${repoSlug}/actions/runs/${githubRunId}`;
    ctx.log("validation-callback received", {
        runId,
        githubRunId,
        status,
        requestId,
    });
    const cookie = `td_runId=${encodeURIComponent(String(runId))}; Path=/; Max-Age=86400; SameSite=Lax`;
    return {
        status: 200,
        headers: {
            "Set-Cookie": cookie,
        },
        body: {
            message: "Mapping updated",
            runId,
            githubRunId,
            githubRunUrl: runUrl,
            requestId,
        },
    };
});
