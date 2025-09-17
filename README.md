<!-- prettier-ignore -->
<div align="center">

<img src="./assets/images/templatedoctor.svg" alt="template-doctor" align="center" height="128" />

# Template Doctor

[![Template Framework Documentation](https://img.shields.io/badge/TemplateFramework-008080?style=flat-square)](https://github.com/Azure-Samples/azd-template-artifacts/)
[![Template Framework MCP](https://img.shields.io/badge/TemplateFrameworkMCP-0090FF?style=flat-square)](https://github.com/Template-Doctor/template-doctor)
[![License](https://img.shields.io/badge/License-MIT-white?style=flat-square)](LICENSE)

[Overview](#overview) | [Features](#features) | [Install](#installation-and-setup) | [Usage](#usage)


</div>


> [!IMPORTANT]
> This app has been built with vanilla JavaScript for fast prototyping and will be migrated to TypeScript for robustness.

Template Doctor analyzes and validates samples and templates, including but not limited to Azure Developer CLI (azd) templates. It provides a web UI to view analysis results and take action, including opening GitHub issues and assigning them to GitHub copilot in one go. It also automates PR updates with scan results.

# Overview

Template Doctor analyzes and validates samples and templates, including but not limited to Azure Developer CLI (azd) templates. It provides a web UI to view analysis results and take action, including opening GitHub issues and assigning them to GitHub copilot in one go. It also automates PR updates with scan results.

> [!IMPORTANT]
> This app has been built with vanilla JavaScript for fast prototyping and will be migrated to TypeScript for robustness.
> Progress to be tracked here: https://github.com/Template-Doctor/template-doctor/pull/89

## Features

- Template analysis and validation against organization standards
- Web UI for viewing analysis results
- One-click GitHub issue creation with AI-powered assignee suggestions
- Automated PR updates with scan results
- Bicep security analysis
- Azure Developer CLI (azd) deployment testing
- AI model deprecation checking
- Centralized archive for analysis metadata

## Architecture

This repository is structured as a monorepo with independently deployable packages:

- **packages/app** — Static web app (frontend UI)
  - Serves the dashboard and loads scan results from `packages/app/results/`
- **packages/api** — Azure Functions (PR creation, OAuth helpers, AZD validation)
- **docs** — Documentation for GitHub Action/App and usage

Results live under `packages/app/results/`:
- `packages/app/results/index-data.js` — master list of scanned templates (window.templatesData)
- `packages/app/results/<owner-repo>/<timestamp>-data.js` — per-scan data (window.reportData)
- `packages/app/results/<owner-repo>/<timestamp>-dashboard.html` — per-scan dashboard

# Installation and Setup

## Prerequisites

- Node.js and npm
- Azure Functions Core Tools (for API development)
- Python 3 (optional, for serving frontend locally)
- GitHub account with appropriate permissions

## Authentication Setup

### GitHub OAuth Authentication

1. Create a GitHub OAuth app with appropriate callback URL
2. Configure environment variables or config.json settings
3. See [OAuth Configuration Guide](docs/development/OAUTH_CONFIGURATION.md) for detailed instructions

> [!WARNING]
> You will need different app registrations for local and production environments.

### Azure Managed Identity Setup (for AZD deployment)

1. Run `npm run setup:uami` before you get started
2. Create an `.env` file at the root, using [./.env.example](./.env.example) as a guide
3. See [UAMI Setup Instructions](docs/development/UAMI_SETUP_INSTRUCTIONS.md) for detailed steps

## Environment Variables

Template Doctor uses a consolidated approach to environment variables. All variables are defined in a single `.env` file at the root of the project.

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Fill in the core variables required for your environment

See the [Environment Variables Documentation](docs/development/ENVIRONMENT_VARIABLES.md) for a complete reference of all available variables.

# Usage

## Local Development

1. Install dependencies:
   ```bash
   npm ci
   ```

2. Start the API locally:
   ```bash
   npm run -w packages/api start
   ```

3. Start the frontend:
   ```bash
   cd ./packages/app && python3 -m http.server 4000
   ```
   > [!NOTE]
   > The frontend is currently vanilla JavaScript and can be served using any static file server.

4. Open http://localhost:4000 in your browser. The frontend expects the API at http://localhost:7071 by default.

## Testing

Run frontend tests (Playwright) from the root:
```bash
npm test           # Run all tests
npm run test:ui    # Run tests with UI
npm run test:debug # Run tests in debug mode
```

You can run a specific test with:
```bash
npm run test -- "-g" "should handle search functionality" packages/app/tests/app.spec.js
```

## Requirements and Conventions

- **Origin Upstream Requirement**: For provisioning templates with azd, the canonical upstream must be provided in the format `owner/repo`. This is used for `azd init -t <owner/repo>` and ensures the test/provision flow uses the correct azd template (no heuristics).
- **Results Storage**: New scan PRs write to `packages/app/results` and update `packages/app/results/index-data.js`.
- **Independent Deployment**: Each package is deployable independently via dedicated workflows.

## Deployments (CI/CD)

Workflows under `.github/workflows/`:

- **Azure Static Web Apps (SWA)**:
  - Uses `Azure/static-web-apps-deploy@v1`
  - `app_location: /packages/app`
  - `api_location: /packages/api`

- **Nightly Static Web Apps Deploy (SWA CLI)**:
  - Workflow: `.github/workflows/nightly-swa-deploy.yml`
  - Runs nightly at 02:15 UTC and can be triggered manually via "Run workflow"
  - Requires repo secret `SWA_CLI_DEPLOYMENT_TOKEN` (Static Web App deployment token)
  - See details: [docs/usage/DEPLOYMENT.md](docs/usage/DEPLOYMENT.md)

- Submit Template Analysis (repository_dispatch):
  - Saves scan results and opens a PR using `peter-evans/create-pull-request`
  - See setup guide (including bot token fallback): [docs/usage/GITHUB_ACTION_SETUP.md](docs/usage/GITHUB_ACTION_SETUP.md)

Publishing results

- After “Save Results” creates a PR and the PR is merged, results appear on the site after the nightly deploy. Admins can run the deploy workflow manually to publish immediately. The UI shows a notification to inform users of this timing.

### Centralized Archive (optional)

Template Doctor can also archive a small JSON metadata file to a central repository for each analysis.

- How to enable and required variables: see
  - Env vars reference: [docs/development/ENVIRONMENT_VARIABLES.md](docs/development/ENVIRONMENT_VARIABLES.md)
  - Action setup (archive section): [docs/usage/GITHUB_ACTION_SETUP.md](docs/usage/GITHUB_ACTION_SETUP.md#6-centralized-archive-of-analysis-metadata-optional)

Quick checklist
- In GitHub repo (Settings → Secrets and variables → Actions):
  - Set `TD_API_BASE` to your API base (e.g., `https://<your-swa>.azurestaticapps.net/api`).
  - Optionally set `TD_ARCHIVE_COLLECTION` (defaults to `aigallery`).
- In Azure Functions (Application Settings):
  - Set `GH_WORKFLOW_TOKEN` with Contents & Pull requests write access to the central archive repo (authorize SSO if needed).
- Enable archiving:
  - Globally: set `archiveEnabled: true` in runtime-config, or
  - Per-run: check the “Also save metadata to the centralized archive for this analysis” box in the analyze modal when global is off.


## Contributing

- Add/update tests for features and fixes. Frontend E2E tests live in the app package; run from root via `npm test`.
- Avoid native browser dialogs; use notifications to keep tests stable.
- Format code before committing (packages may include prettier configs and scripts).
- Don't commit generated artifacts like `node_modules/` or large reports.
- Update docs and workflows when changing paths or behavior.

## Security Analysis Features

Template Doctor now includes enhanced security analysis for Bicep files:

1. **Managed Identity Detection**: Identifies when Managed Identity is properly used in Azure resources.
2. **Insecure Authentication Detection**: Identifies and flags insecure authentication methods like:
   - Connection strings with embedded credentials
   - Access keys
   - SAS tokens
   - Storage account keys
   - KeyVault secrets accessed without Managed Identity

3. **Anonymous Access Detection**: Identifies Azure resources that typically require authentication but may be configured for anonymous access.

These security checks can be enabled/disabled in each rule set configuration by setting the `bicepChecks.securityBestPractices` properties:

```json
"bicepChecks": {
  "requiredResources": [...],
  "securityBestPractices": {
    "preferManagedIdentity": true,
    "detectInsecureAuth": true,
    "checkAnonymousAccess": true
  }
}
```

---

For issues, please open a GitHub issue.
