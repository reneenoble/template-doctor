# Cleanup Plan - Post v1.0.0 Express Migration

## ✅ Completed Cleanup

### Removed Files
- ✅ `scripts/test-add-template.json` - Obsolete Azure Functions test data
- ✅ `scripts/test-submit-analysis-local.js` - Obsolete Azure Functions local testing harness
- ✅ `debug-auth.html` - Debug file (added to .gitignore)
- ✅ `smoke-test-output.log` - Test output (added to .gitignore)

### Updated Files
- ✅ `.gitignore` - Added patterns for debug/test output files to prevent future commits

## Root-Level Scripts (Keep at Root)

These convenience scripts should **stay at root** for easy access:
- ✅ `docker-start.sh` - Documented in DOCKER.md, used frequently
- ✅ `docker-stop.sh` - Documented in DOCKER.md, used frequently  
- ✅ `preview.sh` - Documented in OAUTH_SETUP_PORT_3000.md
- ✅ `start-dev-servers.sh` - Development convenience script
- ✅ `test-auth-flow.sh` - OAuth debugging utility

**Rationale**: Moving these would require updating multiple docs (DOCKER.md, OAUTH_SETUP_PORT_3000.md, PORT_ALLOCATION.md, README.md). They're meant to be run from root for convenience.

## Scripts Directory - Status

### Removed (Obsolete)
- ✅ `scripts/test-add-template.json` - Azure Functions test data
- ✅ `scripts/test-submit-analysis-local.js` - Azure Functions local testing

### Kept (May Review Later)
- ⏸️ `scripts/bootstrap-node.sh` - Node setup utility (documented as "Keep" in SCRIPTS_AUDIT.md)
- ⏸️ `scripts/reset-results.sh` - Used by batch-scan.sh

### Scripts to KEEP (Actively Used)
- ✅ `scripts/setup.sh` - **CRITICAL** - UAMI/GitHub Actions auth (referenced in package.json, UAMI_SETUP_INSTRUCTIONS.md)
- ✅ `scripts/verify-packages.sh` - Used by guard-packages.yml workflow
- ✅ `scripts/fetch-deprecated-models.js` - Used by update-deprecated-models.yml
- ✅ `scripts/list-ai-quotas.sh` - Used by validation-template.yml
- ✅ `scripts/smoke-api.sh` - Express API testing
- ✅ `scripts/action.js` - GitHub Action entry point
- ✅ `scripts/analyze.js` - CLI tool
- ✅ `scripts/analyzer-node.js` - CLI tool
- ✅ `scripts/batch-scan.sh` - Batch operations
- ✅ `scripts/test-github-token.js` - Debugging utility
- ✅ `scripts/ensure-node-version.js` - CI/CD requirement
- ✅ `scripts/extract-repo-urls.js` - Data processing
- ✅ `scripts/generate-scan-meta-backfill.js` - Data generation

## Summary

### Files Removed (4 total)
1. `scripts/test-add-template.json` - Azure Functions test data
2. `scripts/test-submit-analysis-local.js` - Azure Functions testing harness
3. `debug-auth.html` - OAuth debug page
4. `smoke-test-output.log` - Test output

### Files Updated
1. `.gitignore` - Added patterns: `debug-*.html`, `*-test-output.log`, `smoke-test-output.log`

### Result
- Removed obsolete Azure Functions test files
- Cleaned up debug/test output files
- Protected against future debug file commits
- All active scripts preserved

## Recommended Actions

### Immediate - Safe Cleanup
1. Review and possibly remove low-priority test scripts (after confirming not in use)
2. Consider consolidating similar scripts if duplication found

### Documentation Updates
- [ ] Update docs/development/SCRIPTS_AUDIT.md with final decisions
- [ ] Ensure all script purposes are documented
- [ ] Add migration notes for any removed scripts

### Future Consideration
- After full Express migration (17 remaining Functions), review test scripts again
- Consider creating a `dev/` folder for development-only utilities if root gets cluttered

## Note on scripts/setup.sh
**DO NOT DELETE** - This is critical for:
- User Assigned Managed Identity (UAMI) setup
- GitHub Actions authentication
- Production CI/CD workflows
- Referenced in package.json as `npm run setup:uami`
