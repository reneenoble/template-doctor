import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { listOverrides, getMergedValue } from "../shared/config-overrides.js";

export const configRouter = Router();

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
    overrides?: Record<string, string>;
}

// Runtime config endpoint (client-settings)
configRouter.get("/client-settings", (req: Request, res: Response) => {
    const requestId = uuidv4();

    if (req.method === "OPTIONS") {
        return res.status(204).send();
    }

    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method Not Allowed", requestId });
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
            // Only include baseUrl if it has a non-empty value
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

    return res.status(200).json(payload);
});
