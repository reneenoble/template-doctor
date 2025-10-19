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
configRouter.get("/client-settings", async (req: Request, res: Response) => {
    const requestId = uuidv4();

    if (req.method === "OPTIONS") {
        return res.status(204).send();
    }

    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method Not Allowed", requestId });
    }

    try {
        // Get configuration from database (with fallback to env vars)
        const { ConfigurationStorage } = await import(
            "../services/configuration-storage.js"
        );
        const dbConfig = await ConfigurationStorage.getAsObject();

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

        // Use database config with environment variable fallbacks
        const defaultRuleSet = getMergedValue(
            "DEFAULT_RULE_SET",
            String(
                dbConfig.DEFAULT_RULE_SET ||
                    process.env.DEFAULT_RULE_SET ||
                    process.env.TD_DEFAULT_RULE_SET ||
                    "dod",
            ),
        );

        const requireAuthForResults = getMergedValue(
            "REQUIRE_AUTH_FOR_RESULTS",
            String(
                dbConfig.REQUIRE_AUTH_FOR_RESULTS ||
                    process.env.REQUIRE_AUTH_FOR_RESULTS ||
                    process.env.TD_REQUIRE_AUTH_FOR_RESULTS ||
                    "false",
            ),
        );

        const autoSaveResults = getMergedValue(
            "AUTO_SAVE_RESULTS",
            String(
                dbConfig.AUTO_SAVE_RESULTS ||
                    process.env.AUTO_SAVE_RESULTS ||
                    process.env.TD_AUTO_SAVE_RESULTS ||
                    "false",
            ),
        );

        const archiveEnabled = getMergedValue(
            "ARCHIVE_ENABLED",
            String(
                dbConfig.ARCHIVE_ENABLED ||
                    process.env.TD_ARCHIVE_ENABLED ||
                    process.env.ARCHIVE_ENABLED ||
                    "true",
            ),
        );

        const archiveCollection = getMergedValue(
            "ARCHIVE_COLLECTION",
            String(
                dbConfig.ARCHIVE_COLLECTION ||
                    process.env.TD_ARCHIVE_COLLECTION ||
                    process.env.ARCHIVE_COLLECTION ||
                    "gallery",
            ),
        );

        const dispatchTargetRepo = getMergedValue(
            "DISPATCH_TARGET_REPO",
            String(
                dbConfig.DISPATCH_TARGET_REPO ||
                    process.env.DISPATCH_TARGET_REPO ||
                    process.env.TD_DISPATCH_TARGET_REPO ||
                    "",
            ),
        );

        const issueAIEnabled = getMergedValue(
            "ISSUE_AI_ENABLED",
            String(
                dbConfig.ISSUE_AI_ENABLED ||
                    process.env.ISSUE_AI_ENABLED ||
                    process.env.TD_ISSUE_AI_ENABLED ||
                    "false",
            ),
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
    } catch (error: any) {
        console.error("[Config] Error loading client settings:", error);

        // Fallback to environment variables only if database fails
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
            process.env.DEFAULT_RULE_SET ||
                process.env.TD_DEFAULT_RULE_SET ||
                "dod",
        );

        const requireAuthForResults = getMergedValue(
            "REQUIRE_AUTH_FOR_RESULTS",
            process.env.REQUIRE_AUTH_FOR_RESULTS ||
                process.env.TD_REQUIRE_AUTH_FOR_RESULTS ||
                "false",
        );

        const autoSaveResults = getMergedValue(
            "AUTO_SAVE_RESULTS",
            process.env.AUTO_SAVE_RESULTS ||
                process.env.TD_AUTO_SAVE_RESULTS ||
                "false",
        );

        const archiveEnabled = getMergedValue(
            "ARCHIVE_ENABLED",
            process.env.TD_ARCHIVE_ENABLED ||
                process.env.ARCHIVE_ENABLED ||
                "true",
        );

        const archiveCollection = getMergedValue(
            "ARCHIVE_COLLECTION",
            process.env.TD_ARCHIVE_COLLECTION ||
                process.env.ARCHIVE_COLLECTION ||
                "gallery",
        );

        const dispatchTargetRepo = getMergedValue(
            "DISPATCH_TARGET_REPO",
            process.env.DISPATCH_TARGET_REPO ||
                process.env.TD_DISPATCH_TARGET_REPO ||
                "",
        );

        const issueAIEnabled = getMergedValue(
            "ISSUE_AI_ENABLED",
            process.env.ISSUE_AI_ENABLED ||
                process.env.TD_ISSUE_AI_ENABLED ||
                "false",
        );

        const payload: PublicConfig = {
            GITHUB_CLIENT_ID: githubClientId,
            backend: {
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
    }
});
