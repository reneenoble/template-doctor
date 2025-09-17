# Template Doctor - AI Agents Guide

This document provides specific guidance for AI agents working with the Template Doctor codebase. It complements the README.md with focused information for automated assistance.

## Project Overview

Template Doctor analyzes and validates sample templates, with a focus on Azure Developer CLI (azd) templates. It's structured as a monorepo with independently deployable packages:

- **packages/app**: Static web app (frontend UI)
- **packages/api**: Azure Functions (PR creation, OAuth helpers, AZD validation)
- **packages/analyzer-core**: Core analyzer functionality
- **packages/server**: Server-side functions (deprecated)

## Development Environment Setup

### Prerequisites

- Node.js LTS
- npm 
- Azure Functions Core Tools (for API development)
- Python 3 (for serving frontend locally)

### Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/Template-Doctor/template-doctor.git
   cd template-doctor
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Environment setup:
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file with appropriate values.

4. Start services (in separate terminals):
   - API: `npm run -w packages/api start`
   - Frontend: `cd ./packages/app && python3 -m http.server 4000`

5. Access the application at http://localhost:4000

## Code Structure Insights

- The frontend is vanilla JavaScript (planned migration to TypeScript)
- The API is Azure Functions
- Results are stored as JS files under `packages/app/results/`
- Configuration is split across:
  - `.env` file (root)
  - `config.json` files (in packages)

## OAuth Configuration

For local development:
- GitHub OAuth callback URL must match frontend port: `http://localhost:4000/callback.html`
- If changing the port, update both:
  1. The local server command in README.md
  2. The callback URL in GitHub OAuth app settings
  3. The examples in docs/development/OAUTH_CONFIGURATION.md

## Testing Guidelines

Run all tests from the project root:
```bash
npm test           # Run all tests
npm run test:ui    # Run tests with UI
npm run test:debug # Run tests in debug mode
```

Run specific tests:
```bash
npm run test -- "-g" "should handle search functionality" packages/app/tests/app.spec.js
```

### Test Conventions
- Frontend tests use Playwright
- No native browser dialogs (use notifications) to keep tests stable
- Test files are stored in `packages/app/tests/`

## Commit Guidelines

- Add/update tests for features and fixes
- Format code before committing
- Don't commit generated artifacts like `node_modules/` or large reports
- Update docs and workflows when changing paths or behavior

## Important Files to Understand

- `packages/app/results/index-data.js`: Master list of scanned templates
- `packages/app/results/<owner-repo>/<timestamp>-data.js`: Per-scan data
- `packages/app/results/<owner-repo>/<timestamp>-dashboard.html`: Per-scan dashboard
- `docs/development/ENVIRONMENT_VARIABLES.md`: Complete reference of all environment variables
- `docs/development/OAUTH_CONFIGURATION.md`: OAuth setup details
- `docs/usage/GITHUB_ACTION_SETUP.md`: GitHub Action setup guide

## Security Considerations

- Sensitive credentials should be stored in environment variables, not committed to the repo
- GitHub OAuth requires different app registrations for local and production environments
- For AZD deployment, Azure Managed Identity is required
- The Security Analysis feature reviews Bicep files for security best practices

## Common Troubleshooting

- OAuth redirect issues: Ensure ports match between GitHub OAuth app settings and local server
- Azure Function issues: Check local.settings.json and environment variables
- Deployment failures: Review the CI/CD workflows and environment setup

## Known Quirks

- The frontend is JavaScript for fast prototyping, with plans to migrate to TypeScript
- Results are stored as JS files rather than a database for simplicity
- After "Save Results" creates a PR and the PR is merged, results appear on the site after the nightly deploy or manual admin deploy