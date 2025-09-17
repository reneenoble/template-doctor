# Template Doctor – Architecture Overview

## Template Validation Flow

This diagram shows how the Static Web App (frontend), Functions App, and GitHub workflow interact during the template validation flow, with client-side storage of GitHub run IDs.

```mermaid
sequenceDiagram
    participant U as User
    participant SWA as SWA Frontend
    participant LS as localStorage
    participant FA as Functions App
    participant GH as GitHub Workflow
    participant GHA as GitHub API

    U->>SWA: Trigger template validation
    SWA->>FA: POST /api/validate-template (templateName)
    FA->>FA: Generate UUID (runId)
    FA->>FA: Store in run-id-store (initially with null GitHub info)
    FA->>GHA: Trigger workflow dispatch to validation-template.yml with runId
    FA-->>SWA: Return runId
    
    GH->>GH: Execute validation workflow
    GH->>GH: Parse repo URL and matrix strategy
    GH->>GH: Clone and validate template with microsoft/template-validation-action
    GH-->>FA: POST /api/validation-callback (runId, githubRunId, githubRunUrl)
    FA->>FA: Update run-id-store with GitHub info
    
    loop Until validation complete
        SWA->>LS: Check for stored GitHub run ID
        LS-->>SWA: Return stored run ID (if available)
        SWA->>FA: GET /api/validation-status?runId={runId}&githubRunId={id}
        FA->>FA: Use client-provided GitHub run ID or fallback to store
        FA->>GHA: Query workflow status (githubRunId)
        GHA-->>FA: Return workflow status and results
        FA-->>SWA: Return status, conclusion, and results (with githubRunId)
        SWA->>LS: Store GitHub run ID for future requests
    end
    
    SWA-->>U: Display validation results
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

This diagram shows how the frontend uses the managed OAuth function to exchange the code for a token and then opens a GitHub issue, applying labels and assigning it to Copilot.

```mermaid
sequenceDiagram
    participant U as User
    participant SWA as SWA Frontend
    participant MF as Managed OAuth Function
    participant GH as GitHub API

    U->>SWA: Click Open Issue
    SWA->>MF: GET /api/github-oauth-token with code
    MF-->>SWA: Return access token
    SWA->>GH: POST /repos/:owner/:repo/issues (title, body, labels, assignees: copilot)
    GH-->>SWA: 201 Created (issue number and url)
    opt Add more labels
        SWA->>GH: POST /repos/:owner/:repo/issues/:number/labels (labels)
        GH-->>SWA: 200 OK
    end
    SWA-->>U: Show issue link and assigned to Copilot
```

## Overall System Architecture

The following diagram illustrates the high-level system architecture of Template Doctor:

```mermaid
graph TB
    User((User))
    
    subgraph "Frontend (Static Web App)"
        UI[Web UI]
        ResultsViewer[Results Viewer]
        BatchManager[Batch Manager]
        NotificationSystem[Notification System]
    end
    
    subgraph "Azure Functions"
        ValidateTemplate[validate-template]
        ValidationStatus[validation-status]
        ValidationCallback[validation-callback]
        GithubOAuth[github-oauth-token]
        ArchiveCollection[archive-collection]
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
    
    BatchManager --> ValidateTemplate
    UI --> ValidateTemplate
    UI --> ValidationStatus
    UI --> GithubOAuth
    
    ValidateTemplate --> ValidationWorkflow
    ValidationWorkflow --> ValidationCallback
    ValidationCallback --> ValidationStatus
    
    ValidationWorkflow --> SubmitAnalysis
    SubmitAnalysis --> ResultsRepo
    SubmitAnalysis --> ArchiveCollection
    
    ValidationStatus --> localStorage
    localStorage --> ValidationStatus
    
    ResultsRepo --> ResultsViewer
    
    GithubOAuth --> GitHub
    
    class UI,BatchManager,ResultsViewer,NotificationSystem highlight
    class ValidateTemplate,ValidationStatus,ValidationCallback,GithubOAuth,ArchiveCollection highlight
    class ValidationWorkflow,SubmitAnalysis highlight
    
    classDef highlight fill:#f9f,stroke:#333,stroke-width:2px
```
