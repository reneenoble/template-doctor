import express, { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { Octokit } from "@octokit/rest";

const router = express.Router();

// ============================================================================
// BATCH SCAN ENDPOINTS
// ============================================================================

interface BatchScanItem {
    repo: string;
    status: "pending" | "in-progress" | "done" | "error" | "cancelled";
    error?: string;
    result?: any;
}

// In-memory store (replace with durable storage later)
const batches: Record<
    string,
    { items: BatchScanItem[]; created: string; mode?: string }
> = {};

// Import analyzer function from analyze route
async function runSingleAnalysis(
    req: Request,
    repoUrl: string,
    ruleSet: string = "azd",
): Promise<{ status: number; body: any }> {
    // This will be imported from analyze.ts - for now, call the endpoint internally
    const analyzePath = "./analyze.js";
    try {
        const { analyzeSingleRepository } = await import(analyzePath);
        return await analyzeSingleRepository(req, repoUrl, ruleSet);
    } catch (e: any) {
        console.error("Failed to import analyzer:", e.message);
        return {
            status: 500,
            body: { error: "Analyzer unavailable", details: e.message },
        };
    }
}

// POST /api/v4/batch-scan-start
// Starts a batch scan of multiple repositories
router.post(
    "/batch-scan-start",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { repos, mode } = req.body || {};

            if (!Array.isArray(repos) || repos.length === 0) {
                return res.status(400).json({ error: "repos[] required" });
            }

            const sanitized = Array.from(
                new Set(
                    repos.filter(
                        (r) => typeof r === "string" && r.includes("/"),
                    ),
                ),
            ).slice(0, 50);

            if (sanitized.length === 0) {
                return res
                    .status(400)
                    .json({ error: "No valid repo slugs provided" });
            }

            const batchId = "b_" + uuidv4();
            batches[batchId] = {
                created: new Date().toISOString(),
                mode,
                items: sanitized.map((r) => ({ repo: r, status: "pending" })),
            };

            // Kick off real async processing (not simulation)
            processAsync(batchId, req);

            return res.status(202).json({
                batchId,
                acceptedCount: sanitized.length,
            });
        } catch (err) {
            next(err);
        }
    },
);

async function processAsync(batchId: string, req: Request) {
    const batch = batches[batchId];
    if (!batch) return;

    for (const item of batch.items) {
        item.status = "in-progress";

        try {
            // Run REAL analysis (not simulation)
            const analysisResult = await runSingleAnalysis(
                req,
                item.repo,
                batch.mode || "azd",
            );

            if (analysisResult.status === 200) {
                item.status = "done";
                item.result = analysisResult.body;
            } else {
                item.status = "error";
                item.error = analysisResult.body?.error || "Analysis failed";
            }
        } catch (err: any) {
            item.status = "error";
            item.error = err.message || "Unexpected error during analysis";
        }
    }
    console.log(`Batch ${batchId} processing complete.`);
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// GET /api/v4/batch-scan-status
// Gets the status of a batch scan
router.get(
    "/batch-scan-status",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const batchId = req.query.batchId as string;

            if (!batchId) {
                return res.status(400).json({ error: "batchId required" });
            }

            const batch = batches[batchId];
            if (!batch) {
                return res.status(404).json({ error: "Not found" });
            }

            const completed = batch.items.filter(
                (i) =>
                    i.status === "done" ||
                    i.status === "error" ||
                    i.status === "cancelled",
            ).length;

            return res.status(200).json({
                batchId,
                created: batch.created,
                mode: batch.mode,
                total: batch.items.length,
                completed,
                items: batch.items,
            });
        } catch (err) {
            next(err);
        }
    },
);

// ============================================================================
// REPO FORK ENDPOINT
// ============================================================================

// POST /api/v4/repo-fork
// Forks a repository into authenticated user's namespace
router.post(
    "/repo-fork",
    async (req: Request, res: Response, next: NextFunction) => {
        const requestId = uuidv4();

        try {
            const token = process.env.GH_WORKFLOW_TOKEN;
            if (!token) {
                return res.status(500).json({
                    error: "Server misconfiguration: missing GH_WORKFLOW_TOKEN",
                    requestId,
                });
            }

            const {
                sourceOwner,
                sourceRepo,
                targetOwner,
                waitForReady = true,
            } = req.body || {};

            if (!sourceOwner || !sourceRepo) {
                return res.status(400).json({
                    error: "Missing required: sourceOwner, sourceRepo",
                    requestId,
                });
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
                console.log(
                    "Failed to identify token user:",
                    err instanceof Error ? err.message : err,
                );
            }

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
                return res.status(200).json({
                    forkOwner,
                    repo: sourceRepo,
                    htmlUrl: existing.data.html_url,
                    ready: true,
                    attemptedCreate: false,
                    requestId,
                });
            } catch {
                // Fork doesn't exist, continue to create
            }

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
                // Check for SAML SSO error
                const isSamlError =
                    err.status === 403 &&
                    (err.message?.includes("SAML") ||
                        err.message?.includes("SSO"));

                if (isSamlError) {
                    console.log("Fork blocked by SAML SSO requirement");
                    return res.status(403).json({
                        error: "SAML SSO authorization required to fork this repository",
                        samlRequired: true,
                        documentationUrl:
                            err.response?.headers?.["x-github-sso"] ||
                            undefined,
                        requestId,
                    });
                }

                console.log("Fork creation failed:", err.message);
                return res.status(502).json({
                    error: "Failed to initiate fork",
                    details: err.message,
                    requestId,
                });
            }

            if (!waitForReady) {
                return res.status(202).json({
                    forkOwner,
                    repo: sourceRepo,
                    htmlUrl: forkHtml,
                    ready: false,
                    attemptedCreate: true,
                    requestId,
                });
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
                } catch {
                    // Continue polling
                }
                await delay(1500);
            }

            return res.status(201).json({
                forkOwner,
                repo: sourceRepo,
                htmlUrl: forkHtml,
                ready,
                attemptedCreate: true,
                requestId,
            });
        } catch (err) {
            next(err);
        }
    },
);

// ============================================================================
// ISSUE AI PROXY ENDPOINT
// ============================================================================

const DEFAULT_MODEL = process.env.ISSUE_AI_MODEL || "gpt-4o-mini";
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT =
    process.env.AZURE_OPENAI_DEPLOYMENT ||
    process.env.AZURE_OPENAI_MODEL ||
    DEFAULT_MODEL;
const AZURE_OPENAI_API_VERSION =
    process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const PROVIDER =
    (process.env.ISSUE_AI_PROVIDER || "").toLowerCase() ||
    (AZURE_OPENAI_ENDPOINT ? "azure" : "github");

// Simple in-memory cache
const CACHE_TTL_MS = parseInt(
    process.env.ISSUE_AI_CACHE_TTL_MS || "300000",
    10,
);
const MAX_CACHE_ENTRIES = parseInt(process.env.ISSUE_AI_CACHE_MAX || "500", 10);
const aiCache = new Map<
    string,
    { body: string; title: string; expires: number }
>();

function cacheSet(
    key: string,
    value: { body: string; title: string; expires: number },
) {
    if (aiCache.size >= MAX_CACHE_ENTRIES) {
        const first = aiCache.keys().next().value;
        if (first) aiCache.delete(first);
    }
    aiCache.set(key, value);
}

function cacheGet(key: string) {
    const v = aiCache.get(key);
    if (!v) return null;
    if (Date.now() > v.expires) {
        aiCache.delete(key);
        return null;
    }
    return v;
}

// Rate limiting
const RATE_LIMIT_WINDOW_MS = parseInt(
    process.env.ISSUE_AI_RATE_LIMIT_WINDOW_MS || "60000",
    10,
);
const RATE_LIMIT_MAX = parseInt(
    process.env.ISSUE_AI_RATE_LIMIT_MAX || "20",
    10,
);
const buckets = new Map<string, { count: number; reset: number }>();

function rateLimitKey(req: Request) {
    const repo = req.headers["x-repo"] || req.headers["x-template-repo"] || "";
    const ip =
        req.headers["x-forwarded-for"] ||
        req.headers["x-client-ip"] ||
        "unknown";
    return repo ? `repo:${repo}` : `ip:${ip}`;
}

function checkRateLimit(key: string) {
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now > b.reset) {
        b = { count: 0, reset: now + RATE_LIMIT_WINDOW_MS };
        buckets.set(key, b);
    }
    b.count++;
    if (b.count > RATE_LIMIT_MAX) {
        return { limited: true, retryIn: b.reset - now };
    }
    return { limited: false, retryIn: 0 };
}

function hashString(str: string) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
}

async function callGitHubModels(token: string, payload: any) {
    const resp = await fetch(
        "https://models.inference.ai.github.com/v1/chat/completions",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-GitHub-Api-Version": "2024-07-01",
            },
            body: JSON.stringify(payload),
        },
    );
    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`GitHub Models API error ${resp.status}: ${txt}`);
    }
    return resp.json();
}

async function callAzureOpenAI(args: {
    endpoint: string;
    deployment: string;
    apiVersion: string;
    apiKey: string;
    body: any;
}) {
    const { endpoint, deployment, apiVersion, apiKey, body } = args;
    const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
    const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": apiKey },
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Azure OpenAI error ${resp.status}: ${txt}`);
    }
    return resp.json();
}

function extractFirstMessage(json: any) {
    try {
        if (json && Array.isArray(json.choices) && json.choices.length) {
            const c = json.choices[0];
            if (c.message && typeof c.message.content === "string") {
                return c.message.content.trim();
            }
        }
    } catch {}
    return null;
}

// POST /api/v4/issue-ai-proxy
// AI-enhanced issue text rewriting
router.post(
    "/issue-ai-proxy",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const {
                ruleId,
                severity,
                message,
                errorDetail,
                draftTitle,
                draftBody,
            } = req.body || {};

            if (!ruleId || !message || !draftBody) {
                return res.status(400).json({
                    error: "ruleId, message, and draftBody are required.",
                });
            }

            // Provider validation
            if (PROVIDER === "azure") {
                if (!AZURE_OPENAI_ENDPOINT)
                    return res
                        .status(400)
                        .json({ error: "AZURE_OPENAI_ENDPOINT not set" });
                if (!AZURE_OPENAI_DEPLOYMENT)
                    return res
                        .status(400)
                        .json({ error: "AZURE_OPENAI_DEPLOYMENT not set" });
                if (!AZURE_OPENAI_API_KEY)
                    return res
                        .status(400)
                        .json({ error: "AZURE_OPENAI_API_KEY not set" });
            } else {
                const token =
                    process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN;
                if (!token)
                    return res.status(400).json({
                        error: "Missing GITHUB_MODELS_TOKEN (or GITHUB_TOKEN)",
                    });
            }

            // Rate limit
            const rlKey = rateLimitKey(req);
            const rl = checkRateLimit(rlKey);
            if (rl.limited) {
                return res.status(429).json({
                    error: "Rate limit exceeded",
                    retryInSeconds: rl.retryIn
                        ? Math.ceil(rl.retryIn / 1000)
                        : undefined,
                });
            }

            // Check cache
            const cacheKey = `${PROVIDER}:${ruleId}:${hashString(draftBody)}`;
            const cached = cacheGet(cacheKey);
            if (cached) {
                return res.status(200).json({
                    provider: PROVIDER,
                    model:
                        PROVIDER === "azure"
                            ? AZURE_OPENAI_DEPLOYMENT
                            : DEFAULT_MODEL,
                    title: draftTitle || message,
                    body: cached.body,
                    usage: { cached: true },
                    _meta: {
                        rewritten: cached.body !== draftBody,
                        cache: true,
                    },
                });
            }

            // Build prompt
            const systemPrompt =
                "You are an assistant that rewrites template repository compliance issues into HIGH QUALITY GitHub issue markdown. Preserve HTML comment metadata blocks. Keep acceptance criteria list items; clarify wording briefly if unclear.";
            const userContent = [
                `Rule ID: ${ruleId}`,
                `Severity: ${severity || "unknown"}`,
                `Message: ${message}`,
                errorDetail ? `Error Detail: ${errorDetail}` : null,
                "---",
                `Draft Title:\n${draftTitle || "(none)"}`,
                `Draft Body:\n${draftBody}`,
                "---",
                "Rewrite the draft body if you can make it clearer. Maintain markdown headings. Keep existing acceptance criteria list items unchanged unless unclear.",
            ]
                .filter(Boolean)
                .join("\n");

            let aiText = draftBody;
            let usage: any;

            try {
                if (PROVIDER === "azure") {
                    const azureResp = await callAzureOpenAI({
                        endpoint: AZURE_OPENAI_ENDPOINT!,
                        deployment: AZURE_OPENAI_DEPLOYMENT!,
                        apiVersion: AZURE_OPENAI_API_VERSION,
                        apiKey: AZURE_OPENAI_API_KEY!,
                        body: {
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: userContent },
                            ],
                            temperature: 0.25,
                            max_tokens: 900,
                        },
                    });
                    aiText = extractFirstMessage(azureResp) || draftBody;
                    usage = azureResp.usage;
                } else {
                    const token =
                        process.env.GITHUB_MODELS_TOKEN ||
                        process.env.GITHUB_TOKEN!;
                    const completion = await callGitHubModels(token, {
                        model: DEFAULT_MODEL,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userContent },
                        ],
                        temperature: 0.25,
                        max_tokens: 900,
                    });
                    aiText = extractFirstMessage(completion) || draftBody;
                    usage = completion.usage;
                }
            } catch (e: any) {
                return res.status(502).json({
                    error: `${PROVIDER} model inference failed`,
                    detail: e.message,
                });
            }

            cacheSet(cacheKey, {
                body: aiText,
                title: draftTitle || message,
                expires: Date.now() + CACHE_TTL_MS,
            });

            return res.status(200).json({
                provider: PROVIDER,
                model:
                    PROVIDER === "azure"
                        ? AZURE_OPENAI_DEPLOYMENT
                        : DEFAULT_MODEL,
                title: draftTitle || message,
                body: aiText,
                usage,
                _meta: { rewritten: aiText !== draftBody },
            });
        } catch (err) {
            next(err);
        }
    },
);

// ============================================================================
// SETUP ENDPOINT - GitHub Gist Persistence
// ============================================================================

const CONFIG_GIST_ID = process.env.CONFIG_GIST_ID || ""; // Set in .env
const CONFIG_GIST_FILENAME = "template-doctor-config.csv";

interface ConfigOverride {
    key: string;
    value: string;
    updatedBy: string;
    updatedAt: string;
}

// GET /api/v4/setup
// Load current configuration overrides from GitHub Gist
router.get(
    "/setup",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const overrides = await loadOverridesFromGist();

            return res.status(200).json({
                overrides: Object.fromEntries(
                    overrides.map((o) => [o.key, o.value]),
                ),
                metadata: overrides,
                count: overrides.length,
                source: CONFIG_GIST_ID
                    ? `gist:${CONFIG_GIST_ID}`
                    : "no gist configured",
            });
        } catch (err: any) {
            if (err.status === 404 || !CONFIG_GIST_ID) {
                return res.status(200).json({
                    overrides: {},
                    metadata: [],
                    count: 0,
                    message: "No configuration overrides found",
                    hint: CONFIG_GIST_ID
                        ? "Gist exists but file not found"
                        : "Set CONFIG_GIST_ID environment variable",
                });
            }
            next(err);
        }
    },
);

// POST /api/v4/setup
// Save configuration overrides to GitHub Gist with authorization
router.post(
    "/setup",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { overrides, user } = req.body || {};

            // Authorization check
            const allowedUsers = (process.env.SETUP_ALLOWED_USERS || "")
                .split(",")
                .map((u) => u.trim())
                .filter(Boolean);

            if (!user || !allowedUsers.includes(user)) {
                return res.status(403).json({
                    error: "Unauthorized: user not in SETUP_ALLOWED_USERS",
                    requestedUser: user,
                });
            }

            if (!overrides || typeof overrides !== "object") {
                return res.status(400).json({
                    error: "Missing required field: overrides (object)",
                });
            }

            if (!CONFIG_GIST_ID) {
                return res.status(500).json({
                    error: "CONFIG_GIST_ID not configured",
                    hint: "Set CONFIG_GIST_ID environment variable to a GitHub Gist ID",
                });
            }

            // Load existing overrides
            let existing: ConfigOverride[] = [];
            try {
                existing = await loadOverridesFromGist();
            } catch (err: any) {
                if (err.status !== 404) throw err;
            }

            // Merge with new overrides
            const timestamp = new Date().toISOString();
            const existingMap = new Map(existing.map((o) => [o.key, o]));

            for (const [key, value] of Object.entries(overrides)) {
                if (value === null || value === undefined) {
                    // Delete override
                    existingMap.delete(key);
                } else {
                    // Update or add override
                    existingMap.set(key, {
                        key,
                        value: String(value),
                        updatedBy: user,
                        updatedAt: timestamp,
                    });
                }
            }

            const updated = Array.from(existingMap.values());

            // Save to Gist
            const gistUrl = await saveOverridesToGist(
                updated,
                user,
                Object.keys(overrides),
            );

            return res.status(200).json({
                ok: true,
                message: "Configuration overrides saved to Gist",
                applied: updated.length,
                timestamp,
                gist: {
                    id: CONFIG_GIST_ID,
                    url: gistUrl,
                    file: CONFIG_GIST_FILENAME,
                },
            });
        } catch (err) {
            next(err);
        }
    },
);

// GET /api/v4/setup/check-access
// Check if a user has access to the setup endpoint
router.get("/setup/check-access", (req: Request, res: Response) => {
    const username = req.query.username as string;

    if (!username) {
        return res.status(400).json({
            error: "Missing required query parameter: username",
        });
    }

    const allowedUsers = (process.env.SETUP_ALLOWED_USERS || "")
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean);

    const hasAccess = allowedUsers.includes(username);

    return res.status(200).json({
        hasAccess,
        username,
    });
});

// Helper: Load overrides from GitHub Gist
async function loadOverridesFromGist(): Promise<ConfigOverride[]> {
    if (!CONFIG_GIST_ID) {
        throw new Error("CONFIG_GIST_ID not configured");
    }

    const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (!githubToken) {
        throw new Error("GitHub token not configured");
    }

    const octokit = new Octokit({ auth: githubToken });

    const { data: gist } = await octokit.gists.get({
        gist_id: CONFIG_GIST_ID,
    });

    const file = gist.files?.[CONFIG_GIST_FILENAME];
    if (!file || !file.content) {
        return [];
    }

    const lines = file.content.split("\n").filter((l) => l.trim());

    if (lines.length === 0) return [];

    // Skip header if present
    const dataLines = lines[0].startsWith("key,") ? lines.slice(1) : lines;

    return dataLines.map((line) => {
        const [key, value, updatedBy, updatedAt] = parseCsvLine(line);
        return { key, value, updatedBy, updatedAt };
    });
}

// Helper: Save overrides to GitHub Gist
async function saveOverridesToGist(
    overrides: ConfigOverride[],
    user: string,
    changedKeys: string[],
): Promise<string> {
    if (!CONFIG_GIST_ID) {
        throw new Error("CONFIG_GIST_ID not configured");
    }

    const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (!githubToken) {
        throw new Error("GitHub token not configured");
    }

    const octokit = new Octokit({ auth: githubToken });

    const header = "key,value,updated_by,updated_at";
    const rows = overrides.map(
        (o) =>
            `${escapeCsv(o.key)},${escapeCsv(o.value)},${escapeCsv(o.updatedBy)},${escapeCsv(o.updatedAt)}`,
    );

    const content = [header, ...rows].join("\n") + "\n";

    const description = `Template Doctor config updated by ${user} (${changedKeys.join(", ")})`;

    const { data: gist } = await octokit.gists.update({
        gist_id: CONFIG_GIST_ID,
        description,
        files: {
            [CONFIG_GIST_FILENAME]: {
                content,
            },
        },
    });

    console.log(`Config saved to Gist ${CONFIG_GIST_ID}: ${description}`);

    return gist.html_url || `https://gist.github.com/${CONFIG_GIST_ID}`;
}

// Helper: Parse CSV line handling quotes and escapes
function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            result.push(current);
            current = "";
        } else {
            current += char;
        }
    }

    result.push(current);
    return result;
}

// Helper: Escape CSV value
function escapeCsv(value: string): string {
    if (!value) return '""';

    const needsQuotes =
        value.includes(",") || value.includes('"') || value.includes("\n");

    if (needsQuotes) {
        return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
}

export { router as miscRouter };
