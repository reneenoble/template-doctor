# Scripts Audit - Express Migration

_Last updated: 2025-01-03_

This document tracks scripts in the `/scripts` directory to determine which are still needed after migrating from Azure Functions to Express.

## Legend

- ✅ **Keep**: Still required for current architecture
- 🔄 **Update**: Needs modification for Express architecture
- ❌ **Delete**: No longer needed, safe to remove
- 🔍 **Review**: Needs investigation to determine status

## Scripts Inventory

| Script                           | Status    | Purpose                           | Action Required    | Notes                                              |
| -------------------------------- | --------- | --------------------------------- | ------------------ | -------------------------------------------------- |
| `action.js`                      | ✅ Keep   | GitHub Action entry point         | None               | Core functionality for GitHub Actions integration  |
| `analyze.js`                     | ✅ Keep   | CLI analysis tool                 | None               | Standalone analysis script, independent of backend |
| `analyzer-node.js`               | ✅ Keep   | Node.js analyzer wrapper          | None               | Core analyzer functionality                        |
| `batch-scan.sh`                  | ✅ Keep   | Batch scanning script             | None               | CLI utility for batch operations                   |
| `batch-scan-urls.txt`            | ✅ Keep   | Test data for batch scanning      | None               | Sample data file                                   |
| `bootstrap-node.sh`              | ✅ Keep   | Node.js version check             | None               | Development environment setup                      |
| `ensure-node-version.js`         | ✅ Keep   | Node.js version validation        | None               | Required for CI/CD                                 |
| `extract-repo-urls.js`           | ✅ Keep   | Extract repository URLs from data | None               | Utility script for data processing                 |
| `fetch-deprecated-models.js`     | ✅ Keep   | Fetch AI model deprecation list   | None               | Automated maintenance script                       |
| `generate-scan-meta-backfill.js` | 🔍 Review | Generate backfill data            | TBD                | Determine if still needed                          |
| `list-ai-quotas.sh`              | 🔍 Review | List Azure AI quotas              | Update or Delete   | Azure-specific, may need updates                   |
| `reset-results.sh`               | ✅ Keep   | Reset results directory           | None               | Development utility                                |
| `setup.sh`                       | ❌ Delete | Azure UAMI setup script           | Mark for deletion  | Only needed for Azure Functions                    |
| `smoke-api.sh`                   | 🔄 Update | API smoke tests                   | Update for Express | Already updated for port 3001                      |
| `test-add-template.json`         | 🔍 Review | Test data for template PR         | TBD                | May be deprecated with Express                     |
| `test-github-token.js`           | ✅ Keep   | Test GitHub token validity        | None               | Useful for debugging                               |
| `test-submit-analysis-local.js`  | 🔍 Review | Local analysis submission test    | TBD                | May need updates for Express                       |
| `verify-packages.sh`             | 🔄 Update | Verify package structure          | Update             | Needs to include `server` package                  |

## Detailed Analysis

### Scripts to Delete

#### `setup.sh`

- **Reason**: Azure-specific UAMI (User Assigned Managed Identity) setup
- **Current Uses**: Configures federated credentials for Azure Functions
- **Replacement**: Docker Compose handles service orchestration; no UAMI needed for Express
- **Action**: Delete after confirming no production dependencies

### Scripts to Update

#### `smoke-api.sh`

- **Status**: ✅ Already Updated
- **Changes**: Port changed from 7071 to 3001
- **Current State**: Working with Express backend
- **No further action needed**

#### `verify-packages.sh`

- **Required Changes**:
  - Add `server` to expected packages list
  - Remove check for `api` (will move to legacy branch)
  - Update expected directories: `(app server)`
- **Priority**: High - blocks CI if not updated

### Scripts to Review

#### `list-ai-quotas.sh`

- **Purpose**: Lists Azure OpenAI quotas
- **Consideration**: May still be useful if using Azure OpenAI for AI features
- **Action**: Review AI provider configuration; update if needed

#### `generate-scan-meta-backfill.js`

- **Purpose**: Generates backfill metadata for scans
- **Consideration**: May be one-time migration script
- **Action**: Determine if backfill is complete; delete if obsolete

#### `test-add-template.json`

- **Purpose**: Test data for `add-template-pr` function
- **Consideration**: This function not yet migrated to Express
- **Action**: Keep until function migration complete, then reassess

#### `test-submit-analysis-local.js`

- **Purpose**: Local testing of analysis submission
- **Consideration**: May need endpoint updates for Express
- **Action**: Test with Express endpoints; update or delete

## Docker-Specific Scripts

No new scripts needed for Docker deployment. Docker Compose and Dockerfiles are configured in the root directory.

## Recommended Actions

### Immediate (Before Next Release)

1. ✅ Update `verify-packages.sh` to expect `server` package
2. ✅ Verify `smoke-api.sh` works with Express (already done)
3. 🔍 Test `test-github-token.js` - confirm still useful

### Short Term (Next Sprint)

1. 🔍 Review AI-related scripts (`list-ai-quotas.sh`)
2. 🔍 Test `test-submit-analysis-local.js` with Express
3. ❌ Delete `setup.sh` after confirming no production usage
4. 🔍 Review `generate-scan-meta-backfill.js` - delete if one-time use

### Long Term (After Full Migration)

1. Review all test scripts after 17 remaining functions migrated
2. Create Docker-specific helper scripts if needed
3. Archive obsolete scripts to legacy branch with documentation

## Migration Coordination

- **Coordination File**: See `EXPRESS_MIGRATION_MATRIX.md` for API migration status
- **When API function is migrated**: Review corresponding test/setup scripts
- **Before deleting any script**:
  1. Search codebase for references
  2. Check GitHub Actions workflows
  3. Check documentation
  4. Confirm with team

## Testing Strategy

After script changes:

```bash
# Test package verification
./scripts/verify-packages.sh

# Test API smoke tests
./scripts/smoke-api.sh

# Test Node.js setup
./scripts/bootstrap-node.sh

# Test GitHub token (requires GITHUB_TOKEN in .env)
node scripts/test-github-token.js
```

## References

- [Express Migration Matrix](./EXPRESS_MIGRATION_MATRIX.md)
- [Architecture Documentation](./architecture.md)
- [Environment Variables](./ENVIRONMENT_VARIABLES.md)
