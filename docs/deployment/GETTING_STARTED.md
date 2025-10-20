# Getting Started - Azure Deployment

Deploy Template Doctor to Azure in 5 minutes.

## Prerequisites

- Azure subscription
- GitHub account
- Docker installed (optional, for local testing)

## Step 1: Set Up GitHub Credentials (5 minutes)

### A. Create OAuth App

1. Go to https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in:
   - Application name: `Template Doctor`
   - Homepage URL: `https://template-doctor.yourdomain.com` (temporary, will update later)
   - Authorization callback URL: `https://template-doctor.yourdomain.com/callback.html`
4. Click **"Register application"**
5. **Save the Client ID**: `Iv1.xxxxxxxxxxxxxxxx`
6. Click **"Generate a new client secret"**
7. **Save the Client Secret**: (you won't see it again!)

### B. Create Personal Access Token

1. Go to https://github.com/settings/tokens/new
2. Fill in:
   - Token name: `template-doctor-azure`
   - Expiration: `90 days` (or `No expiration` for production)
3. **Select scopes**:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
   - ✅ `read:org` (Read org membership)
4. Click **"Generate token"**
5. **Save the token**: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 2: Configure Local .env File (1 minute)

```bash
# Clone the repository (if not already done)
git clone https://github.com/Azure-Samples/template-doctor.git
cd template-doctor

# Copy example file
cp .env.example .env

# Edit .env and add your GitHub credentials
# Replace the values with what you saved in Step 1
nano .env  # or use your favorite editor
```

Your `.env` should look like:

```bash
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=your_oauth_client_secret_here
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**That's it!** `azd` will automatically read these values.

## Step 3: Deploy to Azure (3 minutes)

```bash
# Install Azure Developer CLI (if not already installed)
curl -fsSL https://aka.ms/install-azd.sh | bash

# Login to Azure
azd auth login

# Deploy everything (provision + build + deploy)
azd up
```

You'll be prompted to:

1. **Select Azure subscription**
2. **Select Azure region** (recommend: `eastus2` or `westus2`)
3. **Enter environment name** (e.g., `dev`, `staging`, `production`)

`azd` will:

- ✅ Create resource group
- ✅ Provision Cosmos DB (MongoDB API)
- ✅ Create Container Registry
- ✅ Set up Container Apps environment
- ✅ Build Docker image
- ✅ Deploy application
- ✅ Configure environment variables (including GitHub secrets from `.env`)

## Step 4: Update OAuth Callback URL (1 minute)

After deployment completes:

```bash
# Get your application URL
azd show
```

Example output:

```
Service web:
  Endpoint: https://ca-web-abc123.azurecontainerapps.io
```

Now update your GitHub OAuth app:

1. Go to https://github.com/settings/developers
2. Click on your OAuth app
3. Update **Authorization callback URL** to:
   ```
   https://ca-web-abc123.azurecontainerapps.io/callback.html
   ```
4. Click **"Update application"**

## Step 5: Test Your Deployment

```bash
# Open the application
open $(azd env get-value SERVICE_WEB_URI)

# Or manually visit the URL from Step 4
```

You should see the Template Doctor homepage. Click **"Login with GitHub"** to test OAuth.

## That's It! 🎉

Your Template Doctor instance is now running on Azure with:

- ✅ Serverless Cosmos DB database
- ✅ Auto-scaling container app (1-3 replicas)
- ✅ GitHub OAuth login
- ✅ Full repository analysis capabilities

## Common Issues

### "GitHub credentials not found"

Make sure your `.env` file has all three values set:

```bash
cat .env | grep GITHUB
```

Should show:

```
GITHUB_CLIENT_ID=Iv1.xxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxx
GITHUB_TOKEN=ghp_xxxxxxxx
```

### "Redirect URI mismatch" when logging in

Update your OAuth app callback URL (Step 4) to match your deployed app URL.

### "azd: command not found"

Install Azure Developer CLI:

```bash
curl -fsSL https://aka.ms/install-azd.sh | bash
source ~/.bashrc  # or restart your terminal
```

## Next Steps

- **View logs**: `azd monitor --logs`
- **Update environment**: Edit `.env` and run `azd deploy`
- **Scale up**: Edit `infra/core/host/container-app.bicep` (change `minReplicas`/`maxReplicas`)
- **Set up CI/CD**: See [AZD_DEPLOYMENT.md](./AZD_DEPLOYMENT.md#cicd-integration)
- **Custom domain**: See [AZD_DEPLOYMENT.md](./AZD_DEPLOYMENT.md#custom-domain)

## Cost Estimate

Your deployment will cost approximately **$10-40/month** for low-medium traffic:

| Resource               | Monthly Cost      |
| ---------------------- | ----------------- |
| Cosmos DB (Serverless) | $5-20             |
| Container Apps         | $0-10 (free tier) |
| Container Registry     | $5                |
| **Total**              | **$10-40**        |

## Clean Up

To delete all Azure resources:

```bash
azd down
```

## Learn More

- **Full deployment guide**: [AZD_DEPLOYMENT.md](./AZD_DEPLOYMENT.md)
- **GitHub token details**: [GITHUB_TOKEN_SETUP.md](./GITHUB_TOKEN_SETUP.md)
- **Database setup**: [../development/DATA_LAYER.md](../development/DATA_LAYER.md)
