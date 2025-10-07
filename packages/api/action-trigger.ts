import { Context } from "@azure/functions";
import { wrapHttp } from "./shared/http";
import { loadEnv } from "./shared/env";
import { isPost, parseOwnerRepo } from "./shared/validation";

// Constants
const POLLING_LOOKBACK_MS = 10 * 60 * 1000; // 10 minutes

interface TriggerBody {
    workflowOrgRep?: string; // owner/repo
    workflowId?: string | number; // file name or numeric id
    workflowInput?: Record<string, any>;
    runIdInputProperty?: string; // property inside workflowInput used for correlation
}

async function dispatchWorkflow(
    owner: string,
    repo: string,
    workflowId: string | number,
    inputs: Record<string, any>,
    token: string,
    ctx: Context,
) {
    const idPart = encodeURIComponent(String(workflowId));
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${idPart}/dispatches`;
    const body = { ref: "main", inputs };
    ctx.log("action-trigger: dispatch", { owner, repo, workflowId });
    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    return res;
}

async function listRecentRuns(
    owner: string,
    repo: string,
    workflowId: string | number,
    token: string,
    sinceIso: string,
    ctx: Context,
) {
    const idPart = encodeURIComponent(String(workflowId));
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${idPart}/runs?event=workflow_dispatch&per_page=100&branch=main&created:>=${encodeURIComponent(sinceIso)}`;
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
        },
    });
    if (!res.ok) {
        const text = await res.text();
        ctx.log.warn("action-trigger: listRecentRuns failed", {
            status: res.status,
            text: text.slice(0, 500),
        });
        return { ok: false, status: res.status, text };
    }
    const json = await res.json();
    return { ok: true, json };
}

export default wrapHttp(async (req: any, ctx: Context, requestId: string) => {
    const methodCheck = isPost(req.method, requestId);
    if (methodCheck.error) return methodCheck.error;
    const env = loadEnv();
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
    const body: TriggerBody =
        req.body && typeof req.body === "object" ? req.body : {};
    const {
        workflowOrgRep,
        workflowId,
        workflowInput = {},
        runIdInputProperty,
    } = body;
    const orgRep = parseOwnerRepo(workflowOrgRep, requestId);
    if (orgRep.error) return orgRep.error;
    if (workflowId === undefined || workflowId === null || workflowId === "") {
        return {
            status: 400,
            body: {
                error: "workflowId is required",
                errorType: "MISSING_PARAMETER",
                requestId,
            },
        };
    }
    if (!runIdInputProperty) {
        return {
            status: 400,
            body: {
                error: "runIdInputProperty is required",
                errorType: "MISSING_PARAMETER",
                requestId,
            },
        };
    }
    const { owner, repo } = orgRep.value!;
    const uniqueInputId = Object.prototype.hasOwnProperty.call(
        workflowInput,
        runIdInputProperty,
    )
        ? workflowInput[runIdInputProperty]
        : undefined;
    if (!uniqueInputId) {
        return {
            status: 400,
            body: {
                error: `Input property ${runIdInputProperty} is missing in workflowInput`,
                errorType: "MISSING_INPUT_PROPERTY",
                requestId,
            },
        };
    }
    // Ten minutes lookback for polling
    const tenMinutesAgoIso = new Date(
        Date.now() - POLLING_LOOKBACK_MS,
    ).toISOString();
    // Dispatch
    const dispatchRes = await dispatchWorkflow(
        owner,
        repo,
        workflowId,
        workflowInput,
        token,
        ctx,
    );
    if (!dispatchRes.ok) {
        const text = await dispatchRes.text();
        return {
            status: 502,
            body: {
                error: `GitHub dispatch failed: ${dispatchRes.status} ${dispatchRes.statusText}`,
                details: text.slice(0, 1000),
                errorType: "GITHUB_API_ERROR",
                requestId,
            },
        };
    }
    // Polling attempts (5) incremental backoff 5s,10s,15s,20s,25s
    const maxAttempts = 5;
    let foundRun: any = null;
    for (let attempt = 1; attempt <= maxAttempts && !foundRun; attempt++) {
        const waitMs = 5000 * attempt;
        ctx.log("action-trigger: waiting for run registration", {
            attempt,
            waitSeconds: waitMs / 1000,
            requestId,
        });
        await new Promise((r) => setTimeout(r, waitMs));
        const list = await listRecentRuns(
            owner,
            repo,
            workflowId,
            token,
            tenMinutesAgoIso,
            ctx,
        );
        if (!list.ok) continue;
        const runs = list.json.workflow_runs || [];
        for (const r of runs) {
            const title = r.display_title || r.name || "";
            const msg = r.head_commit?.message || "";
            if (
                (title && title.includes(String(uniqueInputId))) ||
                (msg && msg.includes(String(uniqueInputId)))
            ) {
                foundRun = r;
                break;
            }
        }
        if (foundRun) {
            return {
                status: 200,
                body: {
                    error: null,
                    data: { runId: foundRun.id, attempts: attempt },
                    context: {
                        uniqueInputId,
                        ownerRepo: `${owner}/${repo}/actions/workflows/${workflowId}/runs`,
                        run: foundRun,
                        requestId,
                    },
                },
            };
        }
    }
    return {
        status: 404,
        body: {
            error: `trigger-action: Could not find the triggered workflow run after ${5} attempts`,
            errorType: "RUN_NOT_FOUND",
            data: null,
            context: {
                uniqueInputId,
                ownerRepo: `${owner}/${repo}/actions/workflows/${workflowId}/runs`,
                attempts: 5,
                requestId,
            },
        },
    };
});
