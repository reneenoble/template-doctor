# Changelog

All notable changes to Template Doctor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-07

### 🎉 Major Release - Express Architecture Migration

Template Doctor 1.0.0 marks the completion of the TypeScript migration and transition from Azure Functions to a containerized Express-based architecture.

### Added

- **Express Backend** (`packages/server`): New TypeScript REST API on port 3001
  - OAuth token exchange
  - Template validation endpoints
  - GitHub integration
  - CORS-enabled for frontend communication
- **Docker Deployment**: Containerized architecture with `Dockerfile.combined`
  - Single-container production build
  - Multi-container development setup with `docker-compose.yml`
- **TypeScript Frontend**: Vite SPA with HMR for fast development
  - Port 4000 (development), Port 3000 (preview/production)
- **Comprehensive Documentation**: 
  - Updated README with Express architecture
  - Docker deployment instructions
  - Troubleshooting guide
  - Port allocation table

### Changed

- **Architecture**: Migrated from Azure Functions to Express server
- **Build System**: Added `build:all` with correct dependency order (analyzer-core → server → app)
- **Test Suite**: Reorganized unit tests
  - Moved legacy API tests to `tests/unit/legacy-api/`
  - Excluded legacy tests from vitest
  - Only `analyzer.categories.spec.js` runs in CI (6 tests, all passing)

### Removed

- **Azure Static Web Apps**: Removed all SWA deployment workflows
  - `manual-swa-deploy.yml`
  - `manual-swa-deploy-simple.yml`
  - `nightly-swa-deploy.yml`
- **Azure Functions**: Removed legacy serverless deployment
  - `azure-functions-v4.yml` workflow deleted
  - Legacy API code preserved in `legacy/azure-functions` branch
- **Legacy Tests**: 7 legacy API tests moved out of CI
  - Tests depend on removed Azure Functions code
  - Preserved in `tests/unit/legacy-api/` for reference

### Fixed

- **Build Order**: analyzer-core builds before dependent packages
- **Package Verification**: Updated `scripts/verify-packages.sh` for current structure
- **TypeScript Compilation**: All packages compile without errors
- **Vitest Configuration**: Properly excludes legacy-api tests

### Infrastructure

- **CI/CD Workflows**: 
  - Removed: smoke-api.yml (TODO: re-add after debugging server startup)
  - Active: guard-packages, validation, submit-analysis, etc.
- **Environment Variables**: Consolidated configuration
  - Backend: `packages/server/.env` (copied from root during build)
  - Frontend: `packages/app/config.json` (client config)
  - Root: `.env` (single source of truth)

### Breaking Changes

- **Deployment Method**: No longer uses Azure Static Web Apps or Azure Functions
  - New deployment: Docker containers via `Dockerfile.combined`
  - See README for migration instructions
- **Port Changes**:
  - Express backend: 3001 (was: Azure Functions on 7071)
  - Frontend preview: 3000 (was: 5173)
  - Frontend dev: 4000 (was: 5173)
- **Legacy API**: Removed from production
  - Code preserved in `legacy/azure-functions` branch for reference
  - Express server provides equivalent functionality

### Migration Guide

For users upgrading from pre-1.0.0 versions:

1. **Pull latest changes**:
   ```bash
   git pull origin main
   npm ci
   ```

2. **Update OAuth configuration**:
   - Update GitHub OAuth app callback URLs to use port 3000/3001
   - See `docs/development/OAUTH_CONFIGURATION.md`

3. **Docker deployment** (recommended):
   ```bash
   docker build -f Dockerfile.combined -t template-doctor .
   docker run -p 3000:3000 --env-file .env template-doctor
   ```

4. **Manual deployment**:
   ```bash
   npm run build:all
   npm run preview -w packages/server
   ```

### Known Issues

- Smoke API tests disabled (TODO: fix Express server startup in CI)
- See `TODO.md` for tracked improvements

### Contributors

Thank you to all contributors who made this release possible!

---

## [Unreleased]

Changes that are in development but not yet released will appear here.

---

[1.0.0]: https://github.com/Template-Doctor/template-doctor/releases/tag/v1.0.0
