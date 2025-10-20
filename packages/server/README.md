# Template Doctor Express Server

Express-based API server for Template Doctor, replacing Azure Functions.

## Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your GitHub tokens
   ```

3. **Development:**

   ```bash
   npm run dev
   ```

4. **Production:**
   ```bash
   npm run build
   npm start
   ```

## Environment Variables

| Variable               | Required | Description                        |
| ---------------------- | -------- | ---------------------------------- |
| `PORT`                 | No       | Server port (default: 7071)        |
| `GITHUB_CLIENT_ID`     | Yes      | GitHub OAuth App Client ID         |
| `GITHUB_CLIENT_SECRET` | Yes      | GitHub OAuth App Secret            |
| `GITHUB_TOKEN`         | Yes      | GitHub Personal Access Token       |
| `GH_WORKFLOW_TOKEN`    | Yes      | GitHub PAT for workflow operations |

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/v4/analyze-template` - Analyze a template
- `POST /api/v4/github-oauth-token` - OAuth token exchange
- `GET /api/v4/client-settings` - Runtime configuration

## Docker

```bash
# Build
docker build -t template-doctor-server .

# Run
docker run -p 7071:7071 --env-file .env template-doctor-server
```

## Migration Status

### Completed (3/20+)

✅ Server framework (Express + TypeScript)  
✅ Health check endpoint  
✅ OAuth token exchange (`/api/v4/github-oauth-token`)  
✅ Runtime config endpoint (`/api/v4/client-settings`)  
✅ **Analyze template logic (`/api/v4/analyze-template`)** - Full migration complete with fork-first strategy, batch analysis, SAML token handling

### To Migrate (17 remaining)

⏳ Validation endpoints (validation-template, validation-status, validation-callback, validation-cancel, validation-docker-image, validation-ossf)  
⏳ GitHub Actions endpoints (action-trigger, action-run-status, action-run-artifacts)  
⏳ Issue management (issue-create, issue-ai-proxy)  
⏳ Repository operations (repo-fork)  
⏳ Other endpoints (archive-collection, batch-scan-start, submit-analysis-dispatch, add-template-pr, setup)

## Why We Migrated from Azure Functions

**Critical Production Issue**: Azure Static Web Apps with Managed Functions (TypeScript) could not read environment variables despite correct Azure Portal configuration. Same code worked in vanilla JS but failed in TypeScript build.

**Solution**: Migrated to Express + Docker for:

- ✅ Reliable environment variable access (single `.env` file via `dotenv`)
- ✅ Standard Node.js debugging and logging
- ✅ Platform-agnostic container deployment
- ✅ Simpler local development (no Azure Functions Core Tools required)

## Next Steps

1. **Test analyzer endpoint**: Start server and test `/api/v4/analyze-template`
2. **Migrate validation endpoints**: Copy logic from `packages/api/validation-*`
3. **Migrate remaining functions**: Systematically copy and convert all 17 remaining endpoints
4. **Local testing**: Run smoke tests with `./test-server.sh`
5. **Container deployment**: Build and deploy Docker container to Azure Container Apps
