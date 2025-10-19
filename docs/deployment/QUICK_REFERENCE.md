# Template Doctor - Azure Deployment Quick Reference

## 🚀 Quick Deploy

```bash
# 1. Add GitHub credentials to .env file (in repo root)
cat >> .env << EOF
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=your-secret-here
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EOF

# 2. Login to Azure
azd auth login

# 3. Deploy everything (provision + deploy)
azd up
```

**azd automatically reads secrets from `.env` file!**

## 📋 Required GitHub Credentials

| Credential               | Purpose               | Get From                               |
| ------------------------ | --------------------- | -------------------------------------- |
| **GITHUB_CLIENT_ID**     | OAuth user login      | https://github.com/settings/developers |
| **GITHUB_CLIENT_SECRET** | OAuth user login      | GitHub OAuth App settings              |
| **GITHUB_TOKEN**         | Repository operations | https://github.com/settings/tokens/new |

**Token Scopes Required**: `repo`, `workflow`, `read:org`

## 🏗️ What Gets Deployed

```
Resource Group: rg-<environment>
├── Cosmos DB (MongoDB API, Serverless)
│   └── Database: template-doctor
│       ├── Collection: repos
│       └── Collection: analysis
├── Container Registry (ACR)
│   └── Image: template-doctor:latest
├── Container Apps Environment
│   └── Container App: ca-web-<id>
│       ├── CPU: 0.5 cores
│       ├── Memory: 1 GiB
│       ├── Min replicas: 1
│       └── Max replicas: 3
└── Log Analytics Workspace
```

## 💰 Estimated Cost

**Low-Medium Traffic** (~10K analyses/month):

| Resource               | Monthly Cost      |
| ---------------------- | ----------------- |
| Cosmos DB (Serverless) | $5-20             |
| Container Apps         | $0-10 (free tier) |
| Container Registry     | $5                |
| Log Analytics          | $0-5              |
| **Total**              | **$10-40**        |

## 🔍 Common Commands

```bash
# Show deployment info
azd show

# View logs
azd monitor --logs

# Update environment variable
azd env set MY_VAR "value"
azd deploy

# Access app URL
open $(azd env get-value SERVICE_WEB_URI)

# Delete everything
azd down
```

## 🧪 Test Deployment

```bash
# Get app URL
APP_URL=$(azd env get-value SERVICE_WEB_URI)

# Test health endpoint
curl "${APP_URL}/api/v4/health"

# Test config endpoint
curl "${APP_URL}/api/v4/client-settings"
```

## 🔧 Troubleshooting

| Issue                     | Solution                                      |
| ------------------------- | --------------------------------------------- |
| "Image not found"         | Run `azd deploy` again                        |
| OAuth redirect error      | Update callback URL in GitHub                 |
| Database connection fails | Check `MONGODB_URI` with `azd env get-values` |
| Analysis fails            | Verify `GITHUB_TOKEN` is set correctly        |

## 📚 Full Documentation

- **Deployment Guide**: [AZD_DEPLOYMENT.md](./AZD_DEPLOYMENT.md)
- **GitHub Token Setup**: [GITHUB_TOKEN_SETUP.md](./GITHUB_TOKEN_SETUP.md)
- **Database Setup**: [../development/DATA_LAYER.md](../development/DATA_LAYER.md)

## ⚡ Environment Management

```bash
# Create environments
azd env new dev
azd env new staging
azd env new production

# Switch environments
azd env select production
azd deploy

# List environments
azd env list
```

## 🔐 Security Checklist

- [ ] GitHub OAuth callback URL matches deployed app
- [ ] Personal Access Token has correct scopes
- [ ] Token rotation schedule configured
- [ ] Cosmos DB connection string not committed to git
- [ ] Container App has minimal replicas for cost control
- [ ] Log Analytics retention set appropriately

## 📞 Support

- GitHub Issues: https://github.com/Azure-Samples/template-doctor/issues
- Documentation: [/docs/deployment](/docs/deployment)
