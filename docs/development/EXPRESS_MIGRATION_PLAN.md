# Express Migration Plan - Remaining 17 Functions

_Created: 2025-01-03_  
_Status: Planning Phase_

## Executive Summary

We have successfully migrated 3 of 20 Azure Functions to Express endpoints (15% complete). This document outlines a structured plan to migrate the remaining 17 functions, prioritized by business impact and technical dependencies.

## Migration Progress

### ✅ Completed (3/20)

- `/api/v4/github-oauth-token` - OAuth flow
- `/api/v4/client-settings` - Runtime configuration
- `/api/v4/analyze` - Template analysis with fork-first SAML strategy

### ⏳ Remaining (17/20)

## Priority-Based Migration Phases

### **Phase 1: Validation Workflow (6 functions)**

**Business Value:** HIGH - Core feature for template validation  
**Estimated Time:** 2-3 days  
**Dependencies:** GitHub API client, workflow dispatch

#### Functions to Migrate:

1. **`validate-template`** → `/api/v4/validate-template`
    - Triggers GitHub workflow dispatch for validation
    - Uses repository dispatch API
    - Required by all other validation endpoints
2. **`validation-status`** → `/api/v4/validation-status`
    - Polls GitHub workflow run status
    - Returns progress and completion state
3. **`validation-callback`** → `/api/v4/validation-callback`
    - Webhook endpoint for workflow completion
    - Processes validation results
4. **`validation-cancel`** → `/api/v4/validation-cancel`
    - Cancels running validation workflows
    - Cleanup logic for interrupted validations
5. **`validation-docker-image`** → `/api/v4/validation-docker-image`
    - Validates Dockerfile and image configurations
    - Checks for security best practices
6. **`validation-ossf`** → `/api/v4/validation-ossf`
    - OSSF scorecard validation
    - Security posture assessment

#### Implementation Strategy:

```typescript
// packages/server/src/routes/validation.ts
import { Router } from "express";
import { GitHubClient } from "../shared/github-client";

const router = Router();

// Validate template endpoint
router.post("/validate-template", async (req, res, next) => {
    try {
        const { repoUrl, token } = req.body;
        // Trigger GitHub workflow dispatch
        // Return workflow run ID
    } catch (error) {
        next(error);
    }
});

// Status polling endpoint
router.get("/validation-status/:runId", async (req, res, next) => {
    try {
        const { runId } = req.params;
        // Poll GitHub API for workflow status
        // Return progress/completion state
    } catch (error) {
        next(error);
    }
});

// Webhook callback
router.post("/validation-callback", async (req, res, next) => {
    try {
        // Verify webhook signature
        // Process validation results
        // Emit events to frontend
    } catch (error) {
        next(error);
    }
});

export default router;
```

---

### **Phase 2: GitHub Actions Integration (3 functions)**

**Business Value:** HIGH - Required for automated workflows  
**Estimated Time:** 1-2 days  
**Dependencies:** GitHub API client, workflow triggers

#### Functions to Migrate:

1. **`action-trigger`** → `/api/v4/action-trigger`
    - Triggers GitHub Actions workflows
    - Generic workflow dispatch
2. **`action-run-status`** → `/api/v4/action-run-status`
    - Polls GitHub Actions run status
    - Similar to validation-status but for general actions
3. **`action-run-artifacts`** → `/api/v4/action-run-artifacts`
    - Retrieves workflow artifacts
    - Downloads and exposes artifact URLs

#### Implementation Strategy:

```typescript
// packages/server/src/routes/actions.ts
import { Router } from "express";
import { Octokit } from "@octokit/rest";

const router = Router();

router.post("/action-trigger", async (req, res, next) => {
    try {
        const { repo, workflow, inputs, token } = req.body;
        // Trigger workflow dispatch
        // Return run ID
    } catch (error) {
        next(error);
    }
});

router.get("/action-run-status/:owner/:repo/:runId", async (req, res, next) => {
    try {
        // Poll run status
        // Return status, conclusion, logs
    } catch (error) {
        next(error);
    }
});

router.get(
    "/action-run-artifacts/:owner/:repo/:runId",
    async (req, res, next) => {
        try {
            // List artifacts
            // Return artifact URLs
        } catch (error) {
            next(error);
        }
    },
);

export default router;
```

---

### **Phase 3: Analysis & Submission (3 functions)**

**Business Value:** MEDIUM-HIGH - Automated PR creation  
**Estimated Time:** 2 days  
**Dependencies:** GitHub API client, template rendering

#### Functions to Migrate:

1. **`submit-analysis-dispatch`** → `/api/v4/submit-analysis-dispatch`
    - Dispatches workflow to submit analysis results
    - Triggers PR creation workflow
2. **`add-template-pr`** → `/api/v4/add-template-pr`
    - Creates PR with analysis dashboard
    - Generates HTML dashboard from template
    - Commits results files
3. **`archive-collection`** → `/api/v4/archive-collection`
    - Archives scan metadata to central repo
    - Maintains historical scan index

#### Implementation Strategy:

```typescript
// packages/server/src/routes/submission.ts
import { Router } from "express";
import { generateDashboard } from "../shared/dashboard-generator";

const router = Router();

router.post("/submit-analysis-dispatch", async (req, res, next) => {
    try {
        const { repoUrl, analysisData, token } = req.body;
        // Dispatch workflow
    } catch (error) {
        next(error);
    }
});

router.post("/add-template-pr", async (req, res, next) => {
    try {
        const { repoUrl, analysisData, token } = req.body;
        // Generate dashboard HTML
        // Create branch
        // Commit files
        // Open PR
    } catch (error) {
        next(error);
    }
});

router.post("/archive-collection", async (req, res, next) => {
    try {
        const { metadata, token } = req.body;
        // Archive to central repo
    } catch (error) {
        next(error);
    }
});

export default router;
```

---

### **Phase 4: Repository Management (2 functions)**

**Business Value:** MEDIUM - SAML/SSO support  
**Estimated Time:** 1 day  
**Dependencies:** GitHub API client

#### Functions to Migrate:

1. **`repo-fork`** → `/api/v4/repo-fork`
    - Creates fork for SAML-protected repos
    - Handles fork creation and sync
2. **`batch-scan-start`** → `/api/v4/batch-scan-start`
    - Initiates batch scanning operations
    - Queues multiple repository analyses

#### Implementation Strategy:

```typescript
// packages/server/src/routes/repository.ts
import { Router } from "express";

const router = Router();

router.post("/repo-fork", async (req, res, next) => {
    try {
        const { repoUrl, token } = req.body;
        // Create fork
        // Wait for fork completion
        // Return fork URL
    } catch (error) {
        next(error);
    }
});

router.post("/batch-scan-start", async (req, res, next) => {
    try {
        const { repos, token } = req.body;
        // Queue batch scan
        // Return batch ID
    } catch (error) {
        next(error);
    }
});

export default router;
```

---

### **Phase 5: Issue Management (2 functions)**

**Business Value:** LOW-MEDIUM - Issue creation enhancement  
**Estimated Time:** 1-2 days  
**Dependencies:** GitHub API client, AI provider (optional)

#### Functions to Migrate:

1. **`issue-create`** → `/api/v4/issue-create`
    - Creates GitHub issues with proper labels
    - Formats issue body with metadata
2. **`issue-ai-proxy`** → `/api/v4/issue-ai-proxy`
    - Proxies AI enrichment requests
    - Enhances issue descriptions with AI

#### Implementation Strategy:

```typescript
// packages/server/src/routes/issues.ts
import { Router } from "express";

const router = Router();

router.post("/issue-create", async (req, res, next) => {
    try {
        const { repo, title, body, labels, token } = req.body;
        // Create issue
        // Apply labels
        // Return issue URL
    } catch (error) {
        next(error);
    }
});

router.post("/issue-ai-proxy", async (req, res, next) => {
    try {
        const { prompt, context } = req.body;
        // Call AI provider
        // Return enriched content
    } catch (error) {
        next(error);
    }
});

export default router;
```

---

### **Phase 6: Setup & Configuration (1 function)**

**Business Value:** LOW - Initial setup only  
**Estimated Time:** 1 day  
**Dependencies:** Configuration management

#### Functions to Migrate:

1. **`setup`** → `/api/v4/setup`
    - Initial configuration endpoint
    - May be obsolete in Express architecture

#### Implementation Strategy:

```typescript
// packages/server/src/routes/setup.ts
import { Router } from "express";

const router = Router();

router.post("/setup", async (req, res, next) => {
    try {
        // Validate environment
        // Initialize configuration
        // Return setup status
    } catch (error) {
        next(error);
    }
});

export default router;
```

---

## Migration Timeline

### Week 1 (Days 1-5)

- **Day 1-2:** Phase 1 - Validation workflow (6 functions)
- **Day 3:** Phase 2 - GitHub Actions integration (3 functions)
- **Day 4-5:** Phase 3 - Analysis & submission (3 functions)

### Week 2 (Days 6-10)

- **Day 6:** Phase 4 - Repository management (2 functions)
- **Day 7-8:** Phase 5 - Issue management (2 functions)
- **Day 9:** Phase 6 - Setup & configuration (1 function)
- **Day 10:** Integration testing, smoke tests, documentation

### Week 3 (Buffer)

- Bug fixes
- Performance optimization
- Load testing
- Production deployment preparation

---

## Technical Considerations

### Shared Code Strategy

1. **Extract common GitHub client:**

    ```typescript
    // packages/server/src/shared/github-client.ts
    export class GitHubClient {
        constructor(token: string) {}
        async forkRepository(owner: string, repo: string) {}
        async dispatchWorkflow(
            owner: string,
            repo: string,
            workflow: string,
            inputs: any,
        ) {}
        async getWorkflowRun(owner: string, repo: string, runId: number) {}
        async createIssue(owner: string, repo: string, issue: IssueParams) {}
        // ... more methods
    }
    ```

2. **Reuse analyzer-core:**
    - Keep `packages/api/analyzer-core/` as shared package
    - Import from Express routes as needed
    - No duplication of analysis logic

3. **Shared utilities:**
    - Error handling
    - Token validation
    - Response formatting
    - Logging

### Error Handling Pattern

```typescript
// Consistent error handling across all routes
export class AppError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public isOperational = true,
    ) {
        super(message);
    }
}

// Route example
router.post("/validate-template", async (req, res, next) => {
    try {
        if (!req.body.repoUrl) {
            throw new AppError(400, "Repository URL is required");
        }
        // ... logic
    } catch (error) {
        next(error); // Let error middleware handle it
    }
});
```

### Testing Strategy

For each phase:

1. **Unit tests:**
    - Test route handlers in isolation
    - Mock GitHub API calls
    - Test error cases

2. **Integration tests:**
    - Test with real GitHub API (test repos)
    - Verify end-to-end workflows
    - Test CORS and auth

3. **Parity tests:**
    - Compare Express responses to Azure Functions
    - Ensure identical behavior
    - Document intentional differences

4. **Smoke tests:**
    - Update `scripts/smoke-api.sh` with new endpoints
    - Run after each phase
    - Automated in CI/CD

---

## Risk Mitigation

### High-Risk Areas

1. **Workflow dispatch timing:**
    - GitHub API may have delays
    - Implement retry logic with exponential backoff
    - Timeout handling

2. **Webhook validation:**
    - Verify GitHub webhook signatures
    - Replay protection
    - Rate limiting

3. **SAML/SSO fork handling:**
    - Complex token management
    - Fork sync delays
    - Permission issues

### Rollback Strategy

- Each phase deployed independently
- Feature flags control routing
- Azure Functions remain active during migration
- Monitoring dashboards for both systems

---

## Success Criteria

Each phase must meet:

- ✅ All unit tests passing
- ✅ Integration tests passing
- ✅ Smoke tests updated and passing
- ✅ Documentation updated
- ✅ Frontend integration verified
- ✅ Performance benchmarks met (< 200ms p95)
- ✅ Error rates < 0.1%
- ✅ Code review approved

---

## Next Steps

### Immediate Actions:

1. **Review and approve this migration plan**
2. **Set up testing infrastructure:**
    - Create test GitHub repositories
    - Configure test workflows
    - Set up monitoring dashboards

3. **Start Phase 1 (Validation Workflow):**
    - Create `packages/server/src/routes/validation.ts`
    - Implement `validate-template` endpoint
    - Write tests
    - Update smoke script

4. **Prepare shared utilities:**
    - Extract GitHub client from analyzer-core
    - Create common error types
    - Set up logging infrastructure

### Tracking & Reporting:

- Daily standup updates
- Weekly progress report
- Update `EXPRESS_MIGRATION_MATRIX.md` after each function
- Maintain CHANGELOG for breaking changes

---

## Recommendations

### Suggested Order: **Start with Phase 1 (Validation)**

**Rationale:**

1. Validation is a core user-facing feature
2. High business value
3. Well-defined scope
4. Tests can be written against existing workflows
5. Builds foundation for other workflow-related functions

### Alternative Approach: **Start with Phase 4 (Repository Management)**

**Rationale:**

1. Smaller scope (2 functions)
2. Quick win to build momentum
3. `repo-fork` complements existing analyze endpoint
4. Less complex than workflow orchestration

### My Recommendation: **Phase 1 (Validation) First**

The validation workflow is critical functionality and will demonstrate the full pattern for workflow management. Once this is working, Phases 2-3 will be faster as they follow similar patterns.

---

## Questions for Discussion

1. Should we implement all validation endpoints at once, or iteratively?
2. Do we need backwards compatibility shims for any endpoints?
3. Should we add new features during migration, or strict parity only?
4. What's the preferred timeline: aggressive (1-2 weeks) or conservative (3-4 weeks)?
5. Should we batch-migrate similar endpoints or go phase-by-phase?

---

## Appendix: Function Dependency Graph

```
analyze-template (✅ migrated)
├── repo-fork (creates fork if SAML)
└── batch-scan-start (queues multiple analyses)

validate-template
├── validation-status (polls progress)
├── validation-callback (receives results)
├── validation-cancel (stops validation)
├── validation-docker-image (Docker checks)
└── validation-ossf (OSSF checks)

action-trigger
├── action-run-status (polls status)
└── action-run-artifacts (retrieves outputs)

submit-analysis-dispatch
├── add-template-pr (creates PR)
└── archive-collection (archives metadata)

issue-create
└── issue-ai-proxy (optional AI enhancement)

setup (standalone, may be obsolete)
```

---

## References

- [Express Migration Matrix](./EXPRESS_MIGRATION_MATRIX.md)
- [Architecture Documentation](./architecture.md)
- [Environment Variables](./ENVIRONMENT_VARIABLES.md)
- [Azure Functions Source](../../packages/api/)
- [Express Server](../../packages/server/)
