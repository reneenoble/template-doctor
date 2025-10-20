# Template Doctor - Full Setup Script Guide

## Overview

The **`scripts/full-setup.sh`** script provides a comprehensive, interactive setup wizard for Template Doctor. It automates the entire deployment process from prerequisites checking to Azure deployment and verification.

## What It Does

The script guides you through 10 steps:

### 1. Prerequisites Check ✅

- Verifies Azure CLI is installed and working
- Verifies Azure Developer CLI (azd) is installed
- Verifies Docker is installed and running
- Checks for Node.js (optional but recommended)

### 2. GitHub OAuth App Setup 🔐

- Provides step-by-step instructions to create a GitHub OAuth App
- Collects Client ID and Client Secret
- Validates format (starts with `Ov` or `Iv`)

### 3. GitHub Personal Access Token 🔑

- Guides you through creating a GitHub PAT
- Lists required scopes: `repo`, `workflow`, `read:org`
- Validates token format (starts with `ghp_`)
- Optionally sets up separate workflow dispatch token

### 4. MongoDB Database Setup 🗄️

- Option A: Use existing MongoDB (Atlas, Cosmos DB, etc.)
- Option B: Create new Cosmos DB during `azd provision`
- Validates MongoDB URI format

### 5. Admin User Configuration 👤

- Collects GitHub username(s) for admin access
- Supports multiple admins (comma-separated)
- Sets `ADMIN_GITHUB_USERS` environment variable

### 6. Azure Region Selection 🌍

- Provides common region choices (swedencentral, eastus, etc.)
- Allows custom region entry
- Sets `AZURE_LOCATION` for deployment

### 7. Create .env File 📝

- Generates `.env` file with all configuration
- Backs up existing `.env` if present
- Validates configuration using `scripts/validate-env.sh`
- Sets sensible defaults for optional variables

### 8. UAMI Setup (Optional) 🔐

- Sets up User Assigned Managed Identity for GitHub Actions
- Creates federated credentials for passwordless deployment
- Updates `.env` with `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`
- Provides GitHub Secrets to add to repository

### 9. Azure Deployment 🚀

- Runs `azd auth login` to authenticate
- Initializes `azd` environment
- Provisions Azure resources (Container Apps, Container Registry, Log Analytics)
- Builds and deploys Docker image
- Provides deployed URL and callback URL update instructions

### 10. Post-Deployment Verification ✔️

- Tests if site is accessible
- Provides manual verification steps:
  - OAuth login
  - Template analysis
  - Database persistence
  - Leaderboards (admin)
- Optionally opens deployed site in browser

## Usage

### First-Time Setup

```bash
git clone https://github.com/Template-Doctor/template-doctor.git
cd template-doctor
./scripts/full-setup.sh
```

### Re-running for Updates

The script is **idempotent** - safe to re-run:

```bash
./scripts/full-setup.sh
```

If `.env` already exists, it will ask before overwriting and creates a timestamped backup.

### Skip Certain Steps

The script asks yes/no questions at each major decision point:

- Skip GitHub OAuth setup if already configured
- Skip GitHub PAT creation if already have one
- Skip UAMI setup if not using GitHub Actions
- Skip deployment if only updating configuration

## What Gets Created

### Files

- **`.env`** - Environment configuration with all required and optional variables
- **`.env.backup.<timestamp>`** - Backup of previous `.env` if overwritten
- **`.azure/`** - azd environment directory (created by azd init)

### Azure Resources (via azd provision)

- **Container Registry** - For Docker images
- **Container Apps Environment** - Hosting environment
- **Container App** - Your application instance
- **Log Analytics Workspace** - For monitoring and logs
- **User Assigned Managed Identity** - For GitHub Actions (optional)

### UAMI Resources (if enabled)

- **Managed Identity**: `template-doctor-identity-UAMIOIDC`
- **Role Assignment**: Contributor at subscription level
- **Federated Credential**: For GitHub Actions authentication

## Environment Variables Set

### Required (6)

| Variable               | Description               | Example                 |
| ---------------------- | ------------------------- | ----------------------- |
| `GITHUB_CLIENT_ID`     | OAuth App Client ID       | `Ov23liZPFmBPVhHPMA5U`  |
| `GITHUB_CLIENT_SECRET` | OAuth App Client Secret   | `(secret)`              |
| `GITHUB_TOKEN`         | GitHub PAT for operations | `ghp_...`               |
| `GH_WORKFLOW_TOKEN`    | GitHub PAT for workflows  | `ghp_...`               |
| `ADMIN_GITHUB_USERS`   | Admin usernames           | `anfibiacreativa,user2` |
| `MONGODB_URI`          | MongoDB connection string | `mongodb+srv://...`     |

### Optional (9 with defaults)

| Variable                   | Default                           | Description                         |
| -------------------------- | --------------------------------- | ----------------------------------- |
| `DEFAULT_RULE_SET`         | `dod`                             | Default ruleset for validation      |
| `REQUIRE_AUTH_FOR_RESULTS` | `true`                            | Require login to view results       |
| `AUTO_SAVE_RESULTS`        | `false`                           | Auto-save results to GitHub         |
| `ARCHIVE_ENABLED`          | `false`                           | Enable archiving feature            |
| `ARCHIVE_COLLECTION`       | `aigallery`                       | Archive collection name             |
| `DISPATCH_TARGET_REPO`     | `Template-Doctor/template-doctor` | Target for workflow dispatch        |
| `ISSUE_AI_ENABLED`         | `false`                           | Enable AI-powered issue suggestions |
| `AZURE_LOCATION`           | (user selected)                   | Azure region for deployment         |

### UAMI Variables (if enabled)

| Variable                | Description                       |
| ----------------------- | --------------------------------- |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID             |
| `AZURE_RESOURCE_GROUP`  | Resource group name               |
| `GITHUB_OWNER`          | GitHub organization or user       |
| `GITHUB_REPO`           | Repository name                   |
| `AZURE_CLIENT_ID`       | UAMI Client ID (set by setup.sh)  |
| `AZURE_TENANT_ID`       | Azure Tenant ID (set by setup.sh) |

## Integration with Other Scripts

The full-setup script orchestrates these existing scripts:

### `scripts/validate-env.sh`

- Called after `.env` creation (Step 7)
- Validates all required variables are set
- Checks format of GitHub tokens and MongoDB URI
- Detects placeholder values

### `scripts/setup.sh`

- Called during UAMI setup (Step 8)
- Creates User Assigned Managed Identity
- Assigns Contributor role
- Adds federated credential
- Updates `.env` with UAMI variables

### `scripts/deploy.sh` (planned)

- Called after `azd provision` (Step 9)
- Builds Docker image
- Pushes to Container Registry
- Updates Container App

## Post-Setup Tasks

After the script completes:

### 1. Update OAuth Callback URL ⚠️

**CRITICAL**: Update your GitHub OAuth App with the deployed URL:

1. Go to https://github.com/settings/developers
2. Select your OAuth App
3. Update **Authorization callback URL** to:
   ```
   https://your-app-url/callback.html
   ```
   (The script displays this URL after deployment)

### 2. Add GitHub Secrets (if UAMI enabled)

Add these secrets to your GitHub repository:

1. Go to repository **Settings → Secrets and variables → Actions**
2. Add:
   - `AZURE_CLIENT_ID` - From script output
   - `AZURE_TENANT_ID` - From script output
   - `AZURE_SUBSCRIPTION_ID` - Your subscription ID

### 3. Verify Deployment

Test these features:

- ✅ **OAuth Login**: Visit site, click "Sign in with GitHub"
- ✅ **Template Analysis**: Enter a repo URL, click "Scan Template"
- ✅ **Database Persistence**: Verify tiles appear without hard refresh
- ✅ **Leaderboards**: Navigate to `/leaderboard.html` (admin only)

### 4. Monitor Logs

View application logs:

```bash
# Azure Portal
az containerapp logs show --name <app-name> --resource-group <rg-name> --follow

# Or via Azure Portal: Container Apps → your app → Log stream
```

## Troubleshooting

### Script Fails at Prerequisites

**Error**: "Azure CLI not found"
**Solution**: Install Azure CLI: https://learn.microsoft.com/cli/azure/install-azure-cli

**Error**: "Docker not running"
**Solution**: Start Docker Desktop or docker daemon

### OAuth App Issues

**Error**: Invalid client_id or redirect_uri
**Solution**:

1. Verify `GITHUB_CLIENT_ID` in `.env` matches OAuth App
2. Update OAuth App callback URL to `https://your-app-url/callback.html`
3. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)

### Deployment Fails

**Error**: "Subscription not found"
**Solution**: Run `azd auth login` and select correct subscription

**Error**: "Location not available"
**Solution**: Choose different Azure region (swedencentral recommended)

### UAMI Setup Fails

**Error**: "Insufficient permissions"
**Solution**: Ensure you have Contributor or Owner role on subscription

**Error**: "Identity already exists"
**Solution**: Script will ask if you want to reuse existing identity - say yes

### Validation Warnings

Run validation manually:

```bash
./scripts/validate-env.sh
```

Fix any issues reported, then re-run setup or deployment.

## Advanced Usage

### Custom Environment Name

```bash
# During azd init step, choose custom environment name
azd env new production
azd env new staging
```

### Separate GitHub Tokens

Use different tokens for OAuth operations vs workflow dispatch:

- During **Step 3**, say "No" when asked to use same token for workflow dispatch
- Provide separate token with narrower scopes

### Existing MongoDB

If you have existing MongoDB:

- During **Step 4**, choose option A
- Provide connection string: `mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/`

### Skip UAMI

If not using GitHub Actions for CI/CD:

- During **Step 8**, say "No" to UAMI setup
- Script will skip identity creation

## Related Documentation

- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Manual deployment steps
- [AZD_DEPLOYMENT.md](./AZD_DEPLOYMENT.md) - azd deployment guide
- [UAMI_SETUP_INSTRUCTIONS.md](../development/UAMI_SETUP_INSTRUCTIONS.md) - UAMI details
- [ENVIRONMENT_VARIABLES.md](../development/ENVIRONMENT_VARIABLES.md) - All env vars reference

## Support

If you encounter issues:

1. Run `./scripts/validate-env.sh` to check configuration
2. Review logs: `docker-compose logs` or Azure Container Apps logs
3. Check [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) troubleshooting section
4. Open an issue: https://github.com/Template-Doctor/template-doctor/issues

## Contributing

Improvements to the setup script are welcome! Please:

1. Test changes with fresh environment
2. Ensure idempotency (safe to re-run)
3. Update this documentation
4. Add validation where appropriate

---

**Last Updated**: 2025-01-29  
**Script Version**: 1.0.0  
**Tested With**: azd 1.5.1, Azure CLI 2.56.0, Docker 24.0.7
