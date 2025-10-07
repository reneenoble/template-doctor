import { HttpRequest } from "@azure/functions";
import { InvocationContext } from "./platform/functions-types";
import { readJson } from "./platform/http";
import { Octokit } from "@octokit/rest";
import { classifyGitHubForkError } from "./github/error-classifier";

/**
 * repo-fork (Azure Function v4 HTTP)
 * POST /v4/repo-fork
 * Body: { sourceOwner, sourceRepo, targetOwner?: string, waitForReady?: boolean }
 * Uses GH_WORKFLOW_TOKEN to initiate a fork into authenticated token's user/org (default) or provided targetOwner (if permissions allow).
 * Returns: { forkOwner, repo, htmlUrl, ready, attemptedCreate: boolean }
 * On SAML SSO authorization required: HTTP 403 { error, samlRequired: true, documentationUrl?, authorizeUrl? }
 */
export async function repoForkHandler(
    request: HttpRequest,
    context: InvocationContext,
) {
    const cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (request.method === "OPTIONS") return { status: 204, headers: cors };
    if (request.method !== "POST")
        return {
            status: 405,
            headers: cors,
            jsonBody: { error: "Method not allowed" },
        };

    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!token)
        return {
            status: 500,
            headers: cors,
            jsonBody: {
                error: "Server misconfiguration: missing GH_WORKFLOW_TOKEN",
            },
        };

    let body: any;
    try {
        body = await readJson(request);
    } catch {
        body = undefined;
    }
    if (!body)
        return {
            status: 400,
            headers: cors,
            jsonBody: { error: "Invalid JSON body" },
        };

    const {
        sourceOwner,
        sourceRepo,
        targetOwner,
        waitForReady = true,
    } = body || {};
    if (!sourceOwner || !sourceRepo) {
        return {
            status: 400,
            headers: cors,
            jsonBody: { error: "Missing required: sourceOwner, sourceRepo" },
        };
    }

    const octokit = new Octokit({
        auth: token,
        userAgent: "TemplateDoctorBackend",
    });

    // Determine identity of token (for default fork owner)
    let authedUser: string | undefined;
    try {
        const me = await octokit.users.getAuthenticated();
        authedUser = me.data.login;
    } catch (err) {
        context.log(
            "Failed to identify token user:",
            err instanceof Error ? err.message : err,
        );
    }
    // Fallback: if identity lookup fails, use explicit targetOwner, else default placeholder owner to allow fork attempt (tests/mocks)
    const forkOwner =
        targetOwner ||
        authedUser ||
        process.env.FORK_FALLBACK_OWNER ||
        "fallback-user";

    // Check if fork already exists
    try {
        const existing = await octokit.repos.get({
            owner: forkOwner,
            repo: sourceRepo,
        });
        return {
            status: 200,
            headers: cors,
            jsonBody: {
                forkOwner,
                repo: sourceRepo,
                htmlUrl: existing.data.html_url,
                ready: true,
                attemptedCreate: false,
            },
        };
    } catch {}

    // Create fork
    let forkHtml: string | undefined;
    try {
        const forkResp = await octokit.repos.createFork({
            owner: sourceOwner,
            repo: sourceRepo,
            organization: targetOwner,
        });
        forkHtml = forkResp.data?.html_url;
    } catch (err: any) {
        const classification = classifyGitHubForkError(err);
        if (classification.kind === "saml") {
            context.log("Fork blocked by SAML SSO requirement");
            return {
                status: 403,
                headers: cors,
                jsonBody: {
                    error: "SAML SSO authorization required to fork this repository",
                    samlRequired: true,
                    documentationUrl: classification.documentationUrl,
                    authorizeUrl: classification.documentationUrl,
                },
            };
        }
        context.log("Fork creation failed:", classification.message);
        return {
            status: 502,
            headers: cors,
            jsonBody: {
                error: "Failed to initiate fork",
                details: classification.message,
                documentationUrl: classification.documentationUrl,
            },
        };
    }

    if (!waitForReady) {
        return {
            status: 202,
            headers: cors,
            jsonBody: {
                forkOwner,
                repo: sourceRepo,
                htmlUrl: forkHtml,
                ready: false,
                attemptedCreate: true,
            },
        };
    }

    // Poll for readiness (limited attempts)
    let ready = false;
    for (let attempt = 0; attempt < 10; attempt++) {
        try {
            const r = await octokit.repos.get({
                owner: forkOwner,
                repo: sourceRepo,
            });
            if (r.status === 200) {
                ready = true;
                break;
            }
        } catch {}
        await delay(1500);
    }

    return {
        status: 201,
        headers: cors,
        jsonBody: {
            forkOwner,
            repo: sourceRepo,
            htmlUrl: forkHtml,
            ready,
            attemptedCreate: true,
        },
    };
}

function delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

export default repoForkHandler;
