# Frontend Migration Notes (Interim)

This document captures the current transitional state while migrating the frontend toward a fully typed, server-driven analysis model.

## Changes in this iteration

- Added `server-analysis-bridge.js` to guarantee presence of `TemplateAnalyzer.analyzeTemplateServerSide` for tests.
- Added `analyzer-server-only-patch.js` to enforce server-only analysis and disable client-side fallback.
- Updated `api-routes.js` with additional endpoints: `issue-create`, `repo-fork`, `batch-scan-start`, `batch-scan-status` (plus existing `analyze-template`).
- Skipped legacy fallback Playwright test (`client-side fallback (disabled during migration)`).

## Remaining Legacy / Shim Areas

| Area                                                            | Status              | Notes                                                |
| --------------------------------------------------------------- | ------------------- | ---------------------------------------------------- |
| analyze-template backend handler                                | Uses shim imports   | Needs refactor to shared wrapHttp pattern.           |
| issue-create backend handler                                    | Shimmed             | Should migrate to shared GitHub helper + validation. |
| repo-fork backend handler                                       | Shimmed             | Inline SAML classification; move to shared module.   |
| batch-scan-start/status                                         | Prototype/in-memory | Decide: productionize with durable store or remove.  |
| Frontend analyzer TypeScript source (`src/scripts/analyzer.ts`) | Not wired           | Legacy `js/analyzer.js` still authoritative.         |

## Next Recommended Steps

1. Replace legacy `js/analyzer.js` with built output from a TS bundling step (esbuild/Vite/Rollup) and remove patch scripts once stable.
2. Refactor four shimmed functions to `wrapHttp` and add parameter/unit tests mirroring existing validation endpoints.
3. Remove or reintroduce a feature-flagged fallback test with an explicit design (if offline analysis returns later).
4. Introduce type declarations for global objects (`TemplateAnalyzer`, `ApiRoutes`) to reduce implicit any usage.
5. Consider consolidating route discovery and feature flags into a single `bootstrap.js` entry for deterministic ordering.

## Temporary Scripts (Safe to Remove After Refactor)

- `js/server-analysis-bridge.js`
- `js/analyzer-server-only-patch.js`

## Risk Summary

| Risk                                                   | Impact                        | Mitigation                                              |
| ------------------------------------------------------ | ----------------------------- | ------------------------------------------------------- |
| Divergence between TS analyzer and legacy JS           | Inconsistent behavior/tests   | Prioritize bundling TS version next.                    |
| Hidden client-only logic depending on removed fallback | UI edge errors                | Monitor console; add defensive notifications.           |
| Batch scan memory store loss on reload                 | Misleading progress for users | Implement durable queue or disable feature until ready. |

## Ownership Handoff Notes

- All new endpoints should be added to `api-routes.js`; avoid hard-coded `/v4/...` strings elsewhere.
- When refactoring analyze-template backend, introduce a small contract interface and limit file list size.
- Document any new environment flags in `docs/development/ENVIRONMENT_VARIABLES.md`.
