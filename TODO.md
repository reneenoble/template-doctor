# TODOs: Validation Flow Hardening and Route Cleanup

This document tracks optional follow-ups discussed for the validation flow.

## 1) Fix and re-enable smoke-api.yml workflow

- **Status**: Removed in commit 137b88a to unblock PR merge
- **Issue**: Express server was not starting in GitHub Actions CI
- **Root cause**: Server startup process failing, health check at `/api/health` never responding
- **Attempted fixes**:
  - Added .env configuration (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, PORT)
  - Improved startup script with logging and better wait loop
  - Changed health check endpoint from `/api/v4/client-settings` to `/api/health`
- **Next steps**:
  - Debug why Express server fails to start in CI environment
  - Verify dist/index.js exists and is executable
  - Check for missing dependencies or environment issues
  - Consider using Docker container for consistent environment
  - Re-add workflow once server startup is reliable
- **Code reference**: `.github/workflows/smoke-api.yml` (deleted), `packages/server/src/index.ts`

## 2) Harden client correlation (cookie handling)

- Current behavior: `validation-callback` sets `td_runId=<runId>` as a client-accessible cookie (not HttpOnly).
- Proposed improvement: Mark the cookie as `HttpOnly` and move frontend polling to a server-side proxy endpoint.
    - Benefit: Prevents client-side JS from reading/modifying the correlation ID, improving tamper resistance.
    - Cost: Requires adding a proxy endpoint and adjusting the frontend to call that proxy instead of calling the status endpoint directly.
- Code reference: `packages/api/validation-callback/index.js` (see TODO comment near cookie creation).

## 3) Route cleanup for runId

- Current behavior: `validation-status` accepts `runId` via query string and also falls back to reading from `td_runId` cookie.
- Proposed improvement: Switch to a path parameter route `validation-status/{runId}` and read it from binding data.
    - Benefit: A cleaner API contract and reduces ambiguity around where `runId` comes from.
    - Cost: Requires updating `function.json` and any frontend code that constructs the polling URL.
- Code reference: `packages/api/validation-status/index.js` (see TODO comment about path param option).

## Notes

- These changes are optional—they trade developer UX simplicity for stronger guarantees and/or cleaner API shapes.
- Re-evaluate after confirming the current stateless flow is stable in production.
- **Priority**: Fix smoke-api workflow (item 1) should be addressed before the next release to ensure CI coverage of Express API endpoints.

---

# Additional Optimization & Hardening Backlog (Post-Merge)

These items were identified during AZD validation improvements and test infrastructure refactors. They are not required for current stability but will increase resilience, performance, and clarity.

## A. Artifact Parsing & Validation Pipeline
- Add exponential backoff + max retry (e.g. 3 attempts) for artifact download on transient 5xx / network failures.
- Cache last successful artifact metadata (runId + artifact id + hash) to skip redundant downloads when status unchanged.
- Add timeout & AbortController around fetch calls (configurable ENV: `ARTIFACT_FETCH_TIMEOUT_MS`).
- Implement circuit breaker (e.g. open after N consecutive failures and short‑circuit for a cooldown window) with log + metric.

## B. Telemetry & Metrics
- Introduce structured logging (JSON) for each validation parse result (fields: runId, overallStatus, timings, artifactFound, warnings, errors).
- Add aggregate in‑memory counters (success/warning/failure) exposed via `/api/v4/metrics` (later: push to real telemetry sink).
- Track duration from dispatch to artifact availability for SLO trend.

## C. Security Scan Categorization
- Parse security section into categories (encryption, identity, networking, configuration) using pattern map.
- Extend API response: `securityCategories: { encryption: { errors, warnings }, identity: {...} }`.
- Frontend: grouped display + category badges.

## D. Issue Creation Enhancements
- Cache Copilot bot user ID (in‑memory with TTL) to avoid repeated GraphQL lookups.
- Retry createIssue GraphQL mutation on 502/503 with jitter.
- Collect and display reason when fallback to URL form triggered (network vs permission vs missing scope).

## E. Performance Improvements
- Hoist regex constructions for parsing (singleton module constants).
- Defer full markdown payload transmission unless frontend expands details (add `?includeMarkdown=1`).
- Consider compressing large markdown in response (gzip automatically via middleware if size threshold exceeded).

## F. Playwright & Test Infrastructure
- Introduce test tagging: smoke vs regression (Playwright `--grep @smoke`).
- Auto-capture trace & video only on failure (reduce artifact size).
- Add axe accessibility scan to at least one validation result scenario.
- Add negative test: artifact never appears → UI times out gracefully.
- Add CI guard to ensure removed legacy spec filenames are not reintroduced (grep in workflow, fail if match).

## G. CI/CD Enhancements
- Cache analyzer-core build output to reduce cold build time.
- Workflow matrix: Node 20 & 22; OS: ubuntu-latest + macOS (light). Use `fail-fast: true`.
- Path-based workflow skipping (docs-only changes skip Playwright).
- Separate job for unit tests running in parallel with Playwright.

## H. Migration & Cleanup
- Remove analyzer stub file once external references audit complete (see migration instructions).
- Add script to verify no deprecated paths under `packages/app/js/` reappear.

## I. Resilience & Reliability
- Add health sub-endpoint `/api/health/validation` returning last X validation summary stats.
- Provide explicit error code mapping for common failure cases (artifact_missing, security_scan_failed, azd_up_timeout, parse_error).

## J. Documentation
- New doc: `docs/development/VALIDATION_PIPELINE.md` covering lifecycle (dispatch -> run -> artifact -> parse -> UI update).
- Table mapping `overallStatus` to condition matrix (AZD Up OK?, AZD Down OK?, psRuleErrors, psRuleWarnings, securityScanFailed).
- Add FAQ entry: "Why is detailed validation missing?" with artifact timing explanation.

## K. UX Enhancements
- Copy to clipboard button for extracted failure snippets.
- Link adjacent to status: "Open workflow run" (direct to GitHub UI) and "Download raw result".
- Add inline elapsed time bar or progress pulses (purely cosmetic but improves perceived feedback).

## L. Accessibility
- aria-live region for dynamic status text updates.
- Ensure contrast of warning & failure panels validated by automated axe run.
- Keyboard navigation: ensure collapsible details panel focus styles are visible.

## M. Test Coverage Gaps
- Unit test for case: AZD Up success, Down failure, plus warnings (ensures overall failure stays correct).
- Unit test for securityScanFailed + no errors (still failure) branch.
- Playwright scenario: manual issue creation fallback after forced GraphQL error.

## N. Config & Validation Guardrails
- Startup config validator enumerating required env vars, logs summary table (mask secrets).
- Add schema validation for runtime-config endpoint response before serving to client (defense-in-depth).

## O. Fail-Fast Script Extensions
- Add optional env `PW_REQUIRED_BROWSERS=chromium,webkit` to enforce presence of additional browsers.
- Provide `--ci` flag variant to output JSON (machine parsable) for future pipeline dashboards.

## P. Database Preparation (Upcoming Major Feature)
- Select initial entities (templates, scans, validation_results, overrides).
- Decide on ORM/Query Layer (Prisma vs Knex) + migration workflow.
- Plan dual-write period (filesystem + DB) for safe migration & rollback.

---

> Prioritize A (reliability) and G (CI confidence) before deeper UX polish. Database introduction (P) will influence some telemetry & schema design decisions—coordinate sequence to avoid churn.

