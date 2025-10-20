# Deployment Documentation

This directory contains deployment guides and configuration documentation for Template Doctor.

## 🚀 Quick Start (New Users Start Here!)

**Never deployed to Azure before?** Follow this simple guide:

👉 **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Deploy in 5 minutes

**Summary**: Add GitHub credentials to `.env` → Run `azd up` → Done!

## Deployment Guides

1. **[GETTING_STARTED.md](./GETTING_STARTED.md)** - ⭐ **START HERE** - Simple 5-minute deployment
2. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - One-page command reference
3. **[AZD_DEPLOYMENT.md](./AZD_DEPLOYMENT.md)** - Comprehensive deployment guide
4. **[GITHUB_TOKEN_SETUP.md](./GITHUB_TOKEN_SETUP.md)** - Detailed GitHub credentials guide

## Deployment Options

### Option 1: Azure Developer CLI (Recommended)

Uses `azd` for automated infrastructure provisioning and deployment.

**Pros:**

- ✅ One command to provision and deploy
- ✅ Handles all Azure resources automatically
- ✅ Environment management built-in
- ✅ Works with CI/CD pipelines

**Cons:**

- ❌ Requires `azd` CLI installation
- ❌ Less control over individual resources

**Guide**: [AZD_DEPLOYMENT.md](./AZD_DEPLOYMENT.md)

**Quick Deploy**:

```bash
azd auth login
azd init
azd env set GITHUB_CLIENT_ID "xxx"
azd env set GITHUB_CLIENT_SECRET "xxx"
azd env set GITHUB_TOKEN "ghp_xxx"
azd up
```

### Option 2: Azure Portal (Manual)

Create resources manually through Azure Portal.

**Pros:**

- ✅ Visual interface
- ✅ Fine-grained control
- ✅ No CLI tools required

**Cons:**

- ❌ Time-consuming
- ❌ Harder to replicate
- ❌ Manual configuration prone to errors

**Guide**: Coming soon

### Option 3: Azure CLI + Bicep

Use Azure CLI with Bicep templates for infrastructure as code.

**Pros:**

- ✅ Full control over resources
- ✅ Scriptable and repeatable
- ✅ Works in any CI/CD system

**Cons:**

- ❌ More manual steps
- ❌ Requires Bicep knowledge

**Guide**: Coming soon

## Infrastructure Overview

Template Doctor deploys the following Azure resources:

```
┌─────────────────────────────────────────┐
│     Azure Container Apps                │
│  ┌─────────────────────────────────┐   │
│  │   Template Doctor Container     │   │
│  │   - Express Backend (port 3000) │   │
│  │   - Vite Frontend (bundled)     │   │
│  │   - Auto-scaling (1-3 replicas) │   │
│  └─────────────────────────────────┘   │
└──────────────┬──────────────────────────┘
               │
         ┌─────┴─────┐
         ▼           ▼
┌────────────┐  ┌──────────────┐
│ Cosmos DB  │  │     ACR      │
│ (MongoDB)  │  │ (Container   │
│            │  │  Registry)   │
│ - repos    │  │              │
│ - analysis │  │ - Images     │
└────────────┘  └──────────────┘
```

## Architecture Components

| Component              | Purpose                | Pricing Tier |
| ---------------------- | ---------------------- | ------------ |
| **Cosmos DB**          | Database (MongoDB API) | Serverless   |
| **Container Registry** | Docker image storage   | Basic        |
| **Container App**      | Application hosting    | Consumption  |
| **Log Analytics**      | Monitoring and logs    | Pay-per-GB   |

## Environment Configuration

### Required Secrets

All deployments require these GitHub credentials:

1. **GITHUB_CLIENT_ID** - OAuth app client ID
2. **GITHUB_CLIENT_SECRET** - OAuth app client secret
3. **GITHUB_TOKEN** - Personal access token (scopes: repo, workflow, read:org)

**Setup Guide**: [GITHUB_TOKEN_SETUP.md](./GITHUB_TOKEN_SETUP.md)

### Optional Configuration

```bash
# Custom domain
azd env set CUSTOM_DOMAIN "app.yourdomain.com"

# Enable detailed logging
azd env set LOG_LEVEL "debug"

# Adjust scaling
azd env set MIN_REPLICAS "2"
azd env set MAX_REPLICAS "5"
```

## Monitoring

### View Logs

```bash
# Using azd
azd monitor --logs

# Using Azure CLI
az containerapp logs show \
  --name ca-web-<id> \
  --resource-group rg-<env> \
  --follow
```

### Metrics

**Azure Portal**:

1. Navigate to Container App
2. Monitoring → Metrics
3. Key metrics:
   - HTTP requests
   - CPU usage
   - Memory usage
   - Active replicas

**Cosmos DB**:

1. Navigate to Cosmos DB account
2. Monitoring → Metrics
3. Key metrics:
   - Request Units consumed
   - Total requests
   - Throttled requests (429s)

## Cost Optimization

### Development/Staging

- Use serverless Cosmos DB
- Set min replicas to 0 (Container Apps will scale to zero)
- Use Basic tier Container Registry
- Set Log Analytics retention to 7 days

**Estimated cost**: $5-15/month

### Production

- Use serverless Cosmos DB (scales with usage)
- Set min replicas to 1-2 for availability
- Consider Standard tier Container Registry for geo-replication
- Set Log Analytics retention to 30 days
- Enable Point-in-Time Restore for Cosmos DB

**Estimated cost**: $20-50/month (low traffic)

## Disaster Recovery

### Backup Strategy

**Cosmos DB**:

- Continuous backup enabled (7-day PITR)
- Export to Blob Storage monthly
- Test restore quarterly

**Container Images**:

- ACR stores all image versions
- Tag images with build number and git SHA
- Keep last 10 versions per environment

**Configuration**:

- Store `azd` environment files in secure location
- Document all environment variables
- Use Azure Key Vault for production secrets (planned)

### Recovery Procedures

**Database Failure**:

1. Use Point-in-Time Restore in Azure Portal
2. Restore to new Cosmos DB account
3. Update Container App environment variable
4. Redeploy: `azd deploy`

**Application Failure**:

1. Check Container App logs
2. Roll back to previous image:
   ```bash
   az containerapp revision list --name ca-web-<id> -g rg-<env>
   az containerapp revision activate --revision <previous-revision>
   ```

**Complete Environment Failure**:

1. Restore `.azure/<env>/.env` from backup
2. Run `azd provision` to recreate infrastructure
3. Restore Cosmos DB from backup
4. Run `azd deploy` to deploy application

## CI/CD Integration

### GitHub Actions

Example workflow in `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Azure
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Azure/setup-azd@v1
      - uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      - run: |
          azd env refresh -e production
          azd env set GITHUB_TOKEN "${{ secrets.GH_TOKEN }}"
          azd deploy --no-prompt
```

### Azure DevOps

Pipeline template in `.azdo/pipelines/azure-dev.yml` (already created)

## Troubleshooting

### Common Issues

| Issue                                | Cause                             | Solution                               |
| ------------------------------------ | --------------------------------- | -------------------------------------- | ------------- |
| Deployment fails: "Image not found"  | First deployment uses placeholder | Run `azd deploy` again                 |
| OAuth error: "Redirect URI mismatch" | Callback URL not updated          | Update GitHub OAuth app settings       |
| Database connection error            | Connection string not set         | Check `azd env get-values              | grep MONGODB` |
| Analysis fails: "Bad credentials"    | GitHub token not set or invalid   | Verify `GITHUB_TOKEN` with `curl` test |
| High costs                           | Runaway RU consumption            | Check Cosmos DB metrics, add indexes   |

### Debug Mode

```bash
# Enable verbose logging
azd config set alpha.deployment.debug on

# Deploy with debug output
azd deploy --debug

# Check Container App environment
az containerapp show \
  --name ca-web-<id> \
  --resource-group rg-<env> \
  --query properties.template
```

## Security Best Practices

### Secrets Management

- ✅ Use `azd env set` for secrets (never commit to git)
- ✅ Rotate GitHub tokens every 90 days
- ✅ Use fine-grained tokens with minimum scopes
- 🔜 Migrate to Azure Key Vault for production

### Network Security

- ✅ Container Apps use HTTPS by default
- ✅ Cosmos DB requires TLS 1.2+
- 🔜 Add custom domain with SSL certificate
- 🔜 Configure Azure Front Door for WAF

### Monitoring & Alerts

- ✅ Enable Log Analytics
- 🔜 Set up alerts for high RU usage
- 🔜 Set up alerts for application errors
- 🔜 Configure budget alerts

## Migration Guides

### From Azure Functions to Container Apps

If migrating from the legacy Azure Functions architecture:

1. **Export existing data** from Functions storage
2. **Import to Cosmos DB** using migration script
3. **Update GitHub OAuth** callback URL
4. **Test in staging** before production
5. **DNS cutover** to new Container App

**Guide**: Coming soon

### From Docker Compose to Azure

If running locally with Docker Compose:

1. **Ensure build succeeds**: `docker-compose build`
2. **Export MongoDB data**: `mongodump`
3. **Deploy to Azure**: `azd up`
4. **Import data to Cosmos DB**: See [DATA_LAYER.md](../development/DATA_LAYER.md)
5. **Update OAuth URLs**

## Next Steps

After successful deployment:

- [ ] Set up monitoring alerts
- [ ] Configure custom domain
- [ ] Set up CI/CD pipeline
- [ ] Schedule token rotation
- [ ] Document runbook procedures
- [ ] Set up budget alerts
- [ ] Create staging environment
- [ ] Test disaster recovery

## Documentation Index

| Document                                                                           | Description                      |
| ---------------------------------------------------------------------------------- | -------------------------------- |
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)                                         | One-page deployment quick start  |
| [AZD_DEPLOYMENT.md](./AZD_DEPLOYMENT.md)                                           | Complete azd deployment guide    |
| [GITHUB_TOKEN_SETUP.md](./GITHUB_TOKEN_SETUP.md)                                   | GitHub credentials configuration |
| [../development/DATA_LAYER.md](../development/DATA_LAYER.md)                       | Database setup and migration     |
| [../development/ENVIRONMENT_VARIABLES.md](../development/ENVIRONMENT_VARIABLES.md) | Environment variable reference   |
| [COSMOS_DB_PORTAL_SETUP.md](./COSMOS_DB_PORTAL_SETUP.md)                           | Manual Cosmos DB setup           |

## Support

- **Issues**: https://github.com/Azure-Samples/template-doctor/issues
- **Discussions**: https://github.com/Azure-Samples/template-doctor/discussions
- **Azure Support**: https://azure.microsoft.com/support/
