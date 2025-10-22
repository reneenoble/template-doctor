# Template Doctor – Architecture Overview

## Containerized Express Architecture

Template Doctor runs as a containerized Express application with a Vite-built frontend, providing excellent local development experience and flexible deployment options.

### Components

- **Express Backend** (`packages/server`): TypeScript REST API on port 3000
- **Vite Frontend** (`packages/app`): TypeScript SPA (dev: port 4000, production: served by Express)
- **MongoDB/Cosmos DB**: Persistent storage for analysis results and configuration
- **Docker**: Single and multi-container deployment options

## OAuth 2.0 Authentication Flow

Template Doctor uses OAuth 2.0 with GitHub for API authentication. The frontend handles the OAuth flow automatically, and all protected endpoints validate GitHub tokens on every request.

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend (Vite SPA)
    participant LS as localStorage
    participant EX as Express Backend (Auth Middleware)
    participant GH as GitHub API

    U->>FE: Click Login
    FE->>GH: Redirect to GitHub OAuth
    GH->>U: Authorization prompt
    U->>GH: Approve
    GH->>FE: Redirect with authorization code
    FE->>EX: POST /api/v4/github-oauth-token (code)
    EX->>GH: Exchange code for access token
    GH-->>EX: Return access_token
    EX-->>FE: Return access_token
    FE->>LS: Store token as 'gh_access_token'

    Note over FE,EX: All subsequent API requests include Authorization header

    U->>FE: Trigger protected operation (e.g., analyze template)
    FE->>EX: POST /api/v4/analyze-template + Bearer token

    EX->>EX: Auth Middleware: Extract token from header
    EX->>GH: Validate token (GET /user)
    GH-->>EX: Return user info (login, id, name, email, avatar)
    EX->>EX: Attach user to req.user
    EX->>EX: Execute route handler with authenticated user
    EX-->>FE: Return result

    alt Token Invalid/Expired
        EX-->>FE: 401 Unauthorized
        FE->>LS: Clear stored token
        FE-->>U: Show login prompt
    end

    alt Admin Endpoint
        EX->>EX: requireAdmin: Check ADMIN_GITHUB_USERS
        alt User is Admin
            EX-->>FE: Return result
        else User is not Admin
            EX-->>FE: 403 Forbidden
        end
    end
```

**Endpoint Protection:**

- **Public Endpoints**: No authentication required
  - `/api/health` - Health check
  - `/api/v4/client-settings` - Runtime configuration
  - `/api/v4/github-oauth-token` - OAuth token exchange

- **Protected Endpoints**: Require valid GitHub token
  - `/api/v4/analyze-template` - Template analysis
  - `/api/v4/validate-template` - Trigger validation
  - `/api/v4/validation-*` - All validation endpoints
  - `/api/v4/issue-create` - Create GitHub issue
  - `/api/v4/action-*` - GitHub Actions endpoints
  - `/api/v4/batch-scan-start` - Batch analysis

- **Admin Endpoints**: Require authentication + admin privileges
  - `/api/admin/*` - Admin configuration and debugging
  - `/api/v4/admin/*` - Admin settings management

**Authentication Middleware:**

The Express backend uses three middleware functions:

1. `requireAuth` - Validates token, attaches user to request, or returns 401
2. `optionalAuth` - Validates token if present, never returns 401
3. `requireAdmin` - Checks user is in ADMIN_GITHUB_USERS list, or returns 403

See [OAuth API Authentication](./OAUTH_API_AUTHENTICATION.md) for detailed documentation.

---

## Template Validation Flow

This diagram shows how the frontend, Express backend, and GitHub workflow interact during the template validation flow, with client-side storage of GitHub run IDs.

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend (Vite SPA)
    participant LS as localStorage
    participant EX as Express Backend
    participant GH as GitHub Workflow
    participant GHA as GitHub API

    Note over FE,EX: User must be authenticated (see OAuth flow above)

    U->>FE: Trigger template validation
    FE->>EX: POST /api/v4/validate-template + Bearer token (templateName)
    EX->>EX: Auth Middleware: Validate token
    EX->>EX: Generate UUID (runId)
    EX->>EX: Store in run-id-store (initially with null GitHub info)
    EX->>GHA: Trigger workflow dispatch to validation-template.yml with runId
    EX-->>FE: Return runId

    GH->>GH: Execute validation workflow
    GH->>GH: Parse repo URL and matrix strategy
    GH->>GH: Clone and validate template with microsoft/template-validation-action
    GH-->>EX: POST /api/v4/validation-callback (runId, githubRunId, githubRunUrl)
    EX->>EX: Update run-id-store with GitHub info

    loop Until validation complete
        FE->>LS: Check for stored GitHub run ID
        LS-->>FE: Return stored run ID (if available)
        FE->>EX: GET /api/v4/validation-status?runId={runId}&githubRunId={id} + Bearer token
        EX->>EX: Auth Middleware: Validate token
        EX->>EX: Use client-provided GitHub run ID or fallback to store
        EX->>GHA: Query workflow status (githubRunId)
        GHA-->>EX: Return workflow status and results
        EX-->>FE: Return status, conclusion, and results (with githubRunId)
        FE->>LS: Store GitHub run ID for future requests
    end

    FE-->>U: Display validation results
```

Notes:

- The in-memory run-id-store maps internal UUIDs to GitHub workflow run IDs and URLs
- The frontend stores GitHub run IDs in localStorage to maintain mapping across browser sessions
- When polling for status, the frontend includes the stored GitHub run ID in the request
- This provides resilience against Function App restarts, which would otherwise lose the in-memory mapping
- The status endpoint queries the GitHub API with either the client-provided run ID or falls back to in-memory store
- The validation workflow includes additional steps like location determination, repository cloning, and running the microsoft/template-validation-action

## Submit Analysis Workflow

This diagram shows how the Template Doctor processes and submits analysis results to be stored in the repository.

```mermaid
sequenceDiagram
    participant EC as External Client
    participant GHD as GitHub Dispatch
    participant SAW as submit-analysis.yml
    participant TDA as Template Doctor Action
    participant GH as GitHub API
    participant ARC as Archive Collection (Optional)

    EC->>GHD: Trigger template-analysis-completed
    GHD->>SAW: Execute submit-analysis workflow

    SAW->>SAW: Checkout repository & setup Node.js
    SAW->>TDA: Process analysis result with action
    Note right of TDA: Uses repository action.yml
    TDA->>TDA: Generate dashboard & data files
    TDA-->>SAW: Return template data (JSON)

    SAW->>GH: Create Pull Request with analysis results
    GH-->>SAW: Return PR details

    alt If archiveEnabled is true
        SAW->>ARC: POST to archive-collection API
        ARC-->>SAW: Return archive status
    end
```

Notes:

- The submit-analysis workflow is triggered by a repository_dispatch event of type "template-analysis-completed"
- The workflow uses the Template Doctor action (action.yml in the repository root) to process analysis results
- The action generates dashboard HTML and data JS files for the analyzed template
- A pull request is created to add these files to the repository
- Optionally, results can be archived to a central collection if configured

## GitHub issue creation flow

This diagram shows how the frontend uses the Express OAuth endpoint to exchange the code for a token and then opens a GitHub issue, applying labels and assigning it to Copilot. **Note: Issue creation now requires authentication.**

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend (Vite SPA)
    participant LS as localStorage
    participant EX as Express Backend
    participant GH as GitHub API

    Note over FE,LS: User must be authenticated (token in localStorage)

    U->>FE: Click Open Issue
    FE->>LS: Retrieve stored GitHub token
    FE->>EX: POST /api/v4/issue-create + Bearer token (title, body, labels)
    EX->>EX: Auth Middleware: Validate token
    EX->>GH: POST /repos/:owner/:repo/issues (title, body, labels, assignees: copilot)
    GH-->>EX: 201 Created (issue number and url)
    EX-->>FE: Return issue details
    opt Add more labels
        FE->>GH: POST /repos/:owner/:repo/issues/:number/labels (labels)
        GH-->>FE: 200 OK
    end
    FE-->>U: Show issue link and assigned to Copilot
```

## Overall System Architecture

The following diagram illustrates the high-level containerized system architecture of Template Doctor:

```mermaid
graph TB
    User((User))

    subgraph "Frontend Container (Vite SPA)"
        UI[Web UI]
        ResultsViewer[Results Viewer]
        BatchManager[Batch Manager]
        NotificationSystem[Notification System]
    end

    subgraph "Express Backend Container"
        AnalyzeAPI[/api/v4/analyze]
        ConfigAPI[/api/v4/client-settings]
        AuthAPI[/api/v4/github-oauth-token]
        ValidateAPI[/api/v4/validate-template]
        StatusAPI[/api/v4/validation-status]
        CallbackAPI[/api/v4/validation-callback]
        ArchiveAPI[/api/v4/archive-collection]
    end

    subgraph "Docker Deployment"
        DockerCompose[docker-compose.yml]
        SingleContainer[Dockerfile.combined]
    end

    subgraph "GitHub Workflows"
        ValidationWorkflow[validation-template.yml]
        SubmitAnalysis[submit-analysis.yml]
    end

    subgraph "Storage"
        localStorage[(localStorage)]
        ResultsRepo[(GitHub Pages Results)]
    end

    User --> UI
    UI --> BatchManager
    UI --> NotificationSystem
    UI --> ResultsViewer

    BatchManager --> AnalyzeAPI
    UI --> ValidateAPI
    UI --> StatusAPI
    UI --> AuthAPI
    UI --> ConfigAPI

    AnalyzeAPI --> GitHub
    ValidateAPI --> ValidationWorkflow
    ValidationWorkflow --> CallbackAPI
    CallbackAPI --> StatusAPI

    ValidationWorkflow --> SubmitAnalysis
    SubmitAnalysis --> ResultsRepo
    SubmitAnalysis --> ArchiveAPI

    StatusAPI --> localStorage
    localStorage --> StatusAPI

    ResultsRepo --> ResultsViewer

    AuthAPI --> GitHub

    DockerCompose -.-> UI
    DockerCompose -.-> AnalyzeAPI
    SingleContainer -.-> UI
    SingleContainer -.-> AnalyzeAPI

    class UI,BatchManager,ResultsViewer,NotificationSystem highlight
    class AnalyzeAPI,ConfigAPI,AuthAPI,ValidateAPI,StatusAPI,CallbackAPI,ArchiveAPI highlight
    class ValidationWorkflow,SubmitAnalysis highlight

    classDef highlight fill:#f9f,stroke:#333,stroke-width:2px
```

### Port Allocation

| Service                  | Development | Production/Docker |
| ------------------------ | ----------- | ----------------- |
| Vite Dev Server          | 4000        | -                 |
| Express Backend + Frontend | 3000      | 3000              |

**Note**: In production/Docker, Express serves both API and static frontend on port 3000 for OAuth compatibility.

## Deployment Options

### Local Development

**Recommended: Docker Compose**

```bash
docker-compose --profile combined up
```

Access at http://localhost:3000

**Manual Two-Terminal Approach:**

Terminal 1 - Express Backend:

```bash
cd packages/server
npm run dev  # Port 3000
```

Terminal 2 - Vite Frontend:

```bash
cd packages/app
npm run dev  # Port 4000
```

**Note**: OAuth only works correctly when both run on port 3000 (Docker setup).

### Production Deployment

**Docker Single Container:**

```bash
docker build -f Dockerfile.combined -t template-doctor .
docker run -p 3000:3000 --env-file .env template-doctor
```

**Azure Container Apps:**

Use `azd up` with the included Bicep templates in `infra/`. See [Production Database Setup](../deployment/PRODUCTION_DATABASE_MANAGED_IDENTITY.md).

## API Endpoints

All API endpoints use OAuth 2.0 authentication (except public endpoints). See [OAuth API Authentication](./OAUTH_API_AUTHENTICATION.md).

### Public Endpoints
- `GET /api/health` - Health check
- `GET /api/v4/client-settings` - Runtime configuration
- `POST /api/v4/github-oauth-token` - OAuth token exchange

### Protected Endpoints (Require Authentication)
- `POST /api/v4/analyze-template` - Template analysis
- `POST /api/v4/validate-template` - Trigger validation workflow
- `GET /api/v4/validation-status` - Poll validation status
- `POST /api/v4/validation-callback` - Workflow callback
- `POST /api/v4/issue-create` - Create GitHub issue
- `POST /api/v4/batch-scan-start` - Start batch analysis

### Admin Endpoints (Require Admin Privileges)
- `GET /api/admin/*` - Admin debugging endpoints
- `POST /api/v4/admin/*` - Configuration management

---

*For detailed sequence diagrams and flows, see sections above.*
