import { Context } from "@azure/functions";
import { wrapHttp } from "./shared/http";
import { loadEnv } from "./shared/env";
import { isPost } from "./shared/validation";
import crypto from "crypto";

interface DispatchInputs {
    targetRepoUrl: string;
    callbackUrl?: string;
}

export default wrapHttp(async (req: any, ctx: Context, requestId: string) => {
    const methodCheck = isPost(req.method, requestId);
    if (methodCheck.error) return methodCheck.error;
    const env = loadEnv();
    const body: DispatchInputs =
        req.body && typeof req.body === "object" ? req.body : ({} as any);
    const { targetRepoUrl, callbackUrl } = body;
    if (
        !targetRepoUrl ||
        typeof targetRepoUrl !== "string" ||
        !/^https?:\/\//i.test(targetRepoUrl)
    ) {
        return {
            status: 400,
            body: {
                error: "targetRepoUrl is required and must be a valid URL",
                requestId,
            },
        };
    }
    const runId = crypto.randomUUID();
    // Derive owner/repo/workflow from env with defaults
    let owner = process.env.GITHUB_REPO_OWNER;
    let repo = process.env.GITHUB_REPO_NAME;
    if (!owner || !repo) {
        const slug =
            process.env.GITHUB_REPOSITORY || "Template-Doctor/template-doctor";
        [owner, repo] = slug.split("/");
    }
    const branch = process.env.GITHUB_REPO_BRANCH || "main";
    const workflowFile =
        process.env.GITHUB_WORKFLOW_FILE || "validation-template.yml";
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
    const ghUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;
    const payload = {
        ref: branch,
        inputs: {
            target_validate_template_url: targetRepoUrl,
            callback_url: callbackUrl || "",
            run_id: runId,
            customValidators: "azd-up,azd-down",
        },
    };
    ctx.log("validation-template dispatch", {
        requestId,
        ghUrl,
        branch,
        workflowFile,
    });
    try {
        const res = await fetch(ghUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const text = await res.text();
            ctx.log.error("validation-template dispatch failure", {
                requestId,
                status: res.status,
                text,
            });
            return {
                status: 502,
                body: {
                    error: `GitHub dispatch failed: ${res.status} ${res.statusText}`,
                    details: text.slice(0, 1000),
                    requestId,
                },
            };
        }
        return {
            status: 200,
            body: { runId, message: "Workflow triggered", requestId },
        };
    } catch (err: any) {
        ctx.log.error("validation-template exception", {
            requestId,
            error: err?.message,
        });
        return {
            status: 500,
            body: { error: "Internal dispatch error", requestId },
        };
    }
});
