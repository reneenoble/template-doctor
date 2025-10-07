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
