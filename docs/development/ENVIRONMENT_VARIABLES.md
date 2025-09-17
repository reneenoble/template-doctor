# Environment Variables Documentation

This document provides an overview of the environment variables used in the Template Doctor project. We've consolidated the environment variables into a single `.env` file at the root of the project for easier management.

## Environment Variable Consolidation

Previously, environment variables were spread across multiple `.env` files:
- `/.env` (root)
- `/packages/app/.env`
- `/packages/api/.env`

These have now been consolidated into a single `.env` file at the root level. This approach simplifies setup and ensures consistency across different parts of the application.

## Core Environment Variables

These are the essential variables that should be in your `.env` file for local development:

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `GITHUB_TOKEN` | GitHub personal access token used for API calls | Yes | API, GitHub Action |
| `GH_WORKFLOW_TOKEN` | GitHub personal access token used for API calls | Yes | API, GitHub Action |
| `GITHUB_CLIENT_ID` | OAuth client ID for GitHub authentication | Yes | Frontend, API |
| `GITHUB_CLIENT_SECRET` | OAuth client secret for GitHub authentication | Yes | API (github-oauth-token) |
| `GITHUB_OWNER` | GitHub organization or user name (for OIDC) | Yes | Scripts, API |
| `GITHUB_REPO` | GitHub repository name (for OIDC) | Yes | Scripts, API |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | Yes | API, Functions, Scripts |
| `AZURE_TENANT_ID` | Azure tenant ID | Yes | API, Functions, Scripts |
| `AZURE_CLIENT_ID` | Azure managed identity client ID | For managed identity | Functions, Scripts |
| `AZURE_RESOURCE_GROUP` | Azure resource group | For managed identity | Scripts |
| `AzureWebJobsStorage` | Storage connection string for Azure Functions | For local dev | Functions |
| `FUNCTIONS_WORKER_RUNTIME` | Runtime for Azure Functions (node) | For Functions | Functions |

Notes:
- `GH_WORKFLOW_TOKEN` is used by server-side functions to call GitHub (e.g., repository_dispatch and centralized archive PRs). It must have the right scopes and be SSO-authorized if your org requires it.
## Optional Environment Variables

The following environment variables are optional and can be set in different ways:
- In the `.env` file for local development
- In deployment environments (Azure Static Web Apps settings, GitHub Actions secrets)
- In `config.json` for frontend settings

### API Configuration (Optional)

| Variable | Description | Required | Used In | Setting Method |
|----------|-------------|----------|---------|---------------|
| `API_BASE_URL` | Base URL for API endpoints | No | Frontend | config.json, env var |
| `FUNCTION_KEY` | Function key for secured functions (not needed for anonymous functions) | No | Frontend | config.json, env var |
| `TD_BACKEND_BASE_URL`/`BACKEND_BASE_URL` | Alternative way to specify API base URL | No | API | env var |
| `TD_BACKEND_FUNCTION_KEY`/`BACKEND_FUNCTION_KEY` | Alternative way to specify function key | No | API | env var |

### GitHub Action Dispatch Target (Optional)

### GitHub Action Dispatch Target (Optional)

| Variable | Description | Required | Used In | Setting Method |
|----------|-------------|----------|---------|---------------|
| `GITHUB_ACTION_REPO` | Target repository for saving results (format: `owner/repo`) | No | API | env var |
| `DISPATCH_TARGET_REPO` | Alternative name for `GITHUB_ACTION_REPO` | No | API | env var |
| `TD_DISPATCH_TARGET_REPO` | Another alternative name for `GITHUB_ACTION_REPO` | No | API | env var |

Notes:
- If omitted, the server will use `GITHUB_REPOSITORY` when available, otherwise it falls back to `Template-Doctor/template-doctor`
- Set this only on the server (Functions or SWA API). The client no longer needs to know or set this value.
- If the application and action live in the same repository, you can omit this and rely on `GITHUB_REPOSITORY` or the default fallback.

### Frontend Configuration (Optional)

### Frontend Configuration (Optional)

| Variable | Description | Required | Used In | Setting Method |
|----------|-------------|----------|---------|---------------|
| `DEFAULT_RULE_SET` | Default ruleset to use for validation (e.g., 'dod') | No | Frontend, API | config.json, env var |
| `TD_DEFAULT_RULE_SET` | Alternative name for `DEFAULT_RULE_SET` | No | Frontend, API | env var |
| `REQUIRE_AUTH_FOR_RESULTS` | Whether to require authentication to view results | No | Frontend | config.json, env var |
| `TD_REQUIRE_AUTH_FOR_RESULTS` | Alternative name for `REQUIRE_AUTH_FOR_RESULTS` | No | Frontend | env var |
| `AUTO_SAVE_RESULTS` | Whether to automatically save results | No | Frontend | config.json, env var |
| `TD_AUTO_SAVE_RESULTS` | Alternative name for `AUTO_SAVE_RESULTS` | No | Frontend | env var |
| `AZURE_DEVELOPER_CLI_ENABLED` | Enable Azure Developer CLI features | No (default: true) | Frontend, API | config.json, env var |

### Issue AI Enrichment (Optional)

### Issue AI Enrichment (Optional)

| Variable | Description | Required | Used In | Setting Method |
|----------|-------------|----------|---------|---------------|
| `ISSUE_AI_ENABLED` | Master flag enabling AI enrichment of issue bodies (`true/1/yes/on`) | No | API, Frontend | config.json, env var |
| `TD_ISSUE_AI_ENABLED` | Alternative name for `ISSUE_AI_ENABLED` | No | API | env var |
| `ISSUE_AI_PROVIDER` | Force provider selection (`azure` or `github`) | No (auto) | API | env var |
| `ISSUE_AI_MODEL` | Generic model name | No | API | env var |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL | Yes (if azure) | API | env var |
| `AZURE_OPENAI_DEPLOYMENT` | Azure OpenAI deployment name (model alias) | Yes (if azure) | API | env var |
| `AZURE_OPENAI_API_VERSION` | Azure OpenAI API version | No | API | env var |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key (dev only; prefer MSI in prod) | Yes (if no MSI) | API | env var |
| `GITHUB_MODELS_TOKEN` | Token for GitHub Models (if using GitHub provider) | Yes (if github) | API | env var |
| `ISSUE_AI_RATE_LIMIT_MAX` | Requests allowed per window per key | No (20) | API | env var |
| `ISSUE_AI_RATE_LIMIT_WINDOW_MS` | Window length in ms for rate limiter | No (60000) | API | env var |
| `ISSUE_AI_CACHE_TTL_MS` | Cache TTL in ms for enriched responses | No (300000) | API | env var |
| `ISSUE_AI_CACHE_MAX` | Max cached entries (approx LRU eviction) | No (500) | API | env var |

### Centralized Archive (Optional)

These variables enable saving a metadata JSON into a centralized archive repository (separate from the results PR).

| Variable | Description | Required | Used In | Setting Method |
|----------|-------------|----------|---------|---------------|
| `TD_API_BASE` | Base URL to your API endpoints that host `/archive-collection` | Yes (if archiving) | GitHub Actions | GitHub Actions secret |
| `TD_ARCHIVE_COLLECTION` | Default collection name to file results under (e.g., `aigallery`) | No | GitHub Actions, API | GitHub Actions variable |
| `TD_COLLECTION` | Legacy alias for `TD_ARCHIVE_COLLECTION` | No | GitHub Actions, API | GitHub Actions variable |
| `GH_WORKFLOW_TOKEN` | PAT used by the `archive-collection` function | Yes (if archiving) | API | env var |
| `ARCHIVE_REPO_SLUG` | Override central archive repo slug in `owner/repo` form | No | API | env var |
| `TD_ARCHIVE_ENABLED` | Enable centralized archive (`true/1/yes/on`) | No | API | env var, config.json |
| `ARCHIVE_ENABLED` | Alternative name for `TD_ARCHIVE_ENABLED` | No | API | env var, config.json |

Notes:
- The `GH_WORKFLOW_TOKEN` must have Contents: Read/Write and Pull requests: Read/Write permissions on the central archive repo (enable SSO if needed)
- Default central archive repo is `Template-Doctor/centralized-collections-archive` if not specified

### Configuration Runtime Flags

These are set in `config.json` or propagated from server environment to client:

| Field | Description | Default | Setting Method |
|-------|-------------|---------|---------------|
| `apiBase` | Base URL for API endpoints | `${window.location.origin}` | config.json |
| `defaultRuleSet` | Default ruleset for analysis | 'dod' | config.json, env var |
| `requireAuthForResults` | Require authentication to view results | true | config.json, env var |
| `autoSaveResults` | Automatically save results | false | config.json, env var |
| `archiveEnabled` | Enable central archive for every analysis | false | config.json, env var |
| `archiveCollection` | Default collection for archiving | 'aigallery' | config.json, env var |
| `azureDeveloperCliEnabled` | Enable Azure Developer CLI checks | true | config.json, env var |
| `dispatchTargetRepo` | Target repo for saving results | '' | config.json, env var |
| `issueAIEnabled` | Enable AI enrichment for issue bodies | false | config.json, env var |

#### Azure Configuration

| Variable | Description | Required | Used In | Setting Method |
|----------|-------------|----------|---------|---------------|
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | Yes | API, Functions | env var |
| `AZURE_TENANT_ID` | Azure tenant ID | Yes | API, Functions | env var |
| `AZURE_CLIENT_ID` | Azure managed identity client ID | For managed identity | Functions | env var |
| `AZURE_RESOURCE_GROUP` | Azure resource group | For managed identity | Scripts | env var |

### AI Model Deprecation Check (Optional)

| Variable | Description | Required | Used In | Setting Method |
|----------|-------------|----------|---------|---------------|
| `DEPRECATED_MODELS` | Comma-separated list of deprecated model names | No | API | env var, config.json |
| `AI_DEPRECATION_CHECK_ENABLED` | Enable AI model deprecation check | No (default: true) | API | env var, config.json |

### Azure Static Web Apps Deployment

| Variable | Description | Required | Used In | Setting Method |
|----------|-------------|----------|---------|---------------|
| `SWA_CLI_DEPLOYMENT_TOKEN` | Static Web Apps deployment token | Yes (for nightly/manual deploy) | GitHub Actions | GitHub Actions secret |

### Azure Functions Configuration (Local Development)

| Variable | Description | Required | Used In | Setting Method |
|----------|-------------|----------|---------|---------------|
| `AzureWebJobsStorage` | Storage connection string for Azure Functions | For local dev | Functions | env var |
| `FUNCTIONS_WORKER_RUNTIME` | Runtime for Azure Functions (node) | For Functions | Functions | env var |

## Setup Instructions

1. Copy the `.env.example` file to `.env` at the root of your project:
   ```bash
   cp .env.example .env
   ```

2. Fill in at least the core environment variables in the `.env` file:
   - GitHub authentication tokens
   - GitHub OAuth credentials
   - GitHub repo information for OIDC
   - Azure configuration (for managed identity)
   - Azure Functions storage settings (for local development)

3. For local development of Azure Functions, you'll need the Azure Functions Core Tools installed and running with the storage emulator:
   ```bash
   npm install -g azure-functions-core-tools@4
   ```

4. Optional variables can be set through:
   - The `.env` file
   - In `config.json` for frontend settings
   - In deployment environments (Azure Static Web Apps settings, GitHub Actions secrets)

## GitHub OAuth Configuration

For the OAuth flow to work correctly, you need to:

1. Create a GitHub OAuth App in your GitHub Developer Settings
2. Set the Authorization callback URL to match your deployment URL + `/callback.html`
3. Fill in the `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in your `.env` file

See the [OAuth Configuration Guide](./OAUTH_CONFIGURATION.md) for more detailed instructions.

## Environment-Specific Configuration

For production deployments, configure the environment variables in your hosting environment:

- **Azure Static Web Apps**: Configure Application Settings in the Azure Portal
- **GitHub Actions**: Set secrets and variables in Repository → Settings → Secrets and variables → Actions
- **Function App**: Configure Application Settings in the Azure Portal

## Security Considerations

- Never commit your `.env` file to version control
- Use secrets management for production deployments
- Rotate credentials regularly
- Consider using managed identities in Azure where possible
- Do not expose AI provider keys to the frontend; only the server performs enrichment calls
- Monitor rate limiting metrics to detect abuse of the enrichment endpoint