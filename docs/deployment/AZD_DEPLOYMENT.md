# Azure Developer CLI (azd) Deployment Guide

This guide explains how to deploy Template Doctor to Azure using Azure Developer CLI (azd).

## Architecture

The deployment provisions:

- **Azure Cosmos DB** (MongoDB API, Serverless) - Database for storing analysis results
- **Azure Container Registry** - Hosts Docker images
- **Azure Container Apps Environment** - Managed Kubernetes-like environment
- **Azure Container App** - Runs the Template Doctor combined container
- **Log Analytics Workspace** - Monitoring and diagnostics

## Prerequisites

1. **Install Azure Developer CLI (azd)**:
   ```bash
   # macOS/Linux
   curl -fsSL https://aka.ms/install-azd.sh | bash
   
   # Windows (PowerShell)
   powershell -ex AllSigned -c "Invoke-RestMethod 'https://aka.ms/install-azd.sh' | Invoke-Expression"
   ```

2. **Install Azure CLI**:
   ```bash
   # macOS
   brew install azure-cli
   
   # Windows
   winget install Microsoft.AzureCLI
   
   # Linux
   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
   ```

3. **Install Docker**:
   - Docker Desktop: https://www.docker.com/products/docker-desktop

4. **GitHub Configuration**:
   
   **A. OAuth App (for user login)**:
   - Create OAuth app at https://github.com/settings/developers
   - Set Authorization callback URL to: `https://<your-app-url>/callback.html`
   - Note down Client ID and Client Secret
   
   **B. Personal Access Token (for repository operations)**:
   - Create token at https://github.com/settings/tokens/new
   - Required scopes:
     - ✅ `repo` - Full control of private repositories (includes cloning, creating PRs)
     - ✅ `workflow` - Update GitHub Action workflows
     - ✅ `read:org` - Read org membership (for SAML/SSO handling)
   - Note down the token (you won't see it again!)

## Quick Start

### 1. Login to Azure

```bash
azd auth login
```

### 2. Configure GitHub Credentials (Before Provision)

Edit `.env` in the repository root and add your GitHub credentials:

```bash
# Edit .env file
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=your-oauth-client-secret-here
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**What each token is used for:**

- **GITHUB_CLIENT_ID/SECRET**: OAuth login for users to authenticate
- **GITHUB_TOKEN**: Backend operations:
  - 🔍 Cloning repositories for analysis
  - 💾 Creating PRs to save results
  - 🚀 Triggering workflow runs
  - 📊 Accessing repository metadata
  - 🔐 Handling SAML/SSO repositories

**⚠️ Important**: Add these to `.env` BEFORE running `azd provision`. The values will be automatically loaded by `azd`.

**Alternative**: You can also set them via `azd env set` after initialization:
```bash
azd env set GITHUB_CLIENT_ID "your-value"
azd env set GITHUB_CLIENT_SECRET "your-value"
azd env set GITHUB_TOKEN "your-value"
```

### 3. Initialize and Provision

```bash
# Initialize azd environment (creates .azure/<env>/ directory)
azd init

# Or use a specific environment name
azd env new production

# Provision infrastructure (reads secrets from .env automatically)
azd provision
```

### 4. Deploy Application

```bash
# Build Docker image and deploy to Container Apps
azd deploy
```

This will:
1. Build the Docker image from `Dockerfile.combined`
2. Push image to Azure Container Registry
3. Deploy to Azure Container Apps
4. Update environment with connection strings

### 5. Get Application URL

```bash
# Show service endpoints
azd show

# Or get URL directly
azd env get-values | grep SERVICE_WEB_URI
```

Visit the URL to access Template Doctor!

## Environment Variables

After `azd provision`, these are automatically set in `.azure/<environment>/.env`:

```bash
AZURE_LOCATION=eastus2
AZURE_SUBSCRIPTION_ID=<your-sub-id>
AZURE_RESOURCE_GROUP=rg-production
AZURE_CONTAINER_REGISTRY_ENDPOINT=cr<unique>.azurecr.io
SERVICE_WEB_URI=https://<app-name>.azurecontainerapps.io
MONGODB_URI=mongodb://<cosmos-account>.mongo.cosmos.azure.com:10255/...
COSMOS_ENDPOINT=https://<cosmos-account>.documents.azure.com:443/
```

You must manually set (before deploying):

```bash
# GitHub OAuth (for user authentication)
GITHUB_CLIENT_ID=<from-github-oauth-app>
GITHUB_CLIENT_SECRET=<from-github-oauth-app>

# GitHub Personal Access Token (for repository operations)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**⚠️ IMPORTANT**: All three GitHub secrets are **REQUIRED** for the application to work properly.

**📖 Detailed token setup guide**: See [GITHUB_TOKEN_SETUP.md](./GITHUB_TOKEN_SETUP.md) for comprehensive instructions on creating and configuring GitHub credentials.

## Update GitHub OAuth Callback URL

After deployment, update your GitHub OAuth app:

1. Go to https://github.com/settings/developers
2. Select your OAuth app
3. Update **Authorization callback URL** to:
   ```
   https://<your-app-fqdn>/callback.html
   ```
   Get FQDN from: `azd env get-values | grep SERVICE_WEB_URI`

## Common Operations

### View Logs

```bash
# Stream logs from Container App
az containerapp logs show \
  --name ca-web-<unique-id> \
  --resource-group rg-<environment> \
  --follow
```

### Update Environment Variables

```bash
# Set new environment variable
azd env set MY_VAR "my-value"

# Re-deploy to apply changes
azd deploy
```

### Scale Container App

```bash
# Update main.bicep to change minReplicas/maxReplicas
# Then re-provision
azd provision
```

### Access Cosmos DB

```bash
# Get connection string
azd env get-values | grep MONGODB_URI

# Or via Azure CLI
az cosmosdb keys list \
  --name cosmos-<unique-id> \
  --resource-group rg-<environment> \
  --type connection-strings
```

### Connect with MongoDB Compass

1. Get connection string:
   ```bash
   azd env get-values | grep MONGODB_URI
   ```

2. Open MongoDB Compass and paste the connection string
3. Database: `template-doctor`
4. Collections: `repos`, `analysis`

## Monitoring

### Application Insights

Logs are sent to Log Analytics workspace automatically.

**Query logs:**
```bash
az monitor log-analytics query \
  --workspace <workspace-id> \
  --analytics-query "ContainerAppConsoleLogs_CL | where TimeGenerated > ago(1h) | project TimeGenerated, Log_s | order by TimeGenerated desc"
```

### Cosmos DB Metrics

**View in Azure Portal:**
1. Navigate to Cosmos DB account
2. Monitoring → Metrics
3. Key metrics:
   - Total Request Units
   - Total Requests
   - Throttled Requests (429s)

**Set up alerts:**
```bash
az monitor metrics alert create \
  --name "High RU Usage" \
  --resource-group rg-<environment> \
  --scopes /subscriptions/<sub-id>/resourceGroups/rg-<environment>/providers/Microsoft.DocumentDB/databaseAccounts/cosmos-<unique-id> \
  --condition "avg TotalRequestUnits > 1000" \
  --description "Alert when RU usage is high"
```

## Cost Optimization

### Cosmos DB Serverless

- **No minimum cost** - Pay only for RUs consumed
- **Best for:** Dev/test, variable workloads
- **Limits:** 1M RU/s max, 50 GB storage

**Typical costs (approximate):**
- 1M read operations: ~$0.40
- 1M write operations: ~$2.00
- Storage: ~$0.25/GB/month

### Container Apps

**Free tier includes:**
- 180,000 vCPU-seconds
- 360,000 GiB-seconds
- 2 million requests

**Current configuration:**
- CPU: 0.5 cores
- Memory: 1 GiB
- Min replicas: 1
- Max replicas: 3

### Estimated Monthly Cost

For low-medium traffic (~10K analyses/month):

| Resource | Cost |
|----------|------|
| Cosmos DB (Serverless) | $5-20 |
| Container Apps | $0-10 (within free tier) |
| Container Registry | $5 (Basic tier) |
| Log Analytics | $0-5 (first 5GB free) |
| **Total** | **$10-40/month** |

## Troubleshooting

### Deployment Fails: "Image not found"

The first deployment uses a placeholder image. If the container fails to start:

1. Check Container App logs:
   ```bash
   az containerapp logs show --name ca-web-<unique-id> --resource-group rg-<environment> --follow
   ```

2. Verify image was pushed:
   ```bash
   az acr repository list --name cr<unique-id>
   ```

3. Re-deploy:
   ```bash
   azd deploy
   ```

### OAuth Login Fails: "Redirect URI mismatch"

Update GitHub OAuth app callback URL to match your deployed app:
```
https://<app-fqdn>/callback.html
```

### Database Connection Fails

1. Verify Cosmos DB connection string:
   ```bash
   azd env get-values | grep MONGODB_URI
   ```

2. Check Container App environment variables:
   ```bash
   az containerapp show --name ca-web-<unique-id> --resource-group rg-<environment> --query properties.template.containers[0].env
   ```

3. Test connection from local MongoDB Compass

### High Costs / RU Throttling

If you see 429 errors or unexpected costs:

1. Check RU consumption:
   - Azure Portal → Cosmos DB → Metrics → Total Request Units

2. Add indexes:
   ```javascript
   db.repos.createIndex({ "latestAnalysis.scanDate": -1 })
   db.analysis.createIndex({ repoUrl: 1, scanDate: -1 })
   ```

3. Optimize queries in application code

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/azure-deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install azd
        uses: Azure/setup-azd@v1.0.0
      
      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Deploy with azd
        run: |
          azd env refresh -e production --no-prompt
          azd env set GITHUB_CLIENT_ID "${{ secrets.GH_CLIENT_ID }}"
          azd env set GITHUB_CLIENT_SECRET "${{ secrets.GH_CLIENT_SECRET }}"
          azd deploy --no-prompt
        env:
          AZURE_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          AZURE_LOCATION: eastus2
```

### Azure DevOps

Pipeline is available at `.azdo/pipelines/azure-dev.yml`

Setup:
1. Create variable group `template-doctor-secrets`
2. Add variables:
   - `AZURE_SUBSCRIPTION_ID`
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
3. Create service connection to Azure
4. Run pipeline

## Clean Up

### Delete All Resources

```bash
# Delete entire environment (resource group + all resources)
azd down

# Or delete specific environment
azd down --purge --force
```

### Keep Infrastructure, Remove App

```bash
# Remove just the container app
az containerapp delete --name ca-web-<unique-id> --resource-group rg-<environment>
```

## Advanced Configuration

### Custom Domain

1. Add custom domain to Container App:
   ```bash
   az containerapp hostname add \
     --name ca-web-<unique-id> \
     --resource-group rg-<environment> \
     --hostname app.yourdomain.com
   ```

2. Add DNS CNAME record:
   ```
   app.yourdomain.com -> <app-fqdn>
   ```

3. Update GitHub OAuth callback URL

### Managed Identity for Cosmos DB

Current setup uses connection string. To use Managed Identity:

1. Uncomment `principalId` in `infra/main.bicep`
2. Update `database.ts` to use `DefaultAzureCredential`
3. Re-provision: `azd provision`

See [database.bicep](../../infra/database.bicep) for role assignment logic.

### Multiple Environments

```bash
# Create environments
azd env new dev
azd env new staging
azd env new production

# Switch between environments
azd env select dev
azd deploy

azd env select production
azd deploy
```

## Next Steps

- [ ] Set up monitoring alerts
- [ ] Configure auto-scaling rules
- [ ] Add custom domain
- [ ] Set up CI/CD pipeline
- [ ] Configure backup retention
- [ ] Review security recommendations

## See Also

- [Azure Developer CLI Documentation](https://learn.microsoft.com/azure/developer/azure-developer-cli/)
- [Azure Container Apps Documentation](https://learn.microsoft.com/azure/container-apps/)
- [Cosmos DB for MongoDB API](https://learn.microsoft.com/azure/cosmos-db/mongodb/introduction)
- [DATA_LAYER.md](../development/DATA_LAYER.md) - Database setup and migration
