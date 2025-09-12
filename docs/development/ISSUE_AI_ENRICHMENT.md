# Issue AI Enrichment

This document describes the optional AI-based issue body enrichment pipeline used when Template Doctor creates GitHub issues from rule violations. It covers provider selection, configuration flags, request/response formats, caching, rate limiting, retry logic, and extension points.

## Overview

When enabled, each child issue (rule violation) first passes through a local templating engine that produces a structured Markdown body. The server-side Azure Function `issue-ai-proxy` can then refine this draft using an LLM provider (Azure AI Foundry / Azure OpenAI or GitHub Models). The enriched body is returned to the browser and used as the final issue content.

```
Violation -> IssueTemplateEngine (draft) -> /api/issue-ai -> Provider (Azure/GitHub) -> Enriched Markdown -> GitHub issue
```

## Provider Selection

Priority order:
1. If `ISSUE_AI_PROVIDER=azure` **or** `AZURE_OPENAI_ENDPOINT` is set → Azure path.
2. Else → GitHub Models path.

| Condition | Provider | Required Vars |
|-----------|----------|---------------|
| `ISSUE_AI_PROVIDER=azure` OR `AZURE_OPENAI_ENDPOINT` present | Azure OpenAI (Chat Completions) | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_KEY`* |
| Otherwise | GitHub Models | `GITHUB_MODELS_TOKEN` (or fallback `GITHUB_TOKEN`) |

\* For production, prefer Managed Identity instead of `AZURE_OPENAI_API_KEY` (future enhancement).

## Core Environment Variables

| Variable | Purpose | Default | Scope |
|----------|---------|---------|-------|
| `ISSUE_AI_ENABLED` | Master on/off (true/1/yes/on) | off | Server → client → provider gate |
| `ISSUE_AI_PROVIDER` | Force provider (`azure` or `github`) | auto-detect | Server |
| `ISSUE_AI_MODEL` | Generic model name (GitHub fallback) | `gpt-4o-mini` | Server |
| `AZURE_OPENAI_ENDPOINT` | Azure endpoint (https://<res>.openai.azure.com) | — | Server |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name (Azure) | `ISSUE_AI_MODEL` | Server |
| `AZURE_OPENAI_API_VERSION` | Azure API version | `2024-02-15-preview` | Server |
| `AZURE_OPENAI_API_KEY` | Azure API key (dev only) | — | Server |
| `GITHUB_MODELS_TOKEN` | Token for GitHub Models | — | Server |
| `ISSUE_AI_RATE_LIMIT_MAX` | Requests per window | 20 | Server |
| `ISSUE_AI_RATE_LIMIT_WINDOW_MS` | Rate limit window length (ms) | 60000 | Server |
| `ISSUE_AI_CACHE_TTL_MS` | Cache lifetime (ms) | 300000 | Server |
| `ISSUE_AI_CACHE_MAX` | Max cache entries (LRU-ish) | 500 | Server |

## Endpoint

`POST /api/issue-ai`

Request JSON:
```json
{
  "ruleId": "missing-readme",
  "severity": "warning",
  "message": "Missing README",
  "errorDetail": "(optional additional detail)",
  "draftTitle": "Add README",
  "draftBody": "# Add README\n\nCurrent: none."
}
```

Response JSON:
```json
{
  "provider": "azure",
  "model": "your-deployment",
  "title": "Add README",
  "body": "# Add README... (refined)",
  "usage": { "prompt_tokens": 123, "completion_tokens": 456 },
  "_meta": { "rewritten": true, "cache": false }
}
```

On cache hit: `usage: { "cached": true }`, `_meta.cache: true`.

Errors:
| Status | Scenario |
|--------|----------|
| 400 | Missing required fields or provider config |
| 429 | Rate limit exceeded |
| 502 | Upstream model failure after retries |

## Caching

Key = `provider:ruleId:hash(draftBody)` where `hash` is a lightweight FNV‑1a hex digest.

Limitations:
* In-memory only (per Functions instance); scale-out instances do not share cache.
* Eviction: simple earliest-in removal when size exceeds `ISSUE_AI_CACHE_MAX`.
* TTL governs validity; expired entries are purged lazily on access.

To bypass cache: modify the draft body (even a trailing space) or wait for TTL expiry.

## Rate Limiting

Per-key token bucket / counter reset each window (`ISSUE_AI_RATE_LIMIT_WINDOW_MS`). Key resolution order:
1. `x-repo` header (e.g. `owner/repo`)
2. `x-template-repo` header
3. Client IP (`x-forwarded-for` / socket address)

Exceeding the quota returns HTTP 429 with a hint for retry seconds.

## Retry & Backoff

Transient failures (status patterns containing `429` or generic 5xx text in error message) are retried up to 3 attempts with exponential backoff: 500ms → 1000ms → 2000ms.

Failures after max attempts bubble as HTTP 502 with the last error message.

## Client Integration

Front-end loads:
* `issue-template-engine.js` → builds deterministic structured draft body.
* `issue-ai-provider.js` → checks `TemplateDoctorConfig.issueAIEnabled` and calls `/api/issue-ai` only when enabled.

No UI toggle is exposed. Activation is by environment/config only.

## Extension Hooks

* Add per-rule templates in `issue-template-engine.js` via `RULE_TEMPLATES`.
* Provide alternative enrichment logic by replacing the server function or adding middleware upstream.
* (Future) Swap to Managed Identity for Azure: acquire AAD token and replace API key header with `Authorization: Bearer <token>`.

## Security Notes

* Tokens (`AZURE_OPENAI_API_KEY`, `GITHUB_MODELS_TOKEN`) must remain server-side only.
* Do not embed secrets in the client bundle.
* Consider IP allowlists or auth if exposing this endpoint publicly.
* Monitor usage to detect abuse (rate limit counters can be exported to telemetry later).

## Hardening Roadmap (Optional)

| Enhancement | Rationale |
|-------------|-----------|
| Redis-backed cache/rate limit | Multi-instance consistency |
| Managed Identity auth for Azure | Eliminate static API key |
| Circuit breaker | Avoid hammering provider during outages |
| Observability (App Insights custom metrics) | Track hit ratio & error rate |
| Configurable acceptance criteria injection | Fine-grained drafting control |

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Action |
|---------|--------------|--------|
| Always returns draft (no rewrite) | `ISSUE_AI_ENABLED` false | Set to true & restart Functions |
| 400 provider config error | Missing Azure or GitHub token vars | Supply required env vars |
| Frequent 429 | Low rate limit or burst traffic | Increase `ISSUE_AI_RATE_LIMIT_MAX` or widen window |
| Cache never hits | Varying draft body hashes | Ensure deterministic draft generation |
| 502 after retries | Upstream model outage | Check provider status; consider fallback provider |

---
*Document version:* 1.0  
*Last updated:* (auto-maintain manually as needed)
