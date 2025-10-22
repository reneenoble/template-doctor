# Template Doctor - Deployment Guide

**Simple steps to run Template Doctor locally or deploy to Azure**

---

## 🏠 Running Locally (For Testing & Development)

### Prerequisites
- Docker Desktop installed and running
- GitHub account

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/Template-Doctor/template-doctor.git
   cd template-doctor
   ```

2. **Run the setup script**
   ```bash
   ./scripts/full-setup.sh
   ```
   - Choose option 1 (Local MongoDB - Docker)
   - Follow prompts to configure GitHub OAuth (or skip for basic testing)

3. **Start Template Doctor**
   ```bash
   docker-compose --profile combined up
   ```

4. **Open in browser**
   - Navigate to: `http://localhost:3000`
   - You're ready to analyze templates!

5. **Stop when done**
   ```bash
   docker-compose down
   ```

---

## ☁️ Deploying to Azure (Production)

### Prerequisites
- Azure subscription
- Azure CLI installed
- Azure Developer CLI (azd) installed
- GitHub account

### Quick Start - One Command Deployment

1. **Clone the repository**
   ```bash
   git clone https://github.com/Template-Doctor/template-doctor.git
   cd template-doctor
   ```

2. **Run the setup script**
   ```bash
   ./scripts/full-setup.sh
   ```
   - Choose option 2 (Azure Cosmos DB - Production)
   - Configure GitHub OAuth when prompted
   - Get your GitHub Personal Access Token ready

3. **Login to Azure**
   ```bash
   az login
   azd auth login
   ```

4. **Deploy to Azure**
   ```bash
   cd infra
   azd up
   ```
   - Enter environment name (e.g., "prod")
   - Select your Azure subscription
   - Choose Azure region (e.g., "eastus")
   - Wait 5-10 minutes for deployment

5. **Done!**
   - Azure automatically provisions everything:
     - ✅ Cosmos DB database (serverless)
     - ✅ Container Apps (with auto-scaling)
     - ✅ Managed Identity (secure, no passwords)
     - ✅ All required permissions
   - Note the URL displayed at the end of deployment
   - Navigate to your Template Doctor instance

---

## 📋 What You Need to Prepare

### For Local Deployment
- ✅ GitHub account
- ✅ Docker Desktop running
- ⚠️ Optional: GitHub OAuth app (for authentication features)

### For Azure Production Deployment
- ✅ Azure subscription (with billing enabled)
- ✅ GitHub account
- ✅ GitHub Personal Access Token with `repo` and `workflow` scopes
- ✅ GitHub OAuth app credentials:
  - Client ID
  - Client Secret
  - Callback URL set to: `https://<your-app>.azurecontainerapps.io/callback.html`

---

## 🔧 GitHub OAuth Setup (Required for Full Features)

### Create GitHub OAuth App

1. **Go to GitHub Settings**
   - Navigate to: https://github.com/settings/developers
   - Click "OAuth Apps" → "New OAuth App"

2. **Configure the app**
   - **Application name**: `Template Doctor` (or your choice)
   - **Homepage URL**: 
     - Local: `http://localhost:3000`
     - Production: `https://<your-app>.azurecontainerapps.io`
   - **Authorization callback URL**:
     - Local: `http://localhost:3000/callback.html`
     - Production: `https://<your-app>.azurecontainerapps.io/callback.html`

3. **Get credentials**
   - Copy the **Client ID**
   - Generate and copy the **Client Secret**
   - Save both securely

4. **Enter during setup**
   - The setup script will prompt you for these values
   - They'll be automatically configured

---

## 🎯 Troubleshooting

### Local Deployment Issues

**Problem**: "Cannot connect to Docker daemon"
- ✅ Solution: Make sure Docker Desktop is running

**Problem**: "Port 3000 already in use"
- ✅ Solution: Stop any apps using port 3000, or change port in `.env`

**Problem**: "Database connection failed"
- ✅ Solution: Make sure `MONGODB_URI` is NOT set in `.env` file (Docker handles this automatically)

### Azure Deployment Issues

**Problem**: "azd: command not found"
- ✅ Solution: Install Azure Developer CLI from https://aka.ms/azd-install

**Problem**: "Deployment failed - insufficient permissions"
- ✅ Solution: Make sure you have Owner or Contributor role on the Azure subscription

**Problem**: "GitHub OAuth not working"
- ✅ Solution: Verify callback URL in GitHub OAuth app matches your deployed URL exactly

---

## 💰 Cost Estimate (Azure Production)

**Monthly costs** (approximate):
- Cosmos DB (serverless): $0-25 (depends on usage)
- Container Apps: $0-50 (depends on traffic)
- Container Registry: $5
- **Total**: ~$5-80/month (mostly pay-per-use)

**Note**: Azure Cosmos DB serverless only charges for actual usage. Low traffic = low cost.

---

## 📚 More Information

- **Detailed setup guide**: `docs/deployment/PRODUCTION_DATABASE_MANAGED_IDENTITY.md`
- **Troubleshooting**: `docs/usage/TROUBLESHOOTING.md`
- **Quick reference**: `QUICKSTART.md`
- **Infrastructure details**: `infra/README.md`

---

## ✨ Key Benefits

### Local Deployment
- ✅ Free (no cloud costs)
- ✅ Fast setup (5 minutes)
- ✅ Works offline (after initial setup)
- ✅ Perfect for testing

### Azure Production Deployment
- ✅ Enterprise-grade security (Managed Identity)
- ✅ Auto-scaling (handles traffic spikes)
- ✅ High availability (99.9% uptime SLA)
- ✅ No server management required
- ✅ Pay only for what you use

---

## 🚀 Quick Decision Guide

**Choose Local if you want to:**
- Test Template Doctor features
- Develop new features
- Avoid cloud costs
- Work offline

**Choose Azure Production if you want to:**
- Share with your team
- Production-grade reliability
- Handle multiple users
- Enterprise security
- Automatic backups and scaling
