# Template Doctor - AI Agents Guide

This document provides specific guidance for AI agents working with the Template Doctor codebase. It complements the README.md with focused information for automated assistance.

## Project Overview

Template Doctor analyzes and validates sample templates, with a focus on Azure Developer CLI (azd) templates. It runs as a containerized application with Express backend and Vite frontend.

### Architecture (Current)

- **packages/app**: Vite SPA (TypeScript frontend)
- **packages/server**: Express backend (TypeScript REST API)
- **packages/analyzer-core**: Core analyzer functionality (shared)
- **Docker**: Containerized deployment (multi-container and single-container options)

### Legacy Azure Functions (Archived)

Azure Functions code has been removed from the main branch and archived in `dev/api-legacy-azure-functions` for historical reference.

## Development Environment Setup

### Prerequisites

- Node.js LTS (v18+)
- npm
- Docker and Docker Compose (recommended for local development)

### Quick Start with Docker (Recommended)

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

    Edit the `.env` file with appropriate values. **CRITICAL**: You must set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`.

4. Start with Docker Compose:

    ```bash
    docker-compose --profile combined up
    ```

5. Access the application:
    - Frontend: http://localhost:3000
    - Backend API: http://localhost:3001 (same as frontend in combined mode)

### Manual Development (Two-Terminal Approach)

If you prefer running services without Docker:

1. Follow steps 1-3 from Quick Start above

2. Build both packages:

    ```bash
    npm run build -w packages/server
    npm run build -w packages/app
    ```

3. **IMPORTANT**: Start services in SEPARATE terminals (do not use background processes):

    **Terminal 1 - Express Backend (on port 3001):**

    ```bash
    cd packages/server
    npm run dev
    ```

    **Terminal 2 - Vite dev server (on port 4000):**

    ```bash
    cd packages/app
    npm run dev
    ```

4. Access the application at http://localhost:4000

### Port Allocation

| Service                  | Development | Preview/Docker | Production | Legacy (Functions) |
| ------------------------ | ----------- | -------------- | ---------- | ------------------ |
| **Frontend + Backend**   | 3000        | 3000           | 3000       | -                  |
| Express Backend (legacy) | 3001        | 3001           | -          | -                  |
| Vite Dev Server (legacy) | 4000        | -              | -          | 4000               |
| Azure Functions (Legacy) | -           | -              | -          | 7071               |

**IMPORTANT**: For OAuth to work correctly, both the frontend and backend MUST run on the same port (3000) that matches your GitHub OAuth app's callback URL configuration. The combined Docker image serves both frontend and backend on port 3000.

### Critical Local Development Requirements

- **OAuth Port Requirement**: Both frontend and backend MUST run on the same port (3000) that matches your GitHub OAuth app's callback URL
- **Docker Compose (Recommended)**: Single command starts all services with proper networking on port 3000
- **Combined Docker Image**: Serves both frontend and backend on port 3000 for OAuth compatibility
- **Hard refresh required** (Cmd+Shift+R / Ctrl+Shift+R) after any config changes
- **Port conflicts**: If you see EADDRINUSE errors, kill processes: `lsof -ti :3000 | xargs kill -9`

## Database Architecture

**CRITICAL: Local vs Production Database Separation**

### Local Development Database

- **Database**: MongoDB running at `localhost:27017`
- **Database Name**: `template-doctor` (with hyphen)
- **Management Tool**: MongoDB Compass
- **Docker Setup**: `docker-compose --profile combined up` starts local MongoDB container automatically
- **Connection**: Docker container connects to `mongodb://mongodb:27017/template-doctor`
- **Data**: Managed locally, separate from production

### Production Database

- **Database**: Azure Cosmos DB (MongoDB API)
- **Database Name**: `template-doctor` (with hyphen)
- **Environment**: Azure Container Apps
- **Connection**: Configured via Azure Container App environment variables
- **Security**: Connection string stored as Azure secret, never committed to repository

### Database Configuration Rules

1. **`.env` file** (gitignored):
    - Local: DO NOT set `MONGODB_URI` - let docker-compose.yml default take over
    - Production: Connection strings configured in Azure Container Apps environment variables

2. **Docker Compose**:
    - Automatically uses local MongoDB container if `MONGODB_URI` not set in `.env`
    - Fallback: `mongodb://mongodb:27017/template-doctor`

3. **Azure Container Apps**:
    - Uses Cosmos DB connection string from environment variables
    - Database name: `template-doctor` (set via `MONGODB_DATABASE`)

### Database Troubleshooting

- **"Database not connected" errors**: Check if `MONGODB_URI` is set in `.env` (it should NOT be for Docker)
- **500 errors on `/api/v4/results/latest`**: Database connection failed
- **Empty results in production**: Check Azure Container App environment variables
- **Local data not showing**: Verify MongoDB Compass connected to `localhost:27017` and database is `template-doctor`

## Configuration Architecture (Express Migration)

The configuration system has three layers optimized for the containerized architecture:

1. **Backend** (`packages/server/.env`): Express server configuration
    - Required: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GH_WORKFLOW_TOKEN`
    - Copied from root `.env` during Docker build
    - Used by OAuth token exchange and API endpoints
    - Port configured via `PORT` (must match frontend port for OAuth - default: 3000)

2. **Frontend** (`packages/app/config.json`): Client configuration
    - Required: `githubOAuth.clientId` (must match server's `GITHUB_CLIENT_ID`)
    - OAuth callback URL must match the port where both frontend and backend are served
    - Backend URLs (deprecated - both run on same port now):
        - Docker/Preview: Same port as frontend (port 3000)
        - Production: Same origin
    - Three-tier override system:
        - `config.json` - Base configuration
        - `config.local.json` - Local overrides (not committed)
        - `config.preview.json` - Preview/production overrides

3. **Environment** (`.env` at repo root): Shared configuration
    - Used by build tools, Docker Compose, and copied to backend
    - Single source of truth for GitHub tokens and OAuth credentials

**OAuth Flow (Port 3000):**

- Frontend and backend both run on `http://localhost:3000`
- OAuth callback: `http://localhost:3000/callback.html`
- Token exchange: Same-origin request to `/api/v4/github-oauth-token`
- Combined Docker image handles routing internally

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

### API Smoke Script

For a quick end‑to‑end verification of the Express endpoints (config, validation, analysis, etc.) use the smoke script:

```bash
./scripts/smoke-api.sh            # assumes host at http://localhost:3001 and reads .env
BASE=http://localhost:3001 ./scripts/smoke-api.sh   # override base
DRY_RUN=1 ./scripts/smoke-api.sh  # print commands only
```

The script will:

1. Load variables from `.env` (simple KEY=VALUE lines)
2. Probe each public endpoint (GET/POST) and basic negative routes
3. Attempt authenticated operations if `GITHUB_TOKEN` is present
4. Summarize success/fail at the end

Environment variable precedence: explicitly exported shell vars > `.env`. Override any value by exporting before invoking the script.

The script exits non‑zero on the first critical failure (missing endpoint / unexpected HTTP code) so it can be wired into CI.

**Note**: Update `BASE` to match your Express server port (default: 3001)

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
- `packages/server/src/routes/`: Express API route handlers
- `packages/server/src/middleware/`: CORS, error handling, logging
- `docs/development/ENVIRONMENT_VARIABLES.md`: Complete reference of all environment variables
- `docs/development/OAUTH_CONFIGURATION.md`: OAuth setup details
- `docs/development/EXPRESS_MIGRATION_MATRIX.md`: Azure Functions → Express migration tracking
- `docs/development/AZD_VALIDATION_ARTIFACT_PARSING.md`: **CRITICAL** - Implementation plan for accurate AZD validation (ACTIVE WORK)
- `docs/usage/GITHUB_ACTION_SETUP.md`: GitHub Action setup guide
- `docker-compose.yml`: Multi-container development setup
- `Dockerfile.combined`: Single-container production build

## Security Considerations

- Sensitive credentials should be stored in environment variables, not committed to the repo
- GitHub OAuth requires different app registrations for local and production environments
- Express server validates CORS origins and handles authentication middleware
- The Security Analysis feature reviews Bicep files for security best practices
- Docker containers run with minimal privileges
- Environment variables are passed securely through Docker secrets in production

### SAML/SSO and Forking Policy

- Organization SAML/SSO does NOT block creating a fork. Only direct access to organization repository content can be constrained by SAML/SSO policies.
- Therefore, agents must always use a fork-first workflow for any repository that is not owned by the authenticated user.
- Never issue content reads (GET to contents/trees/etc.) against the upstream organization repo. All content operations must target the user’s fork namespace.
- If a fork appears to fail for any reason, do not attribute it to SAML/SSO. Instead, retry briefly and log a neutral message. As a fallback, instruct the operator to create the fork from the GitHub UI; subsequent scans will operate exclusively on the fork.

## Common Troubleshooting

- **OAuth redirect issues**: Ensure ports match between GitHub OAuth app settings and local server. **CRITICAL**: Both frontend and backend must run on port 3000 (the OAuth callback port). Using different ports (e.g., frontend on 4000, backend on 3001) will break OAuth authentication.
- **Express server not starting**: Check `.env` file exists and has required variables, verify port 3001 is not in use
- **Docker issues**: Ensure Docker and Docker Compose are installed and running, check `docker-compose logs` for errors
- **Configuration mismatch**: Verify `config.json` has correct `githubOAuth.clientId` matching `.env`
- **Port conflicts**: Kill processes using ports 3000, 3001, 4000 as needed
- **Deployment failures**: Review the CI/CD workflows and environment setup

## Known Quirks

- The frontend has been fully migrated to TypeScript (TS modules are authoritative)
- Results are stored as JS files rather than a database for simplicity
- After "Save Results" creates a PR and the PR is merged, results appear on the site after the nightly deploy or manual admin deploy
- Express migration is in progress: 3/20 endpoints migrated (see EXPRESS_MIGRATION_MATRIX.md)
- Legacy Azure Functions code preserved in separate branch for reference

## Express Architecture Notes

The Express server (`packages/server/`) provides a simplified backend architecture:

- **Route Handlers**: Located in `src/routes/`, one file per major feature (analyze.ts, auth.ts, etc.)
- **Middleware**: CORS handling, error handling, request logging in `src/middleware/`
- **Shared Utilities**: Common functions in `src/shared/` (GitHub client, utilities, types)
- **Port**: Default 3001, configurable via `PORT` environment variable
- **CORS**: Configured to allow frontend origins (localhost:3000, localhost:4000, production domain)
- **Error Handling**: Centralized error handler with proper HTTP status codes
- **Logging**: Request/response logging for debugging

### Migration from Azure Functions

When migrating an Azure Function to Express:

1. Create new route file in `packages/server/src/routes/`
2. Copy core logic from Azure Function
3. Replace `context` with `req`/`res` Express patterns
4. Update error handling to use Express `next(error)` pattern
5. Add route to `src/index.ts`
6. Update `EXPRESS_MIGRATION_MATRIX.md`
7. Add tests in `packages/server/tests/`
8. Update frontend to use new endpoint (if route changed)
9. Run smoke tests: `./scripts/smoke-api.sh`

## Frontend TypeScript Migration & Legacy File Deletion (Production Policy)

This repository is executing a phased migration from legacy browser JavaScript under `packages/app/js/` to TypeScript modules under `packages/app/src/` that are built/bundled. Agents MUST follow these production‑grade rules (no stubs/mocks/throwaway placeholders) when participating in migration or cleanup tasks:

### Authoritative Artifacts

1. Analyzer logic: The authoritative implementation is the TypeScript build output `packages/app/js/analyzer.bundle.js` produced by `packages/app/build-analyzer.js` (esbuild). Do NOT reintroduce logic into `js/analyzer.js`.
2. Runtime configuration: The authoritative source is `src/scripts/runtime-config.ts`, loaded via module import (`src/main.ts` and `callback.html`). The legacy `js/runtime-config.js` must be removed once all pages import the TS module.
3. Report / templates / issue template helpers: Their TypeScript counterparts live under `src/report/`, `src/scripts/`, `src/issue/`, or `src/data/` directories. The similarly named legacy JS files are slated for hard deletion.

### Hard Deletion Requirements

When a legacy JS file has a complete TS replacement with parity:

- Physically delete the legacy file (preferred) OR fully replace its contents with a minimal, deterministic production stub that immediately errors on access—ONLY if technical tooling limitations block physical removal in the current PR. Do **not** leave partial old logic or large commented blobs.
- Ensure no remaining imports or dynamic script tags reference the legacy filename (grep for `js/<name>.js`).
- Update any docs (including this section and `docs/development/migration-matrix.md`) marking the file as removed.
- Run Playwright + unit tests + `smoke-api.sh` to validate no behavioral regression.

### Analyzer File Specifics

`js/analyzer.js` must NOT accumulate stub logic plus legacy method bodies (that creates parsing risk). The only acceptable end states are:

1. File deleted entirely.
2. File replaced by a <= ~20 line strict stub that throws on use and references `analyzer.bundle.js`.

If a bulk patch tool cannot delete the large historical file in the same change set, perform a **full overwrite** (truncate + stub) and open a follow‑up issue to physically remove it in a small PR. Do not postpone the overwrite while leaving unreachable method bodies.

### Environment Variables Clarification

`BASE` (in `.env`) is consumed by `scripts/smoke-api.sh` to know the Azure Functions base URL for local probing (defaults `http://localhost:7071`).
`TD_BACKEND_BASE_URL` is exposed through the runtime-config endpoint to the browser for API calls when the frontend is pointed at a remote Functions instance. During local dev they usually match, but they have distinct purposes—do not assume one automatically sets the other.

### Acceptance Checklist Before Marking a Legacy File “Removed”

- [ ] TS replacement merged and imported everywhere needed.
- [ ] No runtime references (import / dynamic script tag / global eval) to the legacy filename.
- [ ] File deleted OR fully overwritten with strict stub (temporary only if deletion blocked).
- [ ] Playwright focus tests covering affected feature pass.
- [ ] `npm test` overall suite passes (or unrelated flaky tests annotated in PR).
- [ ] `./scripts/smoke-api.sh` succeeds (verifies client settings & analyzer endpoints unaffected).
- [ ] Docs updated (`migration-matrix.md`, this section).

### Prohibited During Migration

- Adding “temporary shim” code that silently forwards calls to both legacy and new implementations.
- Leaving large commented legacy bodies that cause lint, size, or parse overhead.
- Introducing new public globals under legacy names (except the minimal throwing stubs when absolutely necessary as described above).

Following these rules ensures the migration remains auditable, keeps bundle size controlled, and prevents accidental re‑coupling to deprecated globals.

### Phase 2 Deletions (2025-09-29)

The following legacy scripts have been physically removed after confirming 1:1 TypeScript parity, absence of runtime references (grep for script tags/imports), and passing Playwright + smoke tests:

- `packages/app/js/runtime-config.js`
- `packages/app/js/api-client.js`
- `packages/app/js/report-loader.js`
- `packages/app/js/templates-data-loader.js`
- `packages/app/js/issue-template-engine.js`

Analyzer Status: `packages/app/js/analyzer.js` no longer contains legacy logic; it is a minimal dynamic loader stub that injects `analyzer.bundle.js`. This stub will be deleted in a subsequent cleanup once a full grep confirms no stale external references (e.g., downstream docs or integrations) still point to `js/analyzer.js`.

Action Items Before Deleting `analyzer.js` Stub:

1. Grep repo (and any dependent deployment templates if applicable) for `analyzer.js` script tags.
2. Run `npm test` (all suites) and `./scripts/smoke-api.sh`.
3. Remove file and update both this section and `docs/development/migration-matrix.md` (set status to Removed).
4. Re-run Playwright focused analyzer-related specs (add one if gap identified) to ensure bundle loads deterministically.

Do not reintroduce logic into `analyzer.js`; only proceed directly to deletion once conditions met.
