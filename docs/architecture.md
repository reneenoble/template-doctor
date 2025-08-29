# Template Doctor – Template Validation Architecture

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
    FA->>GHA: Trigger workflow (with runId as input)
    FA-->>SWA: Return runId
    
    GH->>GH: Execute validation workflow
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

## GitHub issue creation flow (assign to Copilot)

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
