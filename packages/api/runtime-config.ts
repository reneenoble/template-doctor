import { Context } from "@azure/functions";
import { wrapHttp } from "./shared/http";
import { listOverrides, getMergedValue } from "./shared/config-overrides";

// Explicit whitelist of environment variables we intentionally expose to the client.
// NOTE: functionKey exposure is potentially sensitive; retained for parity with legacy implementation.
// Consider removing or proxying later during hardening phase.

interface PublicConfig {
    GITHUB_CLIENT_ID: string;
    backend: { baseUrl: string; functionKey?: string };
    DISPATCH_TARGET_REPO: string;
    DEFAULT_RULE_SET: string;
    REQUIRE_AUTH_FOR_RESULTS: string;
    AUTO_SAVE_RESULTS: string;
    ARCHIVE_ENABLED: string;
    ARCHIVE_COLLECTION: string;
    ISSUE_AI_ENABLED: string;
    overrides?: Record<string, string>; // surfaced for diagnostics / dynamic tuning visibility
}

export default wrapHttp(async (req: any, _ctx: Context, requestId: string) => {
    if (req.method === "OPTIONS") {
        return { status: 204 };
    }
    if (req.method !== "GET") {
        return {
            status: 405,
            body: { error: "Method Not Allowed", requestId },
        };
    }
    const baseUrl = getMergedValue(
        "TD_BACKEND_BASE_URL",
        process.env.TD_BACKEND_BASE_URL ||
            process.env.BACKEND_BASE_URL ||
            process.env.API_BASE_URL ||
            "",
    );
    const functionKey = getMergedValue(
        "TD_BACKEND_FUNCTION_KEY",
        process.env.TD_BACKEND_FUNCTION_KEY ||
            process.env.BACKEND_FUNCTION_KEY ||
            "",
    );
    const githubClientId = getMergedValue(
        "GITHUB_CLIENT_ID",
        process.env.GITHUB_CLIENT_ID || "",
    );
    const defaultRuleSet = getMergedValue(
        "DEFAULT_RULE_SET",
        process.env.DEFAULT_RULE_SET || process.env.TD_DEFAULT_RULE_SET || "",
    );
    const requireAuthForResults = getMergedValue(
        "REQUIRE_AUTH_FOR_RESULTS",
        process.env.REQUIRE_AUTH_FOR_RESULTS ||
            process.env.TD_REQUIRE_AUTH_FOR_RESULTS ||
            "",
    );
    const autoSaveResults = getMergedValue(
        "AUTO_SAVE_RESULTS",
        process.env.AUTO_SAVE_RESULTS || process.env.TD_AUTO_SAVE_RESULTS || "",
    );
    const archiveEnabled = getMergedValue(
        "ARCHIVE_ENABLED",
        process.env.TD_ARCHIVE_ENABLED || process.env.ARCHIVE_ENABLED || "",
    );
    const archiveCollection = getMergedValue(
        "ARCHIVE_COLLECTION",
        process.env.TD_ARCHIVE_COLLECTION ||
            process.env.ARCHIVE_COLLECTION ||
            "",
    );
    const dispatchTargetRepo = getMergedValue(
        "DISPATCH_TARGET_REPO",
        process.env.DISPATCH_TARGET_REPO ||
            process.env.TD_DISPATCH_TARGET_REPO ||
            "",
    );
    const issueAIEnabled = getMergedValue(
        "ISSUE_AI_ENABLED",
        process.env.ISSUE_AI_ENABLED || process.env.TD_ISSUE_AI_ENABLED || "",
    );

    const payload: PublicConfig = {
        GITHUB_CLIENT_ID: githubClientId,
        backend: {
            // Only include baseUrl if it has a non-empty value (let client config.json provide default for local dev)
            ...(baseUrl ? { baseUrl } : {}),
            ...(functionKey ? { functionKey } : {}),
        } as any,
        DISPATCH_TARGET_REPO: dispatchTargetRepo,
        DEFAULT_RULE_SET: defaultRuleSet,
        REQUIRE_AUTH_FOR_RESULTS: requireAuthForResults,
        AUTO_SAVE_RESULTS: autoSaveResults,
        ARCHIVE_ENABLED: archiveEnabled,
        ARCHIVE_COLLECTION: archiveCollection,
        ISSUE_AI_ENABLED: issueAIEnabled,
        overrides: listOverrides(),
    };

    return { status: 200, body: payload };
});
