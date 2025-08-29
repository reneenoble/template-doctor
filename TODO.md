# TODOs: Validation Flow Hardening and Route Cleanup

This document tracks optional follow-ups discussed for the validation flow.

## 1) Harden client correlation (cookie handling)
- Current behavior: `validation-callback` sets `td_runId=<runId>` as a client-accessible cookie (not HttpOnly).
- Proposed improvement: Mark the cookie as `HttpOnly` and move frontend polling to a server-side proxy endpoint.
  - Benefit: Prevents client-side JS from reading/modifying the correlation ID, improving tamper resistance.
  - Cost: Requires adding a proxy endpoint and adjusting the frontend to call that proxy instead of calling the status endpoint directly.
- Code reference: `packages/api/validation-callback/index.js` (see TODO comment near cookie creation).

## 2) Route cleanup for runId
- Current behavior: `validation-status` accepts `runId` via query string and also falls back to reading from `td_runId` cookie.
- Proposed improvement: Switch to a path parameter route `validation-status/{runId}` and read it from binding data.
  - Benefit: A cleaner API contract and reduces ambiguity around where `runId` comes from.
  - Cost: Requires updating `function.json` and any frontend code that constructs the polling URL.
- Code reference: `packages/api/validation-status/index.js` (see TODO comment about path param option).

## Notes
- These changes are optional—they trade developer UX simplicity for stronger guarantees and/or cleaner API shapes.
- Re-evaluate after confirming the current stateless flow is stable in production.
