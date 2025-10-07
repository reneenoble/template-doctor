# Migration Notes: JS → TypeScript + Vite

Date: 2025-09-28

## Completed

- Introduced Vite + TypeScript (`tsconfig.json`, `vite.config.ts`) – dev/preview on port 4000 (GitHub OAuth callback alignment).
- Consolidated all legacy `<script>` tags into a single `src/main.ts` entry (kept load ordering).
- Added transitional TS facades for notification systems: `src/notifications/notification-system.ts`, `src/notifications/notifications.ts`.
- Wrapped legacy `app.js` via `src/app.ts` for incremental typing.
- Playwright config updated to launch Vite instead of python static server; baseURL = `http://localhost:4000`.
- Smoke test (`should handle search functionality`) passes via explicit config.
- Analyzer resilience improvements (2025-09-30):
  - Added automatic retry to `http://localhost:7071` when initial same-origin POST to `/api/v4/analyze-template` returns 404 in local dev.
  - Added silent client-side fallback analysis when a 404 occurs on localhost (non-test) so users don't see "Server-side analysis failed" during partial backend setup.

## Pending / Next Steps

1. Remove legacy analyzer & api-client bundles:
   - Replace `../js/analyzer.bundle.js` & `../js/api-client.bundle.js` imports with direct TS module imports.
   - Add those bundles to `.gitignore` and delete from repo.
2. Start real typing effort:
   - Rename / migrate `app.ts` contents (inline logic extraction instead of importing `../js/app.js`).
   - Introduce interfaces for: BatchScanItem, AnalysisResult, NotificationPayload.
3. Gradually drop legacy JS:
   - For each `../js/*.js` file: copy to `src/` TS module, add minimal types, update `main.ts` import, then remove old file.
4. Playwright root convenience config (optional) to simplify commands. (DONE)
5. Introduce ESLint + TypeScript strictness (phased): start with noImplicitAny=false, then enable per directory.
6. Tree-shake / bundle size follow-up once legacy code gone (current bundle ~313 KB, target <200 KB initial).

## Load Order Rationale

Some globals are still expected by tests / runtime:

- `TemplateAnalyzer`, `NotificationSystem`, `Notifications`, `GitHubAuth`, `GitHubClient`.
- Order ensures config + auth load before analyzer to prevent early server analysis without token.

## De-Risk Strategy

- Keep legacy JS and new TS side-by-side until each slice passes Playwright tests.
- After each module migration run focused tests (issue labels, batch scan, search) before broader run.
- Avoid simultaneous removal of multiple interdependent legacy files.

## Suggested Migration Sequence (Remaining)

1. `github-client-new.js` → `src/github/github-client.ts`
2. `server-analysis-bridge.js` & analyzer patches → fold into `analyzer.ts` entry layer
3. Batch scanning cluster (`app.js` subsection) → dedicated `src/batch/` modules
4. Dashboard / report rendering modules
5. Issue creation / AI provider modules

## Test Suites to Prioritize After Each Step

- Fork / SAML tests (ensures backend flow intact)
- Batch cancel / resume tests (ensures IndexedDB logic stable)
- Notifications tests (a11y roles + confirm workflow)
- Search test (baseline smoke)

## Clean-Up Milestones

- M1: Notifications + App wrapper (done)
- M2: Remove analyzer/api-client bundles
- M3: Batch modules ported
- M4: Dashboard + report modules ported
- M5: Issue + AI modules ported
- M6: Final pass: remove all `../js` imports, enforce `allowJs:false`

## Rollback Plan

If a migration step breaks tests:

1. Re-introduce failing legacy JS import in `main.ts`.
2. Re-run focused failing test to confirm restoration.
3. Iterate on TS port in isolation branch.

---

Generated automatically during migration; keep updated with each milestone.
