# API Functions Migration Inventory

Objective: Migrate every legacy JavaScript Azure Function to TypeScript (Node 18+), minimal deps, production-ready, easily adaptable to Express later.

| Function Directory       | Route / Purpose                             | Status     | Notes                                                |
| ------------------------ | ------------------------------------------- | ---------- | ---------------------------------------------------- |
| github-oauth-token       | v4/github-oauth-token (OAuth code -> token) | Migrated   | TS + wrapper implemented                             |
| validation-status        | v4/validation-status (poll run status)      | Migrated   | TS parity migration complete                         |
| validation-template      | v4/validation-template (kick validation)    | Migrated   | TS dispatch with validation                          |
| validation-cancel        | v4/validation-cancel (cancel run)           | Migrated   | TS cancellation + discovery                          |
| validation-callback      | v4/validation-callback (callback ingest)    | Migrated   | TS stateless mapping cookie                          |
| validation-docker-image  | v4/validation-docker-image (image scan)     | Pending TS | Scans artifacts, uses yauzl                          |
| validation-ossf          | v4/validation-ossf (OSSF scan)              | Pending TS | Security scan integration                            |
| action-run-artifacts     | v4/workflow-run-artifacts (list artifacts)  | Migrated   | TS + wrapper + error shaping                         |
| action-run-status        | v4/workflow-run-status (workflow status)    | Migrated   | TS migration complete                                |
| action-trigger           | v4/workflow-trigger (trigger workflow)      | Migrated   | TS trigger + polling                                 |
| submit-analysis-dispatch | v4/submit-analysis-dispatch                 | Migrated   | TS parity dispatch                                   |
| add-template-pr          | v4/add-template-pr (create PR)              | Migrated   | TS branch + PR creation parity                       |
| archive-collection       | v4/archive-collection (archive results)     | Pending TS | Storage & packaging                                  |
| issue-ai-proxy           | v4/issue-ai-proxy (AI assist)               | Pending TS | External AI calls? Verify env                        |
| runtime-config           | v4/runtime-config (config exposure)         | Migrated   | TS; function key still exposed (review in hardening) |

Legend: Pending TS | In Progress | Migrated | Verified

## Migration Order

1. github-oauth-token (establish patterns)
2. validation-status
3. validation-template
4. action-run-artifacts
5. action-run-status
6. submit-analysis-dispatch
7. validation-callback / cancel
8. add-template-pr
9. issue-ai-proxy
10. validation-ossf
11. validation-docker-image
12. archive-collection
13. runtime-config (final hardening)

## Shared Modules (Planned)

- shared/env.ts (validated env vars)
- shared/http.ts (wrap handler: CORS, requestId, error normalization)
- shared/github.ts (Octokit + fallback fetch + retry)
- shared/log.ts (structured logging)
- shared/validation.ts (input schema minimal util)

## Acceptance Criteria Per Function

- TypeScript handler in `src/functions/*.ts`
- Registered (either via export + function.json scriptFile or code-first registration phase 2)
- No stubs/mocks, real GitHub or clearly documented fallback
- Strong parameter validation with clear 400 responses
- CORS + security headers present
- Logs include requestId

## Pending Decisions

- Move to full code-first registration after initial parity (phase 2)
- Optional: add integration tests harness (post-migration)

---

(Keep this table updated after each function migration commit.)
