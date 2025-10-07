import { Context } from "@azure/functions";
import { wrapHttp } from "./shared/http";
import { loadEnv } from "./shared/env";
import { isPost } from "./shared/validation";

interface IncomingBody {
    event_type?: string;
    client_payload?: Record<string, any>;
}

// Parity migration of legacy submit-analysis-dispatch with structured validation & logging.
export default wrapHttp(async (req: any, ctx: Context, requestId: string) => {
    const methodCheck = isPost(req.method, requestId);
    if (methodCheck.error) return methodCheck.error;

    const env = loadEnv();
    const token = env.GH_WORKFLOW_TOKEN;
    if (!token) {
        return {
            status: 500,
            body: {
                error: "Server misconfiguration: GH_WORKFLOW_TOKEN missing",
                requestId,
            },
        };
    }

    const body: IncomingBody =
        req.body && typeof req.body === "object" ? req.body : {};
    const { event_type, client_payload } = body;
    if (!event_type || !client_payload) {
        return {
            status: 400,
            body: { error: "Missing event_type or client_payload", requestId },
        };
    }

    // Repo slug resolution precedence (parity with legacy):
    // 1. client_payload.targetRepo or client_payload.repoSlug
    // 2. GH_TARGET_REPO
    // 3. GITHUB_REPOSITORY
    // 4. Default 'Template-Doctor/template-doctor'
    const fromPayload =
        (typeof client_payload.targetRepo === "string" &&
            client_payload.targetRepo) ||
        (typeof client_payload.repoSlug === "string" &&
            client_payload.repoSlug) ||
        "";
    let repoSlug: string =
        fromPayload ||
        process.env.GH_TARGET_REPO ||
        process.env.GITHUB_REPOSITORY ||
        "Template-Doctor/template-doctor";
    if (typeof repoSlug !== "string" || !repoSlug.includes("/")) {
        repoSlug = "Template-Doctor/template-doctor";
    }

    const apiUrl = `https://api.github.com/repos/${repoSlug}/dispatches`;
    ctx.log("[submit-analysis-dispatch] dispatching", {
        requestId,
        event_type,
        repoSlug,
    });
    try {
        const ghRes = await fetch(apiUrl, {
            method: "POST",
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github.v3+json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ event_type, client_payload }),
        });
        if (!ghRes.ok) {
            const text = await ghRes.text();
            ctx.log.error("[submit-analysis-dispatch] GitHub dispatch failed", {
                requestId,
                status: ghRes.status,
                text: text.slice(0, 1000),
            });
            // Legacy returned ghRes.status directly; keep 1:1
            return {
                status: ghRes.status,
                body: {
                    error: "GitHub dispatch failed",
                    status: ghRes.status,
                    details: text,
                    requestId,
                },
            };
        }
        // Legacy returned 204 with custom header; preserve.
        return {
            status: 204,
            headers: { "x-template-doctor-repo-slug": repoSlug },
            body: undefined,
        };
    } catch (err: any) {
        ctx.log.error("[submit-analysis-dispatch] exception", {
            requestId,
            error: err?.message,
        });
        return {
            status: 500,
            body: {
                error: "Internal Server Error",
                details: err?.message,
                requestId,
            },
        };
    }
});
