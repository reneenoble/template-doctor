# Infrastructure Deployment

This directory contains Bicep templates for deploying Template Doctor to Azure Container Apps with Cosmos DB using **Managed Identity** (no connection strings!).

## Quick Start

```bash
# 1. Set up your .env file with GitHub credentials
./scripts/full-setup.sh

# 2. Initialize azd
azd init

# 3. Deploy everything
azd up
```

## What Gets Deployed

1. **Resource Group**: `rg-<environmentName>`
2. **Cosmos DB**: Serverless MongoDB API account
3. **Container Registry**: For Docker images
4. **Container Apps Environment**: Hosting environment
5. **Container App**: Template Doctor application with System-Assigned Managed Identity
6. **Role Assignment**: Grants Container App MI access to Cosmos DB

## Architecture

```
┌─────────────────────────────────────┐
│   Container App                     │
│   • System-Assigned MI enabled      │
│   • COSMOS_ENDPOINT env var set     │
│   • No connection strings!          │
└──────────┬──────────────────────────┘
           │
           │ Acquires token automatically
           ▼
┌─────────────────────────────────────┐
│   Cosmos DB (MongoDB API)           │
│   • RBAC enabled                    │
│   • MI granted Data Contributor role│
└─────────────────────────────────────┘
```

## Files

- **`main.bicep`**: Main orchestration template
  - Provisions all resources
  - Sets up Managed Identity authentication
  - Configures Container App with COSMOS_ENDPOINT

- **`database.bicep`**: Cosmos DB module
  - Creates Cosmos DB account (serverless, MongoDB API)
  - Creates `template-doctor` database
  - Enables diagnostics and monitoring

- **`cosmos-role-assignment.bicep`**: RBAC module
  - Grants Container App's MI access to Cosmos DB
  - Separated to avoid circular dependency

- **`core/host/`**: Reusable modules
  - `container-app.bicep`: Container App configuration
  - `container-registry.bicep`: ACR setup
  - `container-apps-environment.bicep`: Environment setup

## Environment Variables Required

Set these in your `.env` file before running `azd up`:

```bash
# GitHub OAuth (REQUIRED)
GITHUB_CLIENT_ID=your_oauth_client_id
GITHUB_CLIENT_SECRET=your_oauth_client_secret

# GitHub PATs (REQUIRED)
GITHUB_TOKEN=your_github_token
GH_WORKFLOW_TOKEN=your_workflow_token
GITHUB_TOKEN_ANALYZER=your_analyzer_token

# Admin Access
ADMIN_GITHUB_USERS=your-username,teammate

# Optional
DISPATCH_TARGET_REPO=YourOrg/your-fork
```

**DO NOT set `MONGODB_URI`** - production uses Managed Identity with `COSMOS_ENDPOINT`.

## Deployment Flow

1. **Cosmos DB** created first
2. **Container Registry** created
3. **Container Apps Environment** created
4. **Container App** created with:
   - System-Assigned Managed Identity
   - Environment variable: `COSMOS_ENDPOINT=https://cosmos-xxx.documents.azure.com`
5. **Role Assignment** grants Container App's MI access to Cosmos DB
6. Application starts and:
   - Uses `DefaultAzureCredential` to get token
   - Connects to Cosmos DB using token (no connection string!)

## Managed Identity Details

### How It Works

```typescript
// Code in packages/server/src/services/database.ts
const cosmosEndpoint = process.env.COSMOS_ENDPOINT;

// Acquire token using Container App's Managed Identity
const credential = new DefaultAzureCredential();
const token = await credential.getToken('https://cosmos.azure.com/.default');

// Build connection string with token as credentials
const connString = `mongodb://${token}:${token}@${endpoint}:10255/?ssl=true...`;
const client = new MongoClient(connString);
```

### Why Managed Identity?

✅ **No secrets** in code or configuration  
✅ **Automatic token rotation** by Azure  
✅ **RBAC permissions** for fine-grained access  
✅ **Audit logging** of all database access  
✅ **Security best practice** for production

## Outputs

After `azd up` succeeds, you'll get:

```bash
AZURE_LOCATION=eastus
AZURE_RESOURCE_GROUP=rg-prod
COSMOS_ENDPOINT=https://cosmos-abc123.documents.azure.com
COSMOS_DATABASE_NAME=template-doctor
SERVICE_WEB_URI=https://web-abc123.azurecontainerapps.io
SERVICE_WEB_IDENTITY_PRINCIPAL_ID=12345678-1234-1234-1234-123456789abc
```

Access your deployed app at `SERVICE_WEB_URI`.

## Troubleshooting

### "Failed to acquire access token"

**Cause**: Managed Identity not enabled on Container App.

**Fix**: Verify in Azure Portal or re-run:
```bash
azd up
```

### "MongoServerError: requires authentication"

**Cause**: Role assignment didn't complete.

**Fix**: Check role assignment in Azure Portal:
1. Go to Cosmos DB → Data Explorer → RBAC
2. Verify Container App's MI has "Cosmos DB Built-in Data Contributor" role
3. If missing, re-run: `azd up`

### "COSMOS_ENDPOINT is not set"

**Cause**: Deployment didn't set environment variable.

**Fix**: Manually set it:
```bash
az containerapp update \
  --name <app-name> \
  --resource-group <rg-name> \
  --set-env-vars "COSMOS_ENDPOINT=https://<cosmos-account>.documents.azure.com"
```

## Clean Up

```bash
# Delete all Azure resources
azd down

# Delete local state
rm -rf .azure
```

## Documentation

- **Full MI Guide**: [../docs/deployment/PRODUCTION_DATABASE_MANAGED_IDENTITY.md](../docs/deployment/PRODUCTION_DATABASE_MANAGED_IDENTITY.md)
- **Cosmos DB Setup**: [../docs/deployment/COSMOS_DB_PORTAL_SETUP.md](../docs/deployment/COSMOS_DB_PORTAL_SETUP.md)
- **Quick Start**: [../QUICKSTART.md](../QUICKSTART.md)

## Support

- Issues: https://github.com/Azure-Samples/template-doctor/issues
- Discussions: https://github.com/Azure-Samples/template-doctor/discussions
