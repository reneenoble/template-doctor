import { wrapHttp } from "./shared/http";
import { randomUUID } from "crypto";
import type { HttpRequest, Context } from "@azure/functions";

interface Issue {
    id: string;
    severity: "warning" | "error";
    message: string;
    details?: any;
}
interface Compliance {
    id: string;
    category: string;
    message: string;
    details?: any;
}

// Reuse existing scorecard JS module (kept in CommonJS) for core workflow logic.
async function loadScorecard() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("../../validation-ossf/scorecard.js");
}

export const handler = wrapHttp(async (req: HttpRequest, ctx: Context) => {
    if (req.method !== "POST")
        return { status: 405, body: { error: "Method not allowed" } };
    const body: any = req.body || {};
    const templateUrl = body.templateUrl;
    const minScore = body.minScore;
    if (!templateUrl) {
        return {
            status: 400,
            body: {
                error: "templateUrl is required",
                type: "validation_error",
            },
        };
    }
    if (typeof minScore === "undefined" || minScore === null) {
        return {
            status: 400,
            body: { error: "minScore is required", type: "validation_error" },
        };
    }
    const minScoreNum = parseFloat(minScore);
    if (Number.isNaN(minScoreNum) || minScoreNum < 0 || minScoreNum > 10) {
        return {
            status: 400,
            body: { error: "Invalid minScore value", type: "validation_error" },
        };
    }
    const localRunId = randomUUID();
    const owner = process.env.GITHUB_REPO_OWNER || "Template-Doctor";
    const repo = process.env.GITHUB_REPO_NAME || "template-doctor";
    const workflowFile =
        process.env.GITHUB_WORKFLOW_FILE || "validate-ossf-score.yml";
    if (!process.env.GH_WORKFLOW_TOKEN) {
        return {
            status: 500,
            body: {
                error: "Missing GH_WORKFLOW_TOKEN app setting",
                type: "configuration_error",
            },
        };
    }
    const issues: Issue[] = [];
    const compliance: Compliance[] = [];
    try {
        const { getOSSFScore } = await loadScorecard();
        const timeoutMs = 180_000; // 3 minutes
        const timeoutPromise = new Promise((_resolve, reject) =>
            setTimeout(
                () =>
                    reject(
                        new Error("OSSF score check timed out after 3 minutes"),
                    ),
                timeoutMs,
            ),
        );
        const scorePromise = getOSSFScore(
            ctx,
            owner,
            repo,
            workflowFile,
            templateUrl,
            localRunId,
            minScoreNum,
            issues,
            compliance,
        );
        const result: any = await Promise.race([scorePromise, timeoutPromise]);
        const { score = null, runId = null } = result || {};
        return {
            status: 200,
            body: {
                api: "ossf",
                templateUrl,
                runId: localRunId,
                githubRunId: runId || null,
                githubRunUrl: runId
                    ? `https://github.com/${owner}/${repo}/actions/runs/${runId}`
                    : null,
                message: `${workflowFile} workflow triggered; ${localRunId} run completed`,
                details: { score },
                issues,
                compliance,
            },
        };
    } catch (err: any) {
        const msg = err?.message || "Unknown error";
        let status = 500;
        let type = "server_error";
        let details = "Internal server error";
        if (/GitHub dispatch failed/i.test(msg)) {
            status = 502;
            type = "github_api_error";
            details = "Error communicating with GitHub API";
        } else if (/timed out/i.test(msg)) {
            status = 504;
            type = "timeout_error";
            details = "OSSF score check operation timed out";
        } else if (/GH_WORKFLOW_TOKEN/i.test(msg)) {
            type = "configuration_error";
            details = "Missing required GitHub authentication token";
        }
        issues.push({ id: `ossf-${type}`, severity: "error", message: msg });
        return { status, body: { error: msg, type, details, issues } };
    }
});

export default handler;
