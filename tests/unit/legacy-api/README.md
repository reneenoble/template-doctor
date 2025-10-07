# Legacy API Tests

**These tests are preserved for reference but are not run in CI.**

## Why are these tests here?

These tests were written for the legacy Azure Functions API (`packages/api`) which has been migrated to the Express-based server (`packages/server`).

The legacy API code is preserved in the `legacy/azure-functions` branch for reference, and these tests are kept here for the same reason.

## Tests in this folder:

- `api.*.spec.js` - Tests for Azure Functions endpoints (archive, issue-ai-proxy, runtime-config, validation-ossf, validation-template)
- `analyzer.mainBranchFallback.spec.js` - Tests legacy `packages/app/js/analyzer.js` file
- `github-client.ensureAccessibleRepo.spec.js` - Tests legacy `packages/app/js/github-client-new.js` file

## Migration Status:

- ✅ **Express server** (`packages/server`) is the current production implementation
- ✅ **TypeScript modules** in `packages/app/src/` replaced legacy JS files
- ✅ New tests should be written for Express routes and TypeScript modules
- ❌ These legacy tests are **not maintained** and may fail

## How to run these tests (if needed):

1. Checkout the `legacy/azure-functions` branch
2. Build the legacy API: `npm run build -w packages/api`
3. Run specific test: `npm test tests/unit/legacy-api/<test-name>.spec.js`

**Note:** These tests are excluded from the main test suite by being in a subdirectory that vitest doesn't automatically scan.
