// Azure Function: issue-ai-proxy
// Purpose: Accept a draft issue template payload and enrich it using either:
//   - Azure AI Foundry (Azure OpenAI) Chat Completions (preferred for enterprise)
//   - GitHub Models (fallback / dev)
// Provider selection order:
//   1. If ISSUE_AI_PROVIDER == 'azure' OR AZURE_OPENAI_ENDPOINT is set -> use Azure
//   2. Else use GitHub Models (requires GITHUB_MODELS_TOKEN or GITHUB_TOKEN)
// Security: Do NOT expose tokens to client. Prefer Managed Identity + Azure role assignments in production.

/**
 * Expected POST body shape:
 * {
 *   ruleId: string,
 *   severity: string,
 *   message: string,
 *   errorDetail?: string,
 *   draftTitle: string,
 *   draftBody: string
 * }
 */

// Generic model identifier (used for GitHub Models OR documented Azure deployment name)
const DEFAULT_MODEL = process.env.ISSUE_AI_MODEL || 'gpt-4o-mini';

// Azure configuration (if using Azure AI Foundry / Azure OpenAI)
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT; // e.g. https://my-resource.openai.azure.com
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || process.env.AZURE_OPENAI_MODEL || DEFAULT_MODEL; // deployment name
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
// If using API key auth (simplest local dev). For production prefer Managed Identity & azure-identity.
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;

const PROVIDER = (process.env.ISSUE_AI_PROVIDER || '').toLowerCase() ||
  (AZURE_OPENAI_ENDPOINT ? 'azure' : 'github');

// ---- In-memory caching & rate limiting (ephemeral) ----
// NOTE: For multi-instance or durable scaling, replace with Redis/Table storage.
const CACHE_TTL_MS = parseInt(process.env.ISSUE_AI_CACHE_TTL_MS || '300000', 10); // 5 min default
const MAX_CACHE_ENTRIES = parseInt(process.env.ISSUE_AI_CACHE_MAX || '500', 10);
const cache = new Map(); // key -> { body, title, expires }

// Simple LRU eviction (approx) when exceeding size
function cacheSet(key, value) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // delete oldest by insertion order
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, value);
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry;
}

// Rate limiting (token bucket per key)
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.ISSUE_AI_RATE_LIMIT_WINDOW_MS || '60000', 10); // 1 min
const RATE_LIMIT_MAX = parseInt(process.env.ISSUE_AI_RATE_LIMIT_MAX || '20', 10); // 20 requests per window
const buckets = new Map(); // key -> { count, reset }

function rateLimitKey(req) {
  // Prefer repository context if provided in headers; fallback to IP
  const repo = (req.headers && (req.headers['x-repo'] || req.headers['x-template-repo'])) || '';
  const ip = (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-client-ip'] || req.headers['x-original-forwarded-for'])) || (req.socket && req.socket.remoteAddress) || 'unknown';
  return repo ? `repo:${repo}` : `ip:${ip}`;
}

function checkRateLimit(key) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    bucket = { count: 0, reset: now + RATE_LIMIT_WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX) {
    const retryIn = bucket.reset - now;
    return { limited: true, retryIn };
  }
  return { limited: false };
}

// Hash helper (simple FNV-1a) for caching
function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

module.exports = async function (context, req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    context.res = {
      status: 204,
      headers: corsHeaders(),
    };
    return;
  }

  // Basic provider validation
  if (PROVIDER === 'azure') {
    if (!AZURE_OPENAI_ENDPOINT) {
      return sendError(context, 400, 'AZURE_OPENAI_ENDPOINT not set');
    }
    if (!AZURE_OPENAI_DEPLOYMENT) {
      return sendError(context, 400, 'AZURE_OPENAI_DEPLOYMENT not set');
    }
    if (!AZURE_OPENAI_API_KEY) {
      // NOTE: Could attempt MSI path here; keeping simple for now.
      return sendError(context, 400, 'AZURE_OPENAI_API_KEY not set (or implement Managed Identity)');
    }
  } else { // GitHub
    const token = process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) {
      return sendError(context, 400, 'Missing GITHUB_MODELS_TOKEN (or GITHUB_TOKEN) for GitHub provider.');
    }
  }

  if (!req.body || typeof req.body !== 'object') {
    context.res = {
      status: 400,
      headers: corsHeaders(),
      body: { error: 'Invalid JSON body.' },
    };
    return;
  }

  const { ruleId, severity, message, errorDetail, draftTitle, draftBody } = req.body;
  if (!ruleId || !message || !draftBody) {
    context.res = {
      status: 400,
      headers: corsHeaders(),
      body: { error: 'ruleId, message, and draftBody are required.' },
    };
    return;
  }

  // Rate limiting
  const rlKey = rateLimitKey(req);
  const rl = checkRateLimit(rlKey);
  if (rl.limited) {
    return sendError(context, 429, 'Rate limit exceeded', `Retry in ${Math.ceil(rl.retryIn/1000)}s`);
  }

  // Cache lookup
  const cacheKey = `${PROVIDER}:${ruleId}:${hashString(draftBody)}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    context.log(`cache hit for ${cacheKey}`);
    context.res = {
      status: 200,
      headers: corsHeaders(),
      body: {
        provider: PROVIDER,
        model: PROVIDER === 'azure' ? AZURE_OPENAI_DEPLOYMENT : DEFAULT_MODEL,
        title: draftTitle || message,
        body: cached.body,
        usage: { cached: true },
        _meta: { rewritten: cached.body !== draftBody, cache: true },
      },
    };
    return;
  }

  const systemPrompt = `You are an assistant that rewrites template repository compliance issues into HIGH QUALITY GitHub issue markdown. Preserve hidden metadata blocks (HTML comments) if present. Keep acceptance criteria as task list items. Add a concise "Rationale" section if missing. Do NOT fabricate repository-specific data.`;

  const userContent = [
    `Rule ID: ${ruleId}`,
    `Severity: ${severity || 'unknown'}`,
    `Message: ${message}`,
    errorDetail ? `Error Detail: ${errorDetail}` : null,
    `---`,
    `Draft Title:\n${draftTitle || '(none)'}`,
    `Draft Body:\n${draftBody}`,
    `---`,
    'Rewrite the draft body if you can make it clearer. Maintain markdown headings. Keep existing acceptance criteria list items unchanged unless they are unclear, then clarify wording briefly.'
  ].filter(Boolean).join('\n');

  let aiText = draftBody;
  let usage;
  if (PROVIDER === 'azure') {
    try {
      const azureResp = await withRetries(context, 'azure', async () => callAzureOpenAI({
        endpoint: AZURE_OPENAI_ENDPOINT,
        deployment: AZURE_OPENAI_DEPLOYMENT,
        apiVersion: AZURE_OPENAI_API_VERSION,
        apiKey: AZURE_OPENAI_API_KEY,
        body: {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          temperature: 0.25,
          max_tokens: 900,
        },
      }));
      aiText = extractAzureFirstMessage(azureResp) || draftBody;
      usage = azureResp.usage;
    } catch (e) {
      context.log.error('Azure OpenAI call failed', e);
      return sendError(context, 502, 'Azure model inference failed', e.message);
    }
  } else {
    const token = process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN; // re-evaluate after validation
    try {
      const completion = await withRetries(context, 'github', async () => callGitHubModels(token, {
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.25,
        max_tokens: 900,
      }));
      aiText = extractFirstMessage(completion) || draftBody;
      usage = completion && completion.usage;
    } catch (e) {
      context.log.error('GitHub Models call failed', e);
      return sendError(context, 502, 'GitHub model inference failed', e.message);
    }
  }

  context.res = {
    status: 200,
    headers: corsHeaders(),
    body: {
      provider: PROVIDER,
      model: PROVIDER === 'azure' ? AZURE_OPENAI_DEPLOYMENT : DEFAULT_MODEL,
      title: draftTitle || message,
      body: aiText,
      usage,
      _meta: { rewritten: aiText !== draftBody },
    },
  };
  // Store in cache
  cacheSet(cacheKey, { body: aiText, title: draftTitle || message, expires: Date.now() + CACHE_TTL_MS });
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function sendError(context, status, error, detail) {
  context.res = { status, headers: corsHeaders(), body: { error, detail } };
  return;
}

async function callGitHubModels(token, payload) {
  const resp = await fetch('https://models.inference.ai.github.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-GitHub-Api-Version': '2024-07-01',
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await safeText(resp);
    throw new Error(`GitHub Models API error ${resp.status}: ${text}`);
  }
  return resp.json();
}

async function callAzureOpenAI({ endpoint, deployment, apiVersion, apiKey, body }) {
  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await safeText(resp);
    throw new Error(`Azure OpenAI error ${resp.status}: ${text}`);
  }
  return resp.json();
}

// Generic retry wrapper with exponential backoff for 429/5xx
async function withRetries(context, tag, fn) {
  const maxAttempts = 3;
  let attempt = 0;
  let delay = 500; // ms
  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (e) {
      const msg = e.message || '';
      if (attempt >= maxAttempts || !(msg.includes('429') || msg.includes(' 5') || /rate/i.test(msg))) {
        throw e;
      }
      context.log.warn(`[retry] ${tag} attempt ${attempt} failed: ${msg}; backing off ${delay}ms`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function safeText(resp) {
  try { return await resp.text(); } catch { return ''; }
}

function extractFirstMessage(json) {
  try {
    if (json && Array.isArray(json.choices) && json.choices.length) {
      const choice = json.choices[0];
      if (choice.message && typeof choice.message.content === 'string') {
        return choice.message.content.trim();
      }
    }
  } catch { /* ignore */ }
  return null;
}

function extractAzureFirstMessage(json) {
  try {
    if (json && Array.isArray(json.choices) && json.choices.length) {
      const choice = json.choices[0];
      if (choice.message && typeof choice.message.content === 'string') {
        return choice.message.content.trim();
      }
    }
  } catch { /* ignore */ }
  return null;
}
