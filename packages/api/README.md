# Template Doctor API Functions

This directory contains the Azure Functions backend for Template Doctor.

## Architecture

### Azure Functions SDK v3 with Traditional Bindings

This project uses **Azure Functions SDK v3** (`@azure/functions@^3.5.0`) with **traditional function.json bindings**, NOT the v4 programming model with decorators.

**Why SDK v3?**

- More mature and stable for production workloads
- Better compatibility with existing tooling and deployment pipelines
- Well-tested integration with Azure Static Web Apps
- Simpler debugging and local development experience

**Why Traditional Bindings?**

- Each function has its own folder with a `function.json` file that defines:
    - HTTP trigger configuration
    - Route mapping
    - Authentication level
    - Reference to the compiled JavaScript via `scriptFile`
- This approach is:
    - Explicit and easier to understand
    - Compatible with both local development and Azure deployment
    - Supported by Azure Static Web Apps deployment

### Structure

```
packages/api/
├── host.json                          # Azure Functions host configuration
├── package.json                       # Dependencies and scripts
├── tsconfig.json                      # TypeScript compilation settings
├── generate-function-jsons.js         # Script to generate function.json files
│
├── [function-name].ts                 # TypeScript source (20 functions)
├── [function-name]/
│   └── function.json                  # Binding configuration
│
├── dist/                              # Compiled JavaScript (gitignored locally)
│   ├── [function-name].js             # Compiled function handlers
│   ├── shared/                        # Shared utilities
│   ├── github/                        # GitHub integration
│   └── platform/                      # Platform abstractions
│
├── shared/                            # Shared TypeScript utilities
├── github/                            # GitHub client and helpers
└── platform/                          # HTTP wrappers and types
```

## Function Export Pattern

All functions follow this pattern:

```typescript
import { Context } from "@azure/functions";
import { wrapHttp } from "./platform/http";

export default wrapHttp(async (req: any, _ctx: Context, requestId: string) => {
    // Function logic here
    return {
        status: 200,
        body: { message: "Success" },
    };
});
```

**Important Notes:**

1. Functions use `export default` which compiles to `exports.default` in CommonJS
2. Azure Functions runtime discovers this default export automatically
3. The `function.json` uses `scriptFile: "../dist/[name].js"` to reference compiled code
4. No explicit `entryPoint` needed - Azure finds the default export

## Development

### Local Development

1. **Install dependencies:**

    ```bash
    npm install
    ```

2. **Compile TypeScript:**

    ```bash
    npm run build
    ```

3. **Start local Functions host:**

    ```bash
    npm start
    # Or: func start
    ```

4. **Test endpoints:**
    ```bash
    curl http://localhost:7071/api/v4/client-settings
    ```

### Adding a New Function

1. **Create TypeScript file:**

    ```bash
    touch packages/api/my-new-function.ts
    ```

2. **Add function definition to `generate-function-jsons.js`:**

    ```javascript
    const functions = [
        // ... existing functions
        {
            name: "my-new-function",
            route: "v4/my-endpoint",
            methods: ["get", "post", "options"],
        },
    ];
    ```

3. **Generate function.json:**

    ```bash
    node generate-function-jsons.js
    ```

4. **Build and test:**
    ```bash
    npm run build
    npm start
    ```

## Deployment

### Azure Static Web Apps Deployment

The deployment workflow:

1. **Build Process** (`nightly-swa-deploy.yml` or `manual-swa-deploy.yml`):

    ```bash
    npm ci
    npm run build -w packages/api  # Compiles TS → dist/
    ```

2. **Deploy Configuration** (`staticwebapp.config.json`):

    ```json
    {
        "platform": {
            "apiRuntime": "node:18"
        }
    }
    ```

3. **What Gets Deployed:**
    - All `function.json` files (bindings)
    - All compiled `dist/*.js` files
    - `host.json` (Functions host config)
    - `package.json` (dependencies)
    - `node_modules/` (runtime dependencies)

4. **Azure Static Web Apps automatically:**
    - Discovers all function folders with `function.json`
    - Loads the referenced `scriptFile` from `dist/`
    - Registers routes under `/api/v4/[endpoint]`

## Environment Variables

Functions read configuration from environment variables:

- `GITHUB_CLIENT_ID` - GitHub OAuth client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth client secret
- `GH_WORKFLOW_TOKEN` - GitHub token for workflow triggers
- See `docs/development/ENVIRONMENT_VARIABLES.md` for complete list

In production (Azure Static Web Apps), these are configured as Application Settings.

## Available Endpoints

All endpoints are prefixed with `/api/v4/`:

| Endpoint                    | Method   | Function                   | Description                   |
| --------------------------- | -------- | -------------------------- | ----------------------------- |
| `/client-settings`          | GET      | `runtime-config`           | Public configuration          |
| `/github-oauth-token`       | POST     | `github-oauth-token`       | OAuth token exchange          |
| `/analyze-template`         | POST     | `analyze-template`         | Template analysis             |
| `/validation-template`      | POST     | `validation-template`      | AZD validation                |
| `/validation-status`        | GET/POST | `validation-status`        | Check validation status       |
| `/validation-cancel`        | POST     | `validation-cancel`        | Cancel validation             |
| `/validation-callback`      | POST     | `validation-callback`      | Validation webhook            |
| `/validation-ossf`          | POST     | `validation-ossf`          | OSSF Scorecard check          |
| `/validation-docker-image`  | POST     | `validation-docker-image`  | Docker image scan             |
| `/archive-collection`       | GET      | `archive-collection`       | Download results              |
| `/add-template-pr`          | POST     | `add-template-pr`          | Create PR to add template     |
| `/submit-analysis-dispatch` | POST     | `submit-analysis-dispatch` | Trigger analysis workflow     |
| `/workflow-trigger`         | POST     | `action-trigger`           | Trigger GitHub Actions        |
| `/workflow-run-status`      | GET/POST | `action-run-status`        | Check workflow status         |
| `/workflow-run-artifacts`   | GET/POST | `action-run-artifacts`     | Get workflow artifacts        |
| `/setup`                    | POST     | `setup`                    | Setup configuration overrides |
| `/issue-ai`                 | POST     | `issue-ai-proxy`           | AI issue enrichment           |
| `/issue-create`             | POST     | `issue-create`             | Create GitHub issue           |
| `/repo-fork`                | POST     | `repo-fork`                | Fork repository               |
| `/batch-scan-start`         | POST     | `batch-scan-start`         | Start batch scan              |

## Troubleshooting

### "Unable to determine function entry point"

This error during `func start` is a **warning**, not a failure. Azure Functions logs this when scanning for exports, but still successfully loads the `default` export. Your functions will work correctly.

### ESM Module Errors

Some functions (`issue-create`, `repo-fork`, `batch-scan-start`) use `@octokit/rest@^22` which is pure ESM. The current workaround uses CommonJS `require()` which may log warnings but functions correctly in production.

### Port Already in Use

If `func start` fails with EADDRINUSE:

```bash
lsof -ti :7071 | xargs kill -9
func start
```

### Functions Not Loading

1. Verify `function.json` exists for each function
2. Check `scriptFile` path points to `../dist/[name].js`
3. Ensure TypeScript compiled successfully: `npm run build`
4. Check `dist/` contains the compiled `.js` files

## Testing

### Local Testing

```bash
npm start  # In one terminal

# In another terminal:
curl http://localhost:7071/api/v4/client-settings
```

### Smoke Tests

```bash
# From repo root:
./scripts/smoke-api.sh
```

## Migration Notes

This architecture was established October 2025 during the TypeScript migration. Key decisions:

1. **Flat structure**: All `.ts` files at `packages/api/` root (not nested in `src/`)
2. **Traditional bindings**: Using function.json files instead of v4 decorators
3. **SDK v3**: Using `@azure/functions@^3.5.0` for stability
4. **CommonJS output**: TypeScript compiles to CommonJS for Azure Functions compatibility

Previous attempts to use the v4 programming model (function decorators, no function.json files) caused deployment issues with Azure Static Web Apps. The traditional binding approach is more reliable.

## References

- [Azure Functions JavaScript Developer Guide](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node)
- [Azure Static Web Apps API](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions)
- [Function.json Schema](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference#function-code)
