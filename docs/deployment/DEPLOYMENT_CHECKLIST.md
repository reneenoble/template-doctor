# Azure Deployment Checklist

This checklist ensures all required environment variables and configuration are in place before deploying Template Doctor to Azure.

## Prerequisites

- [ ] Azure CLI installed (`az --version`)
- [ ] Azure Developer CLI installed (`azd version`)
- [ ] Docker installed and running
- [ ] Azure subscription with appropriate permissions
- [ ] GitHub account with repository access

## Step 1: GitHub OAuth App Setup

Create a GitHub OAuth App for production:

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
    - **Application name**: Template Doctor (Production)
    - **Homepage URL**: `https://your-app-url.azurewebsites.net` (will update after deployment)
    - **Authorization callback URL**: `https://your-app-url.azurewebsites.net/callback.html`
4. Click "Register application"
5. **Save the Client ID** (starts with `Ov23li...`)
6. Click "Generate a new client secret"
7. **Save the Client Secret** (you won't be able to see it again!)

## Step 2: GitHub Personal Access Token

Create a GitHub Personal Access Token:

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name: "Template Doctor Azure Deployment"
4. Select scopes:
    - [x] `repo` (Full control of private repositories)
    - [x] `workflow` (Update GitHub Action workflows)
    - [x] `read:org` (Read org and team membership, read org projects)
5. Click "Generate token"
6. **Save the token** (starts with `ghp_...`)

## Step 3: MongoDB Database

Choose one of these options:

### Option A: Use Existing MongoDB (Recommended)

If you already have a MongoDB database (Atlas, Cosmos DB MongoDB API, etc.):

1. Get your MongoDB connection string
2. It should look like: `mongodb+srv://user:password@cluster.mongodb.net/?options`
3. **Save the connection string**

### Option B: Create New Cosmos DB (Automated)

Uncomment the Cosmos DB section in `infra/main.bicep`:

```bicep
// Cosmos DB Module - COMMENTED OUT: Using existing database
// Uncomment this section if you want azd to provision a new Cosmos DB
module cosmos './database.bicep' = {
  name: 'cosmos-db-deployment'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    principalId: principalId
  }
}
```

Then update the `mongodbUri` parameter to use the output from the Cosmos module.

## Step 4: Environment Variables Setup

1. Copy `.env.example` to `.env`:

    ```bash
    cp .env.example .env
    ```

2. Fill in **all required values** in `.env`:

    ```bash
    # REQUIRED - From Step 1 (GitHub OAuth App)
    GITHUB_CLIENT_ID=Ov23li...your-client-id
    GITHUB_CLIENT_SECRET=...your-client-secret

    # REQUIRED - From Step 2 (GitHub PAT)
    GITHUB_TOKEN=ghp_...your-github-token
    GH_WORKFLOW_TOKEN=ghp_...your-github-token  # Can be same as GITHUB_TOKEN

    # REQUIRED - Admin user(s)
    ADMIN_GITHUB_USERS=yourGitHubUsername  # Your GitHub username for admin access

    # REQUIRED - From Step 3 (MongoDB)
    MONGODB_URI=mongodb+srv://...your-connection-string

    # OPTIONAL - Azure location (default: swedencentral)
    AZURE_LOCATION=swedencentral
    ```

3. **Verify `.env` has NO placeholders** - all values should be filled in!

## Step 5: Pre-Deployment Validation

Run this validation script to check all required environment variables:

```bash
# Check if all required variables are set
./scripts/validate-env.sh
```

Or manually verify:

```bash
# All these should print actual values (not empty or placeholder)
grep -E "^(GITHUB_CLIENT_ID|GITHUB_CLIENT_SECRET|GITHUB_TOKEN|GH_WORKFLOW_TOKEN|ADMIN_GITHUB_USERS|MONGODB_URI)=" .env
```

**Expected output** (with your actual values):

```
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=8b7fb...
GITHUB_TOKEN=ghp_5IXq...
GH_WORKFLOW_TOKEN=ghp_5IXq...
ADMIN_GITHUB_USERS=youruser
MONGODB_URI=mongodb+srv://...
```

## Step 6: Deploy to Azure

1. Login to Azure:

    ```bash
    azd auth login
    ```

2. Initialize the environment:

    ```bash
    azd init
    ```

    - Enter an environment name (e.g., `prod`, `staging`, `your-name`)
    - This will create `.azure/<env-name>/` directory

3. Provision infrastructure:

    ```bash
    azd provision
    ```

    This will:
    - Create Azure resources (Container Apps, Container Registry, Log Analytics)
    - Set up secrets in Container App
    - Output the deployed app URL

4. **IMPORTANT**: Update GitHub OAuth App callback URL:
    - Note the `SERVICE_WEB_URI` from azd provision output
    - Go back to your GitHub OAuth App settings
    - Update **Authorization callback URL** to: `https://<SERVICE_WEB_URI>/callback.html`
    - Save the changes

5. Build and deploy the application:

    ```bash
    ./scripts/deploy.sh
    ```

    This will:
    - Build the Docker image in Azure Container Registry
    - Update the Container App with the new image
    - Set `TD_BACKEND_BASE_URL` to the deployed URL

## Step 7: Post-Deployment Verification

1. **Test OAuth Login**:
    - Open the deployed URL (from `SERVICE_WEB_URI`)
    - Click "Sign in with GitHub"
    - Authorize the OAuth app
    - Verify you're logged in

2. **Test Template Analysis**:
    - Enter a GitHub repository URL (e.g., `https://github.com/Azure-Samples/todo-nodejs-mongo`)
    - Click "Scan Template"
    - Wait for analysis to complete
    - Verify results appear

3. **Test Workflow Validation** (if GH_WORKFLOW_TOKEN is set):
    - Click "Run AZD Validation" on a template
    - Verify workflow dispatches successfully
    - Check GitHub Actions tab in your repository

4. **Check Database**:
    - Verify analysis results are saved to MongoDB
    - Check that tiles show up without hard refresh

5. **Test Leaderboards** (admin only):
    - Navigate to `/leaderboard.html`
    - Verify leaderboard data loads (requires ADMIN_GITHUB_USERS)

## Common Issues & Solutions

### Issue: "Server not configured (missing GH_WORKFLOW_TOKEN)"

**Solution**: Ensure `GH_WORKFLOW_TOKEN` is set in `.env` before running `azd provision`.

```bash
# Check if it's set
azd env get-values | grep GH_WORKFLOW_TOKEN

# If not set:
azd env set GH_WORKFLOW_TOKEN "ghp_your_token_here"
azd provision
```

### Issue: No template tiles showing

**Causes**:

1. Frontend loading from filesystem instead of database API
2. MongoDB connection not configured
3. Analysis not saving to database

**Solutions**:

1. Clear browser cache and hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
2. Verify `MONGODB_URI` is set in Container App environment
3. Check Container App logs: `az containerapp logs show --name <app-name> --resource-group <rg-name> --follow`

### Issue: OAuth redirect mismatch

**Cause**: GitHub OAuth app callback URL doesn't match deployed URL.

**Solution**:

1. Get deployed URL: `azd env get-values | grep SERVICE_WEB_URI`
2. Update GitHub OAuth app callback URL to match
3. Must be exact: `https://<url>/callback.html`

### Issue: Admin endpoints return 403

**Cause**: Your GitHub username not in `ADMIN_GITHUB_USERS`.

**Solution**:

```bash
# Add your username (comma-separated for multiple)
azd env set ADMIN_GITHUB_USERS "yourusername,teammate"
azd provision
./scripts/deploy.sh
```

## Environment Variables Reference

### Required (Must be set before deployment)

| Variable               | Description                           | Example                                          |
| ---------------------- | ------------------------------------- | ------------------------------------------------ |
| `GITHUB_CLIENT_ID`     | OAuth app client ID                   | `Ov23liZPFmBPVhHPMA5U`                           |
| `GITHUB_CLIENT_SECRET` | OAuth app secret                      | `8b7fbefa...`                                    |
| `GITHUB_TOKEN`         | GitHub PAT (repo, workflow, read:org) | `ghp_5IXqxpwvP...`                               |
| `GH_WORKFLOW_TOKEN`    | Workflow dispatch token               | `ghp_5IXqxpwvP...` (can be same as GITHUB_TOKEN) |
| `ADMIN_GITHUB_USERS`   | Admin usernames                       | `youruser,teammate`                              |
| `MONGODB_URI`          | MongoDB connection string             | `mongodb+srv://user:pass@cluster...`             |

### Optional (Has defaults in Bicep)

| Variable                   | Default                           | Description                  |
| -------------------------- | --------------------------------- | ---------------------------- |
| `AZURE_LOCATION`           | `swedencentral`                   | Azure region                 |
| `NODE_ENV`                 | `production`                      | Node environment             |
| `PORT`                     | `3000`                            | Container port               |
| `DEFAULT_RULE_SET`         | `dod`                             | Default analysis ruleset     |
| `REQUIRE_AUTH_FOR_RESULTS` | `true`                            | Require auth to view results |
| `AUTO_SAVE_RESULTS`        | `false`                           | Auto-save to GitHub          |
| `ARCHIVE_ENABLED`          | `false`                           | Enable archiving             |
| `ARCHIVE_COLLECTION`       | `aigallery`                       | Archive collection name      |
| `DISPATCH_TARGET_REPO`     | `Template-Doctor/template-doctor` | Workflow repo                |
| `ISSUE_AI_ENABLED`         | `false`                           | AI issue assistance          |

## Security Best Practices

- [ ] **Never commit `.env`** - It's in `.gitignore` but double-check!
- [ ] Use different OAuth apps for dev/staging/production
- [ ] Rotate GitHub tokens regularly (every 90 days)
- [ ] Use separate admin accounts for production
- [ ] Enable Azure Container App's managed identity where possible
- [ ] Use Azure Key Vault for secrets in production (future enhancement)
- [ ] Review Container App logs regularly for security issues

## Deployment Workflow for Updates

After initial setup, to deploy code changes:

```bash
# 1. Pull latest code
git pull origin main

# 2. Build and deploy
./scripts/deploy.sh

# That's it! No need to run 'azd provision' unless infrastructure changes
```

## Clean Up Resources

To delete all Azure resources:

```bash
azd down --purge --force
```

**Warning**: This deletes ALL resources including databases. Backup data first!

## Support

- Documentation: `/docs`
- Issues: https://github.com/Template-Doctor/template-doctor/issues
- Discord: [Add your community link]
