# Docs Ruleset Validation & Diagnostics

This document explains how the **docs** ruleset repository configuration validation works inside the Template Doctor analyzer, and how to observe or extend its diagnostics.

## Overview
When the analyzer runs with `ruleSet === 'docs'`, it invokes the docs ruleset–specific validator:

```
TemplateAnalyzerDocs.prototype.validateDocConfiguration(config, repoInfo, defaultBranch, files, issues, compliant)
```

This logic lives in `packages/app/js/ruleset-docs/analyzer.js` and currently performs:
- Default branch enforcement via `githubRepositoryConfiguration.defaultBranch.mustBe`
- (Placeholder) — future repository governance checks (branch protection, required workflows, etc.)

## Invocation Flow
1. Core analyzer ( `packages/app/js/analyzer.js` ) detects `ruleSet === 'docs'`.
2. It increments a lightweight diagnostics counter and stores metadata:
   - `window.__TemplateDoctorDocsValidationHits` — total times docs validation invoked this session.
   - `window.__TemplateDoctorLastDocsValidation` — object containing `{ ts, owner, repo, defaultBranch }`.
3. It dispatches a custom DOM event:
   - Event name: `template-doctor-docs-validation`
   - Event detail: same metadata object as above.
4. It calls `TemplateAnalyzerDocs.prototype.validateDocConfiguration(...)` which populates `issues` / `compliant` arrays under the `repositoryManagement` category.

## Diagnostics APIs
You can observe the invocation from DevTools:
```js
// How many times docs validation has run this page load
window.__TemplateDoctorDocsValidationHits;

// Last invocation metadata
window.__TemplateDoctorLastDocsValidation;

// Listen for future invocations
document.addEventListener('template-doctor-docs-validation', e => {
  console.log('Docs validation event:', e.detail);
});
```

## Why Separate From `validateRepoConfiguration`?
Historically, a merge introduced both `validateDocConfiguration` and a placeholder `validateRepoConfiguration`. The latter is **not** used for the docs ruleset. The conflict markers were resolved in favor of the purpose-built `validateDocConfiguration`, which explicitly receives the `files` array and is scoped to docs-specific policy.

## Adding New Docs Rules
Add helper evaluators inside `ruleset-docs/analyzer.js`, then wire them into `validateDocConfiguration`:
```js
validateDocConfiguration(config, repoInfo, defaultBranch, files, issues, compliant) {
  this.evaluateDefaultBranchRule(config, repoInfo, defaultBranch, issues, compliant);
  this.evaluateRequiredWorkflows(config, files, issues, compliant); // (example)
}
```
Document any new config schema additions in `docs/development/specification.md` (or create a focused docs ruleset schema section if it grows large).

## Event Consumption Ideas
- Display a small badge in the UI when docs validation ran.
- Aggregate timing or performance metrics (wrap the call and record `performance.now()`).
- Telemetry hook: send `e.detail` to a logging endpoint (ensure user consent / privacy policies).

## Extending the Schema
Current config reference for the docs ruleset is loaded from `configs/docs-config.json`. To add a new rule:
1. Extend the JSON (e.g., `githubRepositoryConfiguration.branchProtection.mustInclude`)
2. Add a parsing / normalization step in `TemplateAnalyzerDocs.getConfig()` if needed.
3. Implement an evaluator method.
4. Append evaluator call inside `validateDocConfiguration`.
5. Update this document and `specification.md`.

## Safety & Failure Handling
- All diagnostics updates are wrapped in try/catch and won’t break analysis if they fail.
- A validation failure only adds warning or error entries; the analyzer continues.

## Removing Diagnostics (If Needed)
Delete or comment the block in `analyzer.js` that mutates `window.__TemplateDoctorDocsValidationHits` and dispatches the event. No other code depends on these globals.

---
_Last updated: 2025-09-15_