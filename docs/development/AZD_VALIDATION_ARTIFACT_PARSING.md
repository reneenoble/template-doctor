# AZD Validation Artifact Parsing Implementation Plan

**Created:** 2025-10-08  
**Status:** Ready for Implementation  
**Priority:** CRITICAL - Demo TODAY  
**Branch:** `feat/improve-azd-validation`

---

## 🎯 Problem Statement

**THE ACTUAL PAIN WE'RE SOLVING:**

Template Doctor's AZD validation is the **STAR FEATURE**, but currently:

- ❌ **Wrong Data Source**: Parses workflow logs instead of resultFile artifact
- ❌ **Incorrect Parsing**: Looks for "SUCCESS: Your up workflow..." text that doesn't exist in logs
- ❌ **False Failures**: Validation fails when workflow has unrelated errors (e.g., GitHub API rate limits)
- ❌ **No Warning State**: Can't distinguish between AZD failures and PSRule warnings

**What We Need:**

Template Doctor should **ONLY** consider validation failed if:
1. `azd up` fails, OR
2. `azd down` fails

PSRule warnings or unrelated workflow issues should show as **WARNING** state, not failure.

---

## 📊 Current State Analysis

### What's Working ✅

- Express backend dispatches `validation-template.yml` workflow
- Workflow uses `microsoft/template-validation-action@Latest`
- Action outputs **resultFile artifact** with markdown results
- Frontend polls `/api/v4/validation-status` for workflow status
- UI shows GitHub run link with animated timer
- Troubleshooting tips display correctly

### What's Broken ❌

**File:** `packages/app/src/scripts/azd-validation.ts` (lines 27-68)

```typescript
// WRONG APPROACH - This parses logs, not artifact
function parseAzdResults(logs: string): { success: boolean; details: string } {
  // Looking for: "SUCCESS: Your up workflow to provision..."
  // But this text is in action's Python code, NOT in logs!
  const successPattern = /SUCCESS: Your up workflow to provision/i;
  const failurePattern = /FAILED: Your up workflow/i;
  // ...
}
```

**Problem:** The success/failure messages are in the template-validation-action's Python source code, not in the actual workflow logs that get captured.

---

## 🏗️ Architecture: Correct Data Flow

```
┌─────────────┐
│  Frontend   │ Triggers validation
│  (Vite)     │────────────────────────┐
└─────────────┘                        │
                                       ▼
                              ┌────────────────┐
                              │ Express Server │
                              │ /api/v4/       │
                              │ validate-      │
                              │ template       │
                              └────────┬───────┘
                                       │
                                       ▼
                              ┌────────────────┐
                              │ GitHub API     │
                              │ Dispatch       │
                              │ Workflow       │
                              └────────┬───────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │ .github/workflows/               │
                    │ validation-template.yml          │
                    │                                  │
                    │ Uses: microsoft/template-        │
                    │       validation-action@Latest   │
                    └──────────┬───────────────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │ Action Outputs:          │
                    │ - resultFile (markdown)  │◄─── AUTHORITATIVE SOURCE
                    │ - Uploaded as artifact   │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │ Frontend Polls:          │
                    │ /api/v4/validation-      │
                    │ status                   │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │ Express Downloads        │
                    │ Artifact ZIP             │◄─── NEW IMPLEMENTATION
                    │ Parses Markdown          │
                    │ Returns Structured Data  │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │ Frontend Displays        │
                    │ Accurate Status          │
                    └──────────────────────────┘
```

---

## 📝 ResultFile Artifact Format

The `resultFile` is a **markdown file** uploaded as a GitHub Actions artifact with this structure:

```markdown
# AI Gallery Standard Validation: CONFORMING/NON-CONFORMING

## Functional Requirements:
- [x] azd up          ← SUCCESS (we parse this)
- [ ] :x: azd up      ← FAILURE (we parse this)
- [x] azd down        ← SUCCESS (we parse this)
- [ ] :x: azd down    ← FAILURE (we parse this)

## Security Requirements:
- [x] Security Scan                    ← PASS
- :warning: Security Scan              ← WARNINGS (we parse this)
  - [ ] :x: Rule1 (Error1)             ← ERRORS (we parse this)
    Do this
    reference: http://example.com
```

**Parsing Rules:**

1. **AZD Up Success:** `- [x] azd up` OR `:white_check_mark: azd up`
2. **AZD Up Failure:** `- [ ] :x: azd up`
3. **AZD Down Success:** `- [x] azd down` OR `:white_check_mark: azd down`
4. **AZD Down Failure:** `- [ ] :x: azd down`
5. **PSRule Warnings:** Count `:warning:` occurrences
6. **PSRule Errors:** Count `- [ ] :x:` under Security Requirements

---

## 🎨 Three-State Validation Logic

```typescript
if (azdUpSuccess && azdDownSuccess) {
  if (psRuleErrors === 0) {
    overallStatus = psRuleWarnings > 0 ? 'warning' : 'success';
    // ✅ GREEN or ⚠️ YELLOW
  } else {
    overallStatus = 'failure';
    // ❌ RED (PSRule errors)
  }
} else {
  overallStatus = 'failure';
  // ❌ RED (AZD Up/Down failed)
}
```

**States:**

1. **✅ SUCCESS (Green):**
   - `azd up` ✓
   - `azd down` ✓
   - No PSRule errors
   - No PSRule warnings

2. **⚠️ WARNING (Yellow):**
   - `azd up` ✓
   - `azd down` ✓
   - No PSRule errors
   - Has PSRule warnings OR workflow had unrelated failures

3. **❌ FAILURE (Red):**
   - `azd up` ✗ OR `azd down` ✗
   - OR has PSRule errors

---

## 📦 Implementation Phases

### Phase 1: Backend - Artifact Download & Parsing

**File:** `packages/server/src/routes/validation.ts`

**Dependencies to Install:**

```bash
cd packages/server
npm install adm-zip
```

**Changes to `/api/v4/validation-status` endpoint:**

1. After fetching workflow run status (existing code around line 430)
2. Check if `data.status === 'completed'`
3. Fetch artifacts list from GitHub API
4. Find artifact matching pattern: `*-validation-result`
5. Download artifact ZIP
6. Extract markdown file from ZIP
7. Parse markdown for AZD Up/Down/PSRule status
8. Add `azdValidation` object to response

**New Helper Functions to Add:**

```typescript
import AdmZip from 'adm-zip';

/**
 * Downloads and extracts the validation result artifact
 */
async function downloadValidationArtifact(
    owner: string,
    repo: string,
    runId: number,
    token: string
): Promise<string | null> {
    try {
        // 1. Fetch artifacts list
        const artifactsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`;
        const artifactsResponse = await fetch(artifactsUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
            },
        });

        if (!artifactsResponse.ok) {
            console.error('Failed to fetch artifacts list', {
                status: artifactsResponse.status,
            });
            return null;
        }

        const artifactsData = await artifactsResponse.json();
        
        // 2. Find validation result artifact
        const validationArtifact = artifactsData.artifacts?.find((a: any) =>
            a.name.endsWith('-validation-result')
        );

        if (!validationArtifact) {
            console.log('No validation result artifact found');
            return null;
        }

        // 3. Download artifact ZIP
        const downloadUrl = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${validationArtifact.id}/zip`;
        const downloadResponse = await fetch(downloadUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
            },
        });

        if (!downloadResponse.ok) {
            console.error('Failed to download artifact', {
                status: downloadResponse.status,
            });
            return null;
        }

        // 4. Extract markdown from ZIP
        const buffer = Buffer.from(await downloadResponse.arrayBuffer());
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();

        // Find the markdown file (should be only file in zip)
        const markdownEntry = zipEntries.find(
            (entry) => entry.entryName.endsWith('.md') && !entry.isDirectory
        );

        if (!markdownEntry) {
            console.error('No markdown file found in artifact ZIP');
            return null;
        }

        return markdownEntry.getData().toString('utf8');
    } catch (error) {
        console.error('Error downloading artifact', { error });
        return null;
    }
}

/**
 * Parses the validation result markdown file
 */
interface AzdValidationResult {
    azdUpSuccess: boolean;
    azdUpTime: string | null;
    azdDownSuccess: boolean;
    azdDownTime: string | null;
    psRuleErrors: number;
    psRuleWarnings: number;
    securityStatus: 'pass' | 'warnings' | 'errors';
    overallStatus: 'success' | 'warning' | 'failure';
    resultFileContent: string;
}

function parseAzdValidationResult(markdown: string): AzdValidationResult {
    // Parse AZD Up status
    const azdUpSuccess =
        /- \[x\] azd up/i.test(markdown) ||
        /:white_check_mark: azd up/i.test(markdown);

    // Parse AZD Down status
    const azdDownSuccess =
        /- \[x\] azd down/i.test(markdown) ||
        /:white_check_mark: azd down/i.test(markdown);

    // Extract execution times (if available)
    const azdUpTime = markdown.match(/azd up.*\(([\d.]+s)\)/)?.[1] || null;
    const azdDownTime = markdown.match(/azd down.*\(([\d.]+s)\)/)?.[1] || null;

    // Count PSRule warnings and errors
    const psRuleWarnings = (markdown.match(/:warning:/g) || []).length;
    
    // Count errors under Security Requirements section
    const securitySection = markdown.split('## Security Requirements')[1] || '';
    const psRuleErrors = (securitySection.match(/- \[ \] :x:/g) || []).length;

    // Determine security status
    let securityStatus: 'pass' | 'warnings' | 'errors';
    if (psRuleErrors > 0) {
        securityStatus = 'errors';
    } else if (psRuleWarnings > 0) {
        securityStatus = 'warnings';
    } else {
        securityStatus = 'pass';
    }

    // Determine overall status (three-state logic)
    let overallStatus: 'success' | 'warning' | 'failure';
    if (azdUpSuccess && azdDownSuccess) {
        if (psRuleErrors === 0) {
            overallStatus = psRuleWarnings > 0 ? 'warning' : 'success';
        } else {
            overallStatus = 'failure'; // PSRule errors = failure
        }
    } else {
        overallStatus = 'failure'; // AZD Up/Down failed = failure
    }

    return {
        azdUpSuccess,
        azdUpTime,
        azdDownSuccess,
        azdDownTime,
        psRuleErrors,
        psRuleWarnings,
        securityStatus,
        overallStatus,
        resultFileContent: markdown,
    };
}
```

**Integration into validation-status endpoint:**

Around line 480 (after fetching workflow run data), add:

```typescript
// Existing code fetches workflow run...
const data = await response.json();

// Existing code fetches jobs...
let jobs: any[] = [];
let failedJobs: any[] = [];
let errorSummary = "";

if (data.status === "completed" && data.conclusion === "failure") {
    // ... existing job fetching code ...
}

// NEW: Fetch and parse artifact if workflow completed
let azdValidation: AzdValidationResult | null = null;
if (data.status === 'completed') {
    const artifactContent = await downloadValidationArtifact(
        owner,
        repo,
        runIdToCheck,
        token
    );

    if (artifactContent) {
        azdValidation = parseAzdValidationResult(artifactContent);
        console.log('validation-status parsed artifact', {
            requestId,
            overallStatus: azdValidation.overallStatus,
            azdUpSuccess: azdValidation.azdUpSuccess,
            azdDownSuccess: azdValidation.azdDownSuccess,
        });
    }
}

// Update response to include azdValidation
res.json({
    status: data.status,
    conclusion: data.conclusion,
    html_url: data.html_url,
    created_at: data.created_at,
    updated_at: data.updated_at,
    jobs: jobs.map((job: any) => ({
        id: job.id,
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
        html_url: job.html_url,
        started_at: job.started_at,
        completed_at: job.completed_at,
    })),
    failedJobs: failedJobs.map((job: any) => ({
        id: job.id,
        name: job.name,
        conclusion: job.conclusion,
        html_url: job.html_url,
        failedSteps: (job.steps || [])
            .filter((step: any) => step.conclusion === "failure")
            .map((step: any) => ({
                name: step.name,
                conclusion: step.conclusion,
                number: step.number,
            })),
    })),
    errorSummary,
    azdValidation, // NEW: Add parsed validation data
    requestId,
});
```

---

### Phase 2: Frontend - Use Artifact Data

**File:** `packages/app/src/scripts/azd-validation.ts`

**Changes Required:**

1. **Remove `parseAzdResults()` function** (lines 27-68) - This is the broken log parsing
2. **Update `pollValidationStatus()`** to use `azdValidation` from API response
3. **Add new display logic** for three-state validation

**TypeScript Interface to Add:**

```typescript
interface AzdValidationResult {
    azdUpSuccess: boolean;
    azdUpTime: string | null;
    azdDownSuccess: boolean;
    azdDownTime: string | null;
    psRuleErrors: number;
    psRuleWarnings: number;
    securityStatus: 'pass' | 'warnings' | 'errors';
    overallStatus: 'success' | 'warning' | 'failure';
    resultFileContent: string;
}
```

**Replace `parseAzdResults()` with:**

```typescript
/**
 * Displays AZD validation results from artifact data
 */
function displayAzdValidationResults(
    container: HTMLElement,
    azdValidation: AzdValidationResult,
    githubRunUrl: string
): void {
    const statusIcon = {
        success: '✅',
        warning: '⚠️',
        failure: '❌',
    }[azdValidation.overallStatus];

    const statusClass = {
        success: 'validation-success',
        warning: 'validation-warning',
        failure: 'validation-failure',
    }[azdValidation.overallStatus];

    const statusMessage = {
        success: 'Template validation passed',
        warning: 'Template validation passed with warnings',
        failure: 'Template validation failed',
    }[azdValidation.overallStatus];

    // Build details HTML
    const azdUpIcon = azdValidation.azdUpSuccess ? '✅' : '❌';
    const azdDownIcon = azdValidation.azdDownSuccess ? '✅' : '❌';
    const azdUpTime = azdValidation.azdUpTime ? ` (${azdValidation.azdUpTime})` : '';
    const azdDownTime = azdValidation.azdDownTime ? ` (${azdValidation.azdDownTime})` : '';

    let securityLine = '';
    if (azdValidation.securityStatus === 'pass') {
        securityLine = '✅ Security Scan passed';
    } else if (azdValidation.securityStatus === 'warnings') {
        securityLine = `⚠️ Security Scan: ${azdValidation.psRuleWarnings} warnings`;
    } else {
        securityLine = `❌ Security Scan: ${azdValidation.psRuleErrors} errors`;
    }

    container.innerHTML = `
        <div class="validation-result ${statusClass}">
            <div class="validation-header">
                <span class="validation-icon">${statusIcon}</span>
                <span class="validation-message">${statusMessage}</span>
            </div>
            <div class="validation-details">
                <div class="validation-step">
                    <span class="step-icon">${azdUpIcon}</span>
                    <span class="step-name">AZD Up${azdUpTime}</span>
                </div>
                <div class="validation-step">
                    <span class="step-icon">${azdDownIcon}</span>
                    <span class="step-name">AZD Down${azdDownTime}</span>
                </div>
                <div class="validation-step">
                    <span class="step-text">${securityLine}</span>
                </div>
            </div>
            <div class="validation-actions">
                <a href="${githubRunUrl}" target="_blank" class="btn-view-logs">
                    View Full Logs
                </a>
            </div>
        </div>
    `;
}
```

**Update `pollValidationStatus()` function:**

Around line 606-750, find where it handles the status response and replace the result display logic:

```typescript
// Inside pollValidationStatus(), after receiving statusData:
if (statusData.status === 'completed') {
    clearInterval(pollInterval);
    
    // Check if we have artifact data
    if (statusData.azdValidation) {
        // Use artifact-based validation results
        displayAzdValidationResults(
            resultContainer,
            statusData.azdValidation,
            statusData.html_url
        );
    } else {
        // Fallback: artifact not yet available or workflow too old
        // Show workflow conclusion
        const conclusion = statusData.conclusion || 'unknown';
        resultContainer.innerHTML = `
            <div class="validation-result validation-${conclusion}">
                <p>Workflow ${conclusion}</p>
                <p>⚠️ Detailed validation results not available. 
                   <a href="${statusData.html_url}" target="_blank">View workflow logs</a>
                </p>
            </div>
        `;
    }
}
```

**CSS to Add (in appropriate stylesheet):**

```css
.validation-result {
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
    border: 2px solid;
}

.validation-success {
    background-color: rgba(0, 255, 0, 0.1);
    border-color: #00ff00;
    color: white;
}

.validation-warning {
    background-color: rgba(255, 255, 0, 0.1);
    border-color: #ffff00;
    color: white;
}

.validation-failure {
    background-color: rgba(255, 0, 0, 0.1);
    border-color: #ff0000;
    color: white;
}

.validation-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.2em;
    font-weight: bold;
    margin-bottom: 15px;
}

.validation-icon {
    font-size: 1.5em;
}

.validation-details {
    margin: 15px 0;
    padding-left: 20px;
}

.validation-step {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 8px 0;
    font-size: 1.1em;
}

.step-icon {
    font-size: 1.2em;
    min-width: 30px;
}

.validation-actions {
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid rgba(255, 255, 255, 0.3);
}

.btn-view-logs {
    display: inline-block;
    padding: 8px 16px;
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    color: white;
    text-decoration: none;
    transition: background-color 0.2s;
}

.btn-view-logs:hover {
    background-color: rgba(255, 255, 255, 0.2);
}
```

---

### Phase 3: Schema Extension

**File:** `schemas/results.schema.json`

**Add to root level properties:**

```json
{
  "azdValidation": {
    "type": "object",
    "description": "AZD template validation results from artifact parsing",
    "properties": {
      "azdUpSuccess": {
        "type": "boolean",
        "description": "Whether 'azd up' command succeeded"
      },
      "azdUpTime": {
        "type": ["string", "null"],
        "description": "Execution time for 'azd up' command (e.g., '45.2s')"
      },
      "azdDownSuccess": {
        "type": "boolean",
        "description": "Whether 'azd down' command succeeded"
      },
      "azdDownTime": {
        "type": ["string", "null"],
        "description": "Execution time for 'azd down' command (e.g., '12.3s')"
      },
      "psRuleErrors": {
        "type": "number",
        "description": "Number of PSRule security errors found"
      },
      "psRuleWarnings": {
        "type": "number",
        "description": "Number of PSRule security warnings found"
      },
      "securityStatus": {
        "type": "string",
        "enum": ["pass", "warnings", "errors"],
        "description": "Overall security scan status"
      },
      "overallStatus": {
        "type": "string",
        "enum": ["success", "warning", "failure"],
        "description": "Overall validation status (three-state)"
      },
      "githubRunUrl": {
        "type": "string",
        "description": "URL to the GitHub workflow run"
      },
      "resultFileContent": {
        "type": "string",
        "description": "Full markdown content from the validation result artifact"
      }
    },
    "required": [
      "azdUpSuccess",
      "azdDownSuccess",
      "psRuleErrors",
      "psRuleWarnings",
      "securityStatus",
      "overallStatus"
    ]
  }
}
```

---

### Phase 4: Validation Badge on Tiles

**Files to Update:**
- `packages/app/src/scripts/templates-loader.ts` (or wherever template tiles are rendered)

**Add badge HTML:**

```typescript
function createValidationBadge(validation: AzdValidationResult | null): string {
    if (!validation) {
        return '<span class="validation-badge badge-unknown">Not Validated</span>';
    }

    const badgeClass = {
        success: 'badge-success',
        warning: 'badge-warning',
        failure: 'badge-failure',
    }[validation.overallStatus];

    const badgeText = {
        success: '✅ Validated',
        warning: '⚠️ Warnings',
        failure: '❌ Failed',
    }[validation.overallStatus];

    return `<span class="validation-badge ${badgeClass}">${badgeText}</span>`;
}
```

**CSS for badges:**

```css
.validation-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.85em;
    font-weight: bold;
    margin-left: 8px;
}

.badge-success {
    background-color: rgba(0, 255, 0, 0.2);
    border: 1px solid #00ff00;
    color: #00ff00;
}

.badge-warning {
    background-color: rgba(255, 255, 0, 0.2);
    border: 1px solid #ffff00;
    color: #ffff00;
}

.badge-failure {
    background-color: rgba(255, 0, 0, 0.2);
    border: 1px solid #ff0000;
    color: #ff0000;
}

.badge-unknown {
    background-color: rgba(128, 128, 128, 0.2);
    border: 1px solid #808080;
    color: #808080;
}
```

---

## 🧪 Testing Strategy

### 1. Unit Tests

**File:** `packages/server/tests/validation.spec.ts` (create if doesn't exist)

```typescript
import { describe, it, expect } from 'vitest';
import { parseAzdValidationResult } from '../src/routes/validation';

describe('parseAzdValidationResult', () => {
    it('should parse successful validation with no warnings', () => {
        const markdown = `
# AI Gallery Standard Validation: CONFORMING

## Functional Requirements:
- [x] azd up (45.2s)
- [x] azd down (12.3s)

## Security Requirements:
- [x] Security Scan
`;
        const result = parseAzdValidationResult(markdown);
        expect(result.azdUpSuccess).toBe(true);
        expect(result.azdDownSuccess).toBe(true);
        expect(result.overallStatus).toBe('success');
        expect(result.psRuleWarnings).toBe(0);
        expect(result.psRuleErrors).toBe(0);
    });

    it('should parse validation with warnings', () => {
        const markdown = `
# AI Gallery Standard Validation: CONFORMING

## Functional Requirements:
- [x] azd up
- [x] azd down

## Security Requirements:
- :warning: Security Scan
  - PSRule warning 1
`;
        const result = parseAzdValidationResult(markdown);
        expect(result.azdUpSuccess).toBe(true);
        expect(result.azdDownSuccess).toBe(true);
        expect(result.overallStatus).toBe('warning');
        expect(result.psRuleWarnings).toBeGreaterThan(0);
    });

    it('should parse failed azd up', () => {
        const markdown = `
# AI Gallery Standard Validation: NON-CONFORMING

## Functional Requirements:
- [ ] :x: azd up
- [x] azd down

## Security Requirements:
- [x] Security Scan
`;
        const result = parseAzdValidationResult(markdown);
        expect(result.azdUpSuccess).toBe(false);
        expect(result.azdDownSuccess).toBe(true);
        expect(result.overallStatus).toBe('failure');
    });

    it('should parse PSRule errors', () => {
        const markdown = `
# AI Gallery Standard Validation: NON-CONFORMING

## Functional Requirements:
- [x] azd up
- [x] azd down

## Security Requirements:
- :x: Security Scan
  - [ ] :x: Rule violation 1
  - [ ] :x: Rule violation 2
`;
        const result = parseAzdValidationResult(markdown);
        expect(result.azdUpSuccess).toBe(true);
        expect(result.azdDownSuccess).toBe(true);
        expect(result.psRuleErrors).toBe(2);
        expect(result.overallStatus).toBe('failure');
    });
});
```

### 2. Integration Tests

**Test with real workflow run:**

```bash
# Get a real workflow run ID from GitHub
RUN_ID=1234567890

# Test validation-status endpoint
curl -X GET "http://localhost:3001/api/v4/validation-status?workflowOrgRepo=Template-Doctor/template-doctor&workflowRunId=$RUN_ID"
```

### 3. Smoke Tests

```bash
# Run API smoke tests
./scripts/smoke-api.sh

# Should test:
# - POST /api/v4/validate-template (trigger)
# - GET /api/v4/validation-status (with artifact parsing)
# - Artifact download and parsing
```

### 4. Manual Testing Checklist

- [ ] Trigger validation on a known good template
- [ ] Verify artifact gets downloaded and parsed
- [ ] Check all three states display correctly:
  - [ ] Success (green ✅)
  - [ ] Warning (yellow ⚠️)
  - [ ] Failure (red ❌)
- [ ] Verify execution times display if available
- [ ] Test with template that has PSRule warnings
- [ ] Test with template that fails azd up
- [ ] Verify GitHub run link works
- [ ] Check mobile responsiveness

---

## 📊 Success Criteria

### Must Have (Critical for Demo)

- ✅ AZD validation only fails if `azd up` OR `azd down` fails
- ✅ PSRule warnings show as "warning" state (yellow), NOT failure
- ✅ Workflow failures unrelated to AZD don't affect AZD status
- ✅ Accurate status display for demo template
- ✅ No false failures wasting GitHub Actions minutes

### Should Have

- ✅ Display execution times (e.g., "azd up (45.2s)")
- ✅ Show PSRule warning/error counts
- ✅ Link to full GitHub workflow logs
- ✅ Validation badges on template tiles

### Nice to Have

- ⏸️ Cache artifact content to avoid re-downloading
- ⏸️ Store validation results in database for historical tracking
- ⏸️ Validation status API that doesn't require polling

---

## 🚨 Known Risks & Mitigations

### Risk 1: Artifact Not Available Immediately
**Impact:** Medium  
**Likelihood:** Low  
**Mitigation:** Add retry logic with exponential backoff; show "Processing..." state

### Risk 2: Markdown Format Changes
**Impact:** High  
**Likelihood:** Low  
**Mitigation:** Use flexible regex patterns; log raw markdown for debugging; version check

### Risk 3: ZIP Extraction Failures
**Impact:** Medium  
**Likelihood:** Low  
**Mitigation:** Proper error handling; fallback to workflow conclusion; log errors

### Risk 4: GitHub API Rate Limits
**Impact:** Low  
**Likelihood:** Very Low  
**Mitigation:** Use authenticated requests; implement caching; monitor usage

---

## 📅 Timeline

**Total Estimated Time:** 3.5-4.5 hours

- **Phase 1 (Backend):** 1-2 hours
  - Install dependencies: 5 min
  - Add artifact download: 30 min
  - Add markdown parsing: 30 min
  - Integration & testing: 30-60 min

- **Phase 2 (Frontend):** 1 hour
  - Remove old parsing: 10 min
  - Add new display logic: 30 min
  - CSS styling: 20 min

- **Phase 3 (Schema):** 30 minutes
  - Update schema: 10 min
  - Generate TypeScript types: 10 min
  - Update docs: 10 min

- **Phase 4 (Badges):** 1 hour
  - Add badge component: 30 min
  - Styling: 15 min
  - Integration: 15 min

**Buffer:** 1 hour for unexpected issues

**DEMO READINESS:** Should complete in 4-5 hours with testing

---

## 🔄 Rollback Plan

If implementation fails or introduces bugs:

1. **Immediate Rollback:**
   ```bash
   git reset --hard HEAD~1
   docker-compose down
   docker-compose up --build
   ```

2. **Partial Rollback (Backend Only):**
   - Keep frontend changes (they're improvements anyway)
   - Revert backend artifact parsing
   - Frontend falls back to workflow conclusion

3. **Feature Flag (If Time Permits):**
   ```typescript
   const USE_ARTIFACT_PARSING = process.env.ENABLE_ARTIFACT_PARSING === 'true';
   ```

---

## 📚 References

- **AGENTS.md:** Primary architecture reference
- **EXPRESS_MIGRATION_MATRIX.md:** Migration tracking (20/20 complete)
- **GitHub Workflow:** `.github/workflows/validation-template.yml`
- **Template Validation Action:** `microsoft/template-validation-action@Latest`
- **Express Validation Route:** `packages/server/src/routes/validation.ts`
- **Frontend Validation:** `packages/app/src/scripts/azd-validation.ts`

---

## ✅ Implementation Checklist

### Phase 1: Backend
- [ ] Install `adm-zip` dependency
- [ ] Add `downloadValidationArtifact()` function
- [ ] Add `parseAzdValidationResult()` function
- [ ] Add TypeScript interface for `AzdValidationResult`
- [ ] Integrate into `/api/v4/validation-status` endpoint
- [ ] Add error handling and logging
- [ ] Test artifact download with real workflow run
- [ ] Verify markdown parsing with various formats

### Phase 2: Frontend
- [ ] Add TypeScript interface for `AzdValidationResult`
- [ ] Remove old `parseAzdResults()` function (lines 27-68)
- [ ] Add `displayAzdValidationResults()` function
- [ ] Update `pollValidationStatus()` to use artifact data
- [ ] Add CSS for validation result display
- [ ] Test with all three states (success/warning/failure)
- [ ] Verify mobile responsiveness

### Phase 3: Schema
- [ ] Update `schemas/results.schema.json`
- [ ] Add `azdValidation` property with all fields
- [ ] Generate TypeScript types if auto-generated
- [ ] Update documentation

### Phase 4: Badges
- [ ] Add `createValidationBadge()` function
- [ ] Integrate into template tile rendering
- [ ] Add CSS for badges
- [ ] Test badge display on leaderboard

### Testing
- [ ] Write unit tests for markdown parser
- [ ] Run smoke tests (`./scripts/smoke-api.sh`)
- [ ] Test with real templates (good, warnings, failures)
- [ ] Verify demo template shows correctly
- [ ] Check all three validation states
- [ ] Test edge cases (no artifact, old workflows, etc.)

### Deployment
- [ ] Build Docker container: `docker-compose build`
- [ ] Test locally: `docker-compose up`
- [ ] Verify at http://localhost:3000
- [ ] Run full test suite
- [ ] Commit with descriptive message
- [ ] Push to branch: `feat/improve-azd-validation`
- [ ] Create PR with testing notes
- [ ] Deploy to production after approval

---

## 🎯 Post-Implementation Verification

After deployment, verify:

1. **Trigger validation on demo template**
2. **Wait for workflow completion**
3. **Verify accurate status display:**
   - Check success case (green ✅)
   - Check warning case (yellow ⚠️)
   - Check failure case (red ❌)
4. **Verify execution times display**
5. **Verify PSRule counts are accurate**
6. **Verify GitHub run link works**
7. **Check mobile display**
8. **Verify no console errors**
9. **Test with multiple templates**
10. **Confirm no false failures**

---

## 💡 Future Enhancements

**Not for this implementation, but consider later:**

1. **Caching:** Store parsed artifact data to avoid re-downloading
2. **Database:** Save validation history for trends
3. **Webhooks:** Use callback to avoid polling
4. **Notifications:** Alert on validation failures
5. **Comparison:** Show validation changes over time
6. **Advanced Parsing:** Extract specific PSRule violations
7. **Performance Metrics:** Track azd up/down times
8. **Cost Tracking:** Show GitHub Actions minutes used

---

**END OF IMPLEMENTATION PLAN**

**Status:** Ready for implementation  
**Next Step:** Restart VS Code terminal and begin Phase 1  
**Contact:** See main README for questions

---
