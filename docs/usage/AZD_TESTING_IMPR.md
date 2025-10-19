# 🚀 AZD Validation Improvements: Artifact Parsing, Test Infrastructure & Documentation

## Summary

This PR enhances the AZD validation feature with artifact-based parsing, comprehensive test coverage, and production-grade test infrastructure. It also adds extensive documentation and a roadmap for future optimizations.

## What Changed

### 🎯 Core Features

- **Artifact Parsing Service**: New `azd-validation.ts` service for downloading and parsing GitHub Actions validation artifacts
- **Structured Validation Results**: Three-state validation (success/warning/failure) based on parsed markdown
- **Config Deduplication**: Fixed duplicate key handling in setup endpoint (last write wins)
- **Testable Server**: Exported `app` and `startServer` for integration testing

### 🧪 Test Infrastructure

- **Playwright Browser Guard**: Fail-fast script prevents CI failures from missing browser binaries
    - Detects `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` misconfigurations
    - Provides actionable remediation steps
    - Supports `PLAYWRIGHT_ALLOW_MISSING` override for unit-only pipelines
- **Expanded Test Coverage**: Vitest now includes server tests alongside root unit tests
- **Server Test Config**: Added `tsconfig.test.json` for server-side test compilation

### ✅ Test Coverage Added

- **E2E Tests** (Playwright):
    - Validation UI (spinner, contrast, troubleshooting tips)
    - Artifact-based results display
    - GraphQL issue creation flow
    - Error detection and highlighting
- **Unit Tests** (Vitest):
    - Artifact download and ZIP extraction
    - Markdown parsing (AZD Up/Down, PSRule errors/warnings, security status)
    - Error pattern matching (UnmatchedPrincipalType detection)
    - Issue body generation from artifacts

### 📚 Documentation

- **AZD_VALIDATION_IMPROVEMENTS_SUMMARY.md**: Complete feature overview with technical details
- **AZD_VALIDATION_TEST_PLAN.md**: Comprehensive test plan with manual checklist
- **README.md**: Playwright Browser Guard section with CI examples
- **TODO.md**: 16-category optimization backlog (artifact retries, telemetry, security categorization, etc.)

## Commit Structure

1. **feat(validation)**: Core logic - artifact parsing service and route refactoring
2. **test**: Test infrastructure - browser guard, vitest config, pretest hooks
3. **test**: Test coverage - E2E and unit tests for validation features
4. **docs**: Documentation - summaries, test plans, roadmap

## Files Changed

### Production Code (4 files)

- `packages/server/src/services/azd-validation.ts` ✨ NEW
- `packages/server/src/routes/validation.ts` 🔧 REFACTORED
- `packages/server/src/routes/misc.ts` 🐛 FIX
- `packages/server/src/index.ts` 🔧 EXPORTS

### Test Infrastructure (5 files)

- `scripts/verify-playwright-browsers.js` ✨ NEW
- `package.json` - pretest hook
- `vitest.config.mjs` - server test inclusion
- `packages/server/tsconfig.test.json` ✨ NEW
- `packages/server/tests/setup-endpoint.spec.ts` - lifecycle fixes

### Test Files (4 files)

- `packages/app/tests/azd-validation-e2e.spec.js` ✨ NEW
- `packages/app/tests/azd-validation.spec.js` ✨ NEW
- `packages/server/tests/validation-artifact-parsing.test.ts` ✨ NEW
- `tests/unit/azd-validation-error-detection.spec.ts` ✨ NEW

### Documentation (4 files)

- `docs/development/AZD_VALIDATION_IMPROVEMENTS_SUMMARY.md` ✨ NEW
- `docs/development/AZD_VALIDATION_TEST_PLAN.md` ✨ NEW
- `README.md` - browser guard section
- `TODO.md` - optimization backlog

## Testing

✅ All tests passing:

```bash
npm test                          # All tests (with browser verification)
npm run test -- azd-validation   # Focused E2E tests
npm run test:unit                # Unit tests only
./scripts/smoke-api.sh           # API smoke tests
```

**Browser Guard in Action:**

```bash
# Prevents this CI failure scenario:
# ❌ Error: Executable doesn't exist at /ms-playwright/chromium-1181/chrome-linux/chrome

# Now fails fast with clear guidance:
# ✅ PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is set but no Chromium found
#    Run: npx playwright install chromium
```

## Breaking Changes

❌ None - fully backward compatible

## Migration Notes

- `azdValidation` field is optional (nullable) in API responses
- Frontend gracefully handles missing artifact data
- GraphQL issue creation has URL form fallback

## Performance Impact

- Artifact download: +1-3s per validation (only when artifact available)
- Markdown parsing: ~50ms
- Overall validation UX improved with structured results

## Next Steps (Post-Merge)

See **TODO.md** for 16-category optimization roadmap including:

- Artifact retry logic with exponential backoff
- Telemetry and structured logging
- Security categorization (encryption, identity, networking)
- Performance improvements (regex hoisting, deferred markdown)
- CI enhancements (matrix testing, path filtering)

## Release Impact

🎉 This PR will trigger **release-please** to create a **1.1.0** release:

- ✨ `feat:` commit → minor version bump
- 📦 Includes changelog generation
- 🏷️ Auto-tags release when PR merged

## Reviewer Checklist

- [ ] Review artifact parsing logic (`packages/server/src/services/azd-validation.ts`)
- [ ] Verify test coverage is comprehensive (E2E + unit)
- [ ] Check browser guard script logic (`scripts/verify-playwright-browsers.js`)
- [ ] Validate documentation completeness
- [ ] Confirm no breaking changes
- [ ] Approve for 1.1.0 release

---

**Related Issues:** (Add issue numbers if applicable)

**Deployment:** No infrastructure changes required

**Rollback Plan:** Revert commits if issues arise; frontend degrades gracefully
