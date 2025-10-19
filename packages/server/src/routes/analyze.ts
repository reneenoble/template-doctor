import { Router, Request, Response } from "express";
import { runAnalyzer } from "../analyzer-core/index.js";
import { analysisStorage } from "../services/analysis-storage.js";

export const analyzeRouter = Router();

interface AnalyzeRequest {
    repoUrl?: string; // Single repo (legacy)
    repos?: string[]; // Batch repos (new)
    ruleSet?: string;
    azureDeveloperCliEnabled?: boolean;
    aiDeprecationCheckEnabled?: boolean;
    archiveOverride?: boolean;
}

interface GitHubFile {
    path: string;
    sha: string;
    content?: string;
    type?: string;
}

interface BatchAnalyzeResult {
    batchId: string;
    total: number;
    results: Array<{
        repoUrl: string;
        status: "success" | "error";
        result?: any;
        error?: string;
    }>;
}

// POST /api/v4/analyze-template
analyzeRouter.post("/analyze-template", async (req: Request, res: Response) => {
    try {
        const requestBody: AnalyzeRequest = req.body || {};
        const {
            repoUrl,
            repos,
            ruleSet = "dod",
            azureDeveloperCliEnabled,
            aiDeprecationCheckEnabled,
            archiveOverride,
        } = requestBody;

        const categoriesRaw = (req.query?.categories as string) || "";
        const categoriesParam = categoriesRaw.split(",").filter((x) => x);

        // Handle batch analysis
        if (repos && Array.isArray(repos) && repos.length > 0) {
            console.log(
                `Batch analysis requested for ${repos.length} repositories`,
            );
            const result = await handleBatchAnalysis(
                req,
                repos,
                ruleSet,
                azureDeveloperCliEnabled,
                aiDeprecationCheckEnabled,
                archiveOverride,
                categoriesParam,
            );
            return res.status(200).json(result);
        }

        // Handle single analysis (legacy path)
        if (!repoUrl) {
            return res
                .status(400)
                .json({ error: "repoUrl or repos array is required" });
        }

        // Delegate to core analysis function
        const result = await analyzeSingleRepository(
            req,
            repoUrl,
            ruleSet,
            azureDeveloperCliEnabled,
            aiDeprecationCheckEnabled,
            archiveOverride,
            categoriesParam,
        );

        return res.status(result.status).json(result.body);
    } catch (error: any) {
        console.error("Analyze endpoint error:", error);
        res.status(500).json({
            error: "Analysis failed",
            details: error?.message,
        });
    }
});

export async function analyzeSingleRepository(
    req: Request,
    repoUrl: string,
    ruleSet: string,
    azureDeveloperCliEnabled?: boolean,
    aiDeprecationCheckEnabled?: boolean,
    archiveOverride?: boolean,
    categoriesParam?: string[],
): Promise<{ status: number; body: any }> {
    // Get GitHub token from environment (server token with SAML)
    const token =
        process.env.GITHUB_TOKEN_ANALYZER ||
        process.env.GH_WORKFLOW_TOKEN ||
        process.env.GITHUB_TOKEN ||
        undefined;

    const gh = createGitHubClient(token);

    // Extract user from Authorization header if present (for fork-first strategy)
    const authHeader = req.headers.authorization || "";
    console.log(
        `[analyze] Authorization header present: ${!!authHeader}, length: ${authHeader.length}`,
    );
    const userToken = authHeader.replace(/^Bearer\s+/i, "") || undefined;
    console.log(
        `[analyze] User token extracted: ${!!userToken}, same as server token: ${userToken === token}`,
    );
    let authenticatedUser: string | undefined;

    // Always try to get username from user token if provided
    if (userToken) {
        try {
            const userInfo = await gh("/user", userToken);
            authenticatedUser = userInfo.login;
            console.log(
                `[analyze] ✅ Authenticated user: ${authenticatedUser}`,
            );
        } catch (e: any) {
            console.log(
                `[analyze] ❌ Failed to get authenticated user: ${e?.message}`,
            );
        }
    } else {
        console.log(
            `[analyze] ⚠️  No user token provided - scannedBy will be undefined`,
        );
    }

    let owner: string;
    let repo: string;
    let defaultBranch: string;

    try {
        const upstreamInfo = extractRepoInfo(repoUrl);
        owner = upstreamInfo.owner;
        repo = upstreamInfo.repo;

        // Fork-first strategy: if we have an authenticated user, check their fork first
        if (
            authenticatedUser &&
            authenticatedUser.toLowerCase() !== owner.toLowerCase()
        ) {
            console.log(
                `Attempting fork-first: checking ${authenticatedUser}/${repo}`,
            );
            try {
                const forkMeta = await gh(
                    `/repos/${authenticatedUser}/${repo}`,
                    userToken,
                );
                owner = authenticatedUser; // Use the fork
                defaultBranch = forkMeta.default_branch;
                console.log(
                    `Using fork: ${owner}/${repo} (branch: ${defaultBranch})`,
                );
            } catch (forkErr: any) {
                console.log(
                    `Fork not found, will try upstream: ${forkErr?.message}`,
                );
                // Fork doesn't exist, try upstream
                // Use SERVER token for org repos (it has SAML authorization)
                const fallbackToken = token || userToken;
                console.log(
                    `Accessing upstream with ${token ? "server" : "user"} token`,
                );
                const repoMeta = await gh(
                    `/repos/${owner}/${repo}`,
                    fallbackToken,
                );
                defaultBranch = repoMeta.default_branch;
            }
        } else {
            // No user token or user is the owner - access repo directly
            const accessToken = userToken || token;
            console.log(
                `Direct access with ${userToken ? "user" : "server"} token`,
            );
            const repoMeta = await gh(`/repos/${owner}/${repo}`, accessToken);
            defaultBranch = repoMeta.default_branch;
        }
    } catch (e: any) {
        return {
            status: 400,
            body: {
                error: "Failed to resolve repository",
                details: e?.message,
            },
        };
    }

    // Determine which token to use for content access
    const upstreamInfo = extractRepoInfo(repoUrl);
    const isAccessingFork =
        owner.toLowerCase() !== upstreamInfo.owner.toLowerCase();
    const contentAccessToken = isAccessingFork ? userToken : userToken || token;

    console.log(
        `Content access strategy: ${isAccessingFork ? "fork" : "direct"}, using ${contentAccessToken ? "user" : "server"} token`,
    );

    // List files (bounded) & selectively fetch content
    let files: GitHubFile[] = [];
    try {
        files = await listAllFilesFetch(
            gh,
            owner,
            repo,
            defaultBranch,
            "",
            contentAccessToken,
        );
    } catch (e: any) {
        return {
            status: 502,
            body: {
                error: "Failed to list repository files",
                details: e?.message,
            },
        };
    }

    const enriched: GitHubFile[] = [];
    for (const f of files.slice(0, 400)) {
        if (/\.(md|bicep|ya?ml|json)$/i.test(f.path)) {
            try {
                f.content = await getFileContentFetch(
                    gh,
                    owner,
                    repo,
                    f.path,
                    defaultBranch,
                    contentAccessToken,
                );
            } catch {}
        }
        enriched.push(f);
    }

    try {
        const result = await runAnalyzer(repoUrl, enriched, {
            ruleSet,
            deprecatedModels: (process.env.DEPRECATED_MODELS || "")
                .split(",")
                .filter(Boolean),
            categories: categoriesParam,
            azureDeveloperCliEnabled: azureDeveloperCliEnabled !== false,
            aiDeprecationCheckEnabled: aiDeprecationCheckEnabled !== false,
        });
        if (archiveOverride === true) result.archiveRequested = true;

        // Save results to database
        try {
            await analysisStorage.saveAnalysis({
                repoUrl,
                ruleSet,
                compliance: {
                    percentage: result.compliance?.percentage || 0,
                    issues: result.compliance?.issues || [],
                    compliant: result.compliance?.compliant || [],
                },
                categories: result.compliance?.categories,
                analysisResult: result,
                archiveRequested: result.archiveRequested,
                scannedBy: authenticatedUser ? [authenticatedUser] : undefined,
            });
            console.log(
                `[analyze] Saved analysis to database for ${repoUrl}${authenticatedUser ? ` by ${authenticatedUser}` : ""}`,
            );
        } catch (dbError: any) {
            console.error(
                `[analyze] Database save failed: ${dbError?.message}`,
            );
            // Don't fail the request if database save fails
        }

        return { status: 200, body: result };
    } catch (e: any) {
        const msg = e?.message || String(e);
        const stack = e?.stack;
        console.error("analyze-template error", msg, stack);

        const isLocal = process.env.NODE_ENV !== "production";
        const diagnostic = isLocal
            ? { stack, fileCount: enriched.length, repoUrl, ruleSet }
            : {};
        return {
            status: 500,
            body: {
                error: "Analyzer execution failed",
                details: msg,
                ...diagnostic,
            },
        };
    }
}

async function handleBatchAnalysis(
    req: Request,
    repos: string[],
    ruleSet: string,
    azureDeveloperCliEnabled?: boolean,
    aiDeprecationCheckEnabled?: boolean,
    archiveOverride?: boolean,
    categoriesParam?: string[],
): Promise<BatchAnalyzeResult> {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const results: BatchAnalyzeResult["results"] = [];

    console.log(
        `[${batchId}] Starting batch analysis of ${repos.length} repositories`,
    );

    // Process repos sequentially to avoid overwhelming GitHub API and analyzer
    for (let i = 0; i < repos.length; i++) {
        const repoUrl = repos[i];
        console.log(
            `[${batchId}] Analyzing ${i + 1}/${repos.length}: ${repoUrl}`,
        );

        try {
            const response = await analyzeSingleRepository(
                req,
                repoUrl,
                ruleSet,
                azureDeveloperCliEnabled,
                aiDeprecationCheckEnabled,
                archiveOverride,
                categoriesParam,
            );

            if (response.status === 200) {
                results.push({
                    repoUrl,
                    status: "success",
                    result: response.body,
                });
            } else {
                results.push({
                    repoUrl,
                    status: "error",
                    error: response.body?.error || `HTTP ${response.status}`,
                });
            }
        } catch (error: any) {
            console.error(
                `[${batchId}] Error analyzing ${repoUrl}:`,
                error?.message,
            );
            results.push({
                repoUrl,
                status: "error",
                error: error?.message || String(error),
            });
        }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    console.log(
        `[${batchId}] Batch complete: ${successCount}/${repos.length} successful`,
    );

    return {
        batchId,
        total: repos.length,
        results,
    };
}

function extractRepoInfo(url: string): { owner: string; repo: string } {
    const m = url.match(/github\.com\/([^/]+)\/([^/]+)(\.git)?/i);
    if (!m) throw new Error("Invalid GitHub URL");
    return { owner: m[1], repo: m[2] };
}

function createGitHubClient(defaultToken?: string) {
    return async function gh(
        path: string,
        overrideToken?: string,
    ): Promise<any> {
        const base = "https://api.github.com";
        const url = base + path;
        const token = overrideToken || defaultToken;
        const res = await fetch(url, {
            headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": "template-doctor-analyzer",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(
                "GitHub request failed " +
                    res.status +
                    " " +
                    path +
                    " " +
                    text.slice(0, 200),
            );
        }
        return res.json();
    };
}

async function listAllFilesFetch(
    gh: (p: string, token?: string) => Promise<any>,
    owner: string,
    repo: string,
    ref: string,
    path: string = "",
    accessToken?: string,
): Promise<GitHubFile[]> {
    const apiPath =
        `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`.replace(
            /%2F/g,
            "/",
        );
    const data = await gh(
        apiPath + (ref ? `?ref=${encodeURIComponent(ref)}` : ""),
        accessToken,
    );
    const entries = Array.isArray(data) ? data : [data];
    let files: GitHubFile[] = [];
    for (const entry of entries) {
        if (entry.type === "file") {
            files.push({ path: entry.path, sha: entry.sha });
        } else if (entry.type === "dir") {
            const sub = await listAllFilesFetch(
                gh,
                owner,
                repo,
                ref,
                entry.path,
                accessToken,
            );
            files = files.concat(sub);
        }
    }
    return files;
}

async function getFileContentFetch(
    gh: (p: string, token?: string) => Promise<any>,
    owner: string,
    repo: string,
    path: string,
    ref: string,
    accessToken?: string,
): Promise<string> {
    const apiPath =
        `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`.replace(
            /%2F/g,
            "/",
        );
    const data = await gh(
        apiPath + (ref ? `?ref=${encodeURIComponent(ref)}` : ""),
        accessToken,
    );
    if (data && data.type === "file" && data.content) {
        try {
            return Buffer.from(data.content, "base64").toString();
        } catch {}
    }
    throw new Error("Unable to get content for " + path);
}
