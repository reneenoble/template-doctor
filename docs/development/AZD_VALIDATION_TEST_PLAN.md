# AZD Validation Test Plan

## Overview

Comprehensive testing plan for AZD validation feature improvements including artifact parsing, GraphQL issue creation, and UX enhancements.

## Test Coverage

### 1. E2E Tests (Playwright)

**File**: `packages/app/tests/azd-validation.spec.js`

#### UI Components

- [ ] Spinner animation displays (fa-spinner fa-spin)
- [ ] Warning text readable (#4e3a16 on yellow background)
- [ ] Troubleshooting tips appear immediately
- [ ] UnmatchedPrincipalType tip highlights when error detected
- [ ] Final elapsed time shows clock icon (not spinner)

#### Validation Results Display

- [ ] Success status (✅ green) displays correctly
- [ ] Warning status (⚠️ yellow) displays correctly
- [ ] Failure status (❌ red) displays correctly
- [ ] AZD Up/Down execution times shown
- [ ] PSRule error/warning counts displayed
- [ ] Collapsible details panel works
- [ ] View Full Logs button links to GitHub

#### GraphQL Issue Creation

- [ ] Loading notification appears when creating issue
- [ ] GraphQL mutation called (not URL form)
- [ ] Copilot auto-assigned via assigneeIds
- [ ] Success notification shows issue number
- [ ] Issue opens in new tab
- [ ] Validation errors extracted from markdown (not workflow)
- [ ] Security scan errors included in issue body
- [ ] Fallback to URL form if GraphQL fails
- [ ] Error notification on GraphQL failure

### 2. Unit Tests (Vitest)

**File**: `packages/server/tests/validation-artifact-parsing.test.ts`

#### Markdown Parsing

- [ ] Parse successful validation (no warnings)
- [ ] Parse validation with warnings
- [ ] Parse validation with security errors
- [ ] Parse failed AZD Up
- [ ] Parse AZD Up success but Down failure
- [ ] Handle security scan failure marker
- [ ] Count warnings outside security section
- [ ] Handle mixed warnings and errors
- [ ] Extract execution times from various formats
- [ ] Case-insensitive command matching

#### Error Extraction

- [ ] Extract deployment failures with regex
- [ ] Extract security section content
- [ ] Handle missing security section
- [ ] Parse multiple failure types

#### Artifact Download (Integration)

- [ ] Handle missing artifact (return null)
- [ ] Download and extract ZIP correctly
- [ ] Find .md file in ZIP
- [ ] Fallback to .log file if .md missing
- [ ] Handle ZIP extraction errors
- [ ] Handle network errors gracefully

### 3. CSS Visual Tests

**File**: `packages/app/tests/azd-validation.spec.js` (CSS section)

- [ ] .validation-warning color is rgb(78, 58, 22)
- [ ] .validation-success has green background (#107c10)
- [ ] .validation-failure has red background (#d83b01)
- [ ] .validation-details panel styled correctly
- [ ] Spinner animation visible during progress
- [ ] Clock icon visible on completion

## Manual Testing Checklist

### Before Testing

- [ ] Docker container running (`docker-compose up`)
- [ ] OAuth configured (GitHub app credentials in .env)
- [ ] GitHub token has repo access
- [ ] Test repository has validation workflow

### Validation Flow

1. [ ] Login via GitHub OAuth
2. [ ] Search for a repository with azd template
3. [ ] Click "Validate" button
4. [ ] Verify spinner appears immediately
5. [ ] Verify troubleshooting tips show (Region, UnmatchedPrincipal, BCP332)
6. [ ] Wait for workflow completion
7. [ ] Verify validation results display with artifact data
8. [ ] Check AZD Up/Down times displayed
9. [ ] Check security scan status
10. [ ] Expand collapsible details panel
11. [ ] Verify markdown content visible

### Issue Creation Flow

1. [ ] Trigger validation on template with errors
2. [ ] Wait for failure
3. [ ] Click "🐛 Create GitHub Issue" button
4. [ ] Verify loading notification: "Creating GitHub issue and assigning to Copilot..."
5. [ ] Wait for completion (network call ~1-2s)
6. [ ] Verify success notification: "Issue #X created and assigned to Copilot"
7. [ ] Verify new tab opens with issue
8. [ ] Check issue body contains validation errors (not workflow errors)
9. [ ] Check Copilot assigned (if available in repo)
10. [ ] Verify issue labels: bug, azd-validation

### Error Scenarios

1. [ ] GraphQL fails → fallback to URL form
2. [ ] Network timeout → error notification
3. [ ] Artifact not yet available → shows "Detailed validation results not available"
4. [ ] Workflow cancelled → shows "Validation cancelled"

## Test Data

### Sample Successful Validation Response

```json
{
    "status": "completed",
    "conclusion": "success",
    "html_url": "https://github.com/test/repo/actions/runs/123",
    "azdValidation": {
        "azdUpSuccess": true,
        "azdUpTime": "45.2s",
        "azdDownSuccess": true,
        "azdDownTime": "30.1s",
        "psRuleErrors": 0,
        "psRuleWarnings": 0,
        "securityStatus": "pass",
        "overallStatus": "success",
        "resultFileContent": "..."
    }
}
```

### Sample Warning Response

```json
{
    "azdValidation": {
        "azdUpSuccess": true,
        "azdDownSuccess": true,
        "psRuleErrors": 0,
        "psRuleWarnings": 3,
        "securityStatus": "warnings",
        "overallStatus": "warning"
    }
}
```

### Sample Failure Response

```json
{
    "azdValidation": {
        "azdUpSuccess": false,
        "azdDownSuccess": false,
        "psRuleErrors": 5,
        "psRuleWarnings": 2,
        "securityStatus": "errors",
        "overallStatus": "failure",
        "resultFileContent": "(x) Failed: Region not available\n## Security Requirements:\n- [ ] :x: Missing TLS"
    }
}
```

## CI/CD Integration

### Automated Test Runs

- [ ] E2E tests run on PR
- [ ] Unit tests run on PR
- [ ] Smoke tests pass (`./scripts/smoke-api.sh`)
- [ ] Build succeeds (no TypeScript errors)
- [ ] Docker image builds successfully

### GitHub Actions Workflow

Add to `.github/workflows/test.yml`:

```yaml
- name: Run AZD Validation Tests
  run: npm run test -- -g "AZD Validation"

- name: Run Artifact Parsing Tests
  run: npm run test -- validation-artifact-parsing
```

## Performance Benchmarks

### Expected Timings

- Spinner appears: < 100ms
- Troubleshooting tips render: < 200ms
- Artifact download: 1-3s (depends on workflow)
- Artifact parsing: < 100ms
- GraphQL issue creation: 1-2s
- Total validation time: 5-15 minutes (workflow-dependent)

### Optimization Targets

- Frontend rendering: < 500ms total
- Backend artifact fetch: < 5s
- GraphQL mutation: < 3s
- Issue creation end-to-end: < 5s

## Known Issues & Limitations

### Artifact Availability

- Artifacts may not be available immediately after workflow completion
- Backend returns `azdValidation: null` if artifact not found
- Frontend shows fallback message with link to logs

### GraphQL Fallback

- If Copilot bot not found in repo, regular issue created
- Fallback to URL form if GraphQL unavailable
- User sees error notification but can still create issue manually

### Browser Compatibility

- Tested: Chrome, Firefox, Safari, Edge
- Requires ES6+ support (async/await)
- Font Awesome icons may not load in IE11 (not supported)

## Test Execution

### Run All Tests

```bash
npm test
```

### Run E2E Tests Only

```bash
npm run test -- packages/app/tests/azd-validation.spec.js
```

### Run Unit Tests Only

```bash
npm run test -- packages/server/tests/validation-artifact-parsing.test.ts
```

### Run Smoke Tests

```bash
./scripts/smoke-api.sh
```

### Debug Mode

```bash
npm run test:debug -- azd-validation
```

## Success Criteria

### Must Pass

- ✅ All E2E tests pass
- ✅ All unit tests pass
- ✅ Smoke tests pass
- ✅ No console errors in browser
- ✅ GraphQL issue creation works in production repo

### Should Pass

- ✅ No accessibility violations (WCAG AA)
- ✅ Spinner animation smooth (60fps)
- ✅ Text contrast ratio ≥ 4.5:1
- ✅ Mobile responsive (320px width minimum)

### Nice to Have

- ✅ Loading states feel responsive (< 200ms perceived)
- ✅ Error messages helpful and actionable
- ✅ Troubleshooting tips reduce support requests

## Rollback Plan

If tests fail in production:

1. Revert commit: `git revert 9383049`
2. Redeploy previous version
3. Investigate failures in staging
4. Fix and retest before redeploying

## Sign-Off

- [ ] Developer tested locally
- [ ] E2E tests passing
- [ ] Unit tests passing
- [ ] Code reviewed
- [ ] QA approved
- [ ] Product owner approved
- [ ] Ready for production deployment
