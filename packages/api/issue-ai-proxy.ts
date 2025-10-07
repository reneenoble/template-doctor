import { wrapHttp } from "./shared/http";
import type { HttpRequest } from "@azure/functions";

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

interface IssueRequestBody {
    ruleId: string;
    severity?: string;
    message: string;
    errorDetail?: string;
    draftTitle?: string;
    draftBody: string;
}

const CACHE_TTL_MS = parseInt(
    process.env.ISSUE_AI_CACHE_TTL_MS || "300000",
    10,
);
const MAX_CACHE_ENTRIES = parseInt(process.env.ISSUE_AI_CACHE_MAX || "500", 10);
const cache = new Map<
    string,
    { body: string; title: string; expires: number }
>();
function cacheSet(
    key: string,
    value: { body: string; title: string; expires: number },
) {
    if (cache.size >= MAX_CACHE_ENTRIES) {
        const first = cache.keys().next().value;
        if (first) cache.delete(first);
    }
    cache.set(key, value);
}
function cacheGet(key: string) {
    const v = cache.get(key);
    if (!v) return null;
    if (Date.now() > v.expires) {
        cache.delete(key);
        return null;
    }
    return v;
}

const RATE_LIMIT_WINDOW_MS = parseInt(
    process.env.ISSUE_AI_RATE_LIMIT_WINDOW_MS || "60000",
    10,
);
const RATE_LIMIT_MAX = parseInt(
    process.env.ISSUE_AI_RATE_LIMIT_MAX || "20",
    10,
);
const buckets = new Map<string, { count: number; reset: number }>();
function rateLimitKey(req: HttpRequest) {
    const h = req.headers as any;
    const repo = h["x-repo"] || h["x-template-repo"] || "";
    const ip =
        h["x-forwarded-for"] ||
        h["x-client-ip"] ||
        h["x-original-forwarded-for"] ||
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
    return { limited: false };
}

function hashString(str: string) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
}

function systemPrompt() {
    return "You are an assistant that rewrites template repository compliance issues into HIGH QUALITY GitHub issue markdown. Preserve HTML comment metadata blocks. Keep acceptance criteria list items; clarify wording briefly if unclear.";
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
        const txt = await safeText(resp);
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
        const txt = await safeText(resp);
        throw new Error(`Azure OpenAI error ${resp.status}: ${txt}`);
    }
    return resp.json();
}
async function withRetries(
    tag: string,
    fn: () => Promise<any>,
    log: (msg: string) => void,
) {
    let attempt = 0,
        delay = 500;
    while (true) {
        attempt++;
        try {
            return await fn();
        } catch (e: any) {
            const msg = e.message || "";
            if (
                attempt >= 3 ||
                !(
                    msg.includes("429") ||
                    msg.includes(" 5") ||
                    /rate/i.test(msg)
                )
            ) {
                throw e;
            }
            log(
                `[retry] ${tag} attempt ${attempt} failed: ${msg}; backing off ${delay}ms`,
            );
            await sleep(delay);
            delay *= 2;
        }
    }
}
function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}
async function safeText(resp: Response) {
    try {
        return await resp.text();
    } catch {
        return "";
    }
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

export const handler = wrapHttp(async (req: HttpRequest, ctx) => {
    if (req.method !== "POST")
        return { status: 405, body: { error: "Method not allowed" } };
    let body: IssueRequestBody;
    try {
        body = req.body as any;
    } catch {
        return { status: 400, body: { error: "Invalid JSON body" } };
    }
    if (!body || typeof body !== "object")
        return { status: 400, body: { error: "Invalid JSON body" } };
    const { ruleId, severity, message, errorDetail, draftTitle, draftBody } =
        body;
    if (!ruleId || !message || !draftBody)
        return {
            status: 400,
            body: { error: "ruleId, message, and draftBody are required." },
        };

    // Provider validation
    if (PROVIDER === "azure") {
        if (!AZURE_OPENAI_ENDPOINT)
            return {
                status: 400,
                body: { error: "AZURE_OPENAI_ENDPOINT not set" },
            };
        if (!AZURE_OPENAI_DEPLOYMENT)
            return {
                status: 400,
                body: { error: "AZURE_OPENAI_DEPLOYMENT not set" },
            };
        if (!AZURE_OPENAI_API_KEY)
            return {
                status: 400,
                body: { error: "AZURE_OPENAI_API_KEY not set" },
            };
    } else {
        const token =
            process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN;
        if (!token)
            return {
                status: 400,
                body: {
                    error: "Missing GITHUB_MODELS_TOKEN (or GITHUB_TOKEN)",
                },
            };
    }

    // Rate limit
    const rlKey = rateLimitKey(req);
    const rl = checkRateLimit(rlKey);
    if (rl.limited)
        return {
            status: 429,
            body: {
                error: "Rate limit exceeded",
                retryInSeconds: rl.retryIn
                    ? Math.ceil(rl.retryIn / 1000)
                    : undefined,
            },
        };

    // Cache
    const cacheKey = `${PROVIDER}:${ruleId}:${hashString(draftBody)}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
        return {
            status: 200,
            body: {
                provider: PROVIDER,
                model:
                    PROVIDER === "azure"
                        ? AZURE_OPENAI_DEPLOYMENT
                        : DEFAULT_MODEL,
                title: draftTitle || message,
                body: cached.body,
                usage: { cached: true },
                _meta: { rewritten: cached.body !== draftBody, cache: true },
            },
        };
    }

    const sys = systemPrompt();
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
            const azureResp = await withRetries(
                "azure",
                () =>
                    callAzureOpenAI({
                        endpoint: AZURE_OPENAI_ENDPOINT!,
                        deployment: AZURE_OPENAI_DEPLOYMENT!,
                        apiVersion: AZURE_OPENAI_API_VERSION,
                        apiKey: AZURE_OPENAI_API_KEY!,
                        body: {
                            messages: [
                                { role: "system", content: sys },
                                { role: "user", content: userContent },
                            ],
                            temperature: 0.25,
                            max_tokens: 900,
                        },
                    }),
                (m) => ctx.log.warn(m),
            );
            aiText = extractFirstMessage(azureResp) || draftBody;
            usage = azureResp.usage;
        } else {
            const token =
                process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN!;
            const completion = await withRetries(
                "github",
                () =>
                    callGitHubModels(token, {
                        model: DEFAULT_MODEL,
                        messages: [
                            { role: "system", content: sys },
                            { role: "user", content: userContent },
                        ],
                        temperature: 0.25,
                        max_tokens: 900,
                    }),
                (m) => ctx.log.warn(m),
            );
            aiText = extractFirstMessage(completion) || draftBody;
            usage = completion.usage;
        }
    } catch (e: any) {
        return {
            status: 502,
            body: {
                error: `${PROVIDER} model inference failed`,
                detail: e.message,
            },
        };
    }

    cacheSet(cacheKey, {
        body: aiText,
        title: draftTitle || message,
        expires: Date.now() + CACHE_TTL_MS,
    });
    return {
        status: 200,
        body: {
            provider: PROVIDER,
            model:
                PROVIDER === "azure" ? AZURE_OPENAI_DEPLOYMENT : DEFAULT_MODEL,
            title: draftTitle || message,
            body: aiText,
            usage,
            _meta: { rewritten: aiText !== draftBody },
        },
    };
});

export default handler;
