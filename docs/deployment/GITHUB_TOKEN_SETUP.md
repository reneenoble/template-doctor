# GitHub Token Configuration for Template Doctor

Template Doctor requires **two separate GitHub credentials** for different purposes. This guide explains each one and how to set them up.

## Overview

| Credential                | Purpose               | When Used                                | Required? |
| ------------------------- | --------------------- | ---------------------------------------- | --------- |
| **OAuth App**             | User authentication   | When users click "Login with GitHub"     | ✅ Yes    |
| **Personal Access Token** | Repository operations | Analysis, PR creation, workflow triggers | ✅ Yes    |

## 1. GitHub OAuth App (User Authentication)

### Purpose

Allows users to log in with their GitHub account to:

- View their repositories
- Trigger analyses on repos they have access to
- See analysis results for their templates

### Setup Steps

1. **Create OAuth App**:
   - Go to: https://github.com/settings/developers
   - Click "New OAuth App"

2. **Configure App**:

   ```
   Application name: Template Doctor
   Homepage URL: https://template-doctor.yourdomain.com
   Authorization callback URL: https://template-doctor.yourdomain.com/callback.html
   ```

3. **Get Credentials**:
   - After creating, note down:
     - **Client ID**: `Iv1.xxxxxxxxxxxx`
     - **Client Secret**: Click "Generate a new client secret"

4. **Set in Azure**:
   ```bash
   azd env set GITHUB_CLIENT_ID "Iv1.xxxxxxxxxxxx"
   azd env set GITHUB_CLIENT_SECRET "your-secret-here"
   ```

### Update Callback URL After Deployment

After `azd deploy`, update the OAuth app:

```bash
# Get your app URL
APP_URL=$(azd env get-value SERVICE_WEB_URI)
echo "Update callback URL to: ${APP_URL}/callback.html"
```

Then update at https://github.com/settings/developers

## 2. GitHub Personal Access Token (Repository Operations)

### Purpose

Enables the backend to perform operations on behalf of the service:

- 🔍 **Clone repositories** for analysis (public and private)
- 💾 **Create pull requests** to save analysis results back to the repo
- 🚀 **Trigger workflow runs** for automated testing
- 📊 **Read repository metadata** (files, branches, commits)
- 🔐 **Handle SAML/SSO repositories** (fork-first workflow)

### Required Scopes

When creating the token at https://github.com/settings/tokens/new, select:

✅ **repo** - Full control of private repositories

- Includes: read/write code, commits, PRs, issues
- Needed for: cloning repos, creating PRs, reading files

✅ **workflow** - Update GitHub Action workflows

- Needed for: triggering workflow runs, updating workflow files

✅ **read:org** - Read org membership

- Needed for: accessing org repos, handling SAML/SSO

### Setup Steps

1. **Create Fine-Grained or Classic Token**:
   - Go to: https://github.com/settings/tokens/new
   - Choose token type:
     - **Classic Token** (easier, works across all orgs)
     - **Fine-Grained Token** (more secure, org-specific)

2. **Configure Token**:

   ```
   Token name: template-doctor-production
   Expiration: 90 days (or No expiration for production)

   Scopes:
   ✅ repo
   ✅ workflow
   ✅ read:org
   ```

3. **Save Token**:
   - Copy the token (you won't see it again!)
   - Format: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

4. **Set in Azure**:
   ```bash
   azd env set GITHUB_TOKEN "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   ```

### Token Best Practices

**Security:**

- 🔒 Use fine-grained tokens with minimum necessary permissions
- ⏰ Set expiration dates (30-90 days) for development
- 🔄 Rotate tokens regularly
- 📝 Use Azure Key Vault for production (coming soon)

**Organization Access:**

- If using fine-grained tokens, grant access to specific organizations
- For Azure Samples, grant access to: `Azure-Samples`, `Azure`, `microsoft`
- Test with a single repo first before granting broad access

**Monitoring:**

- GitHub logs all token usage in Settings → Developer settings → Personal access tokens
- Review "Last used" date regularly
- Revoke unused tokens

## Environment Variable Mapping

After setting secrets with `azd env set`, they're passed to the application as:

```bash
# Container App Environment Variables
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxx           # From OAuth app
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxx       # From OAuth app
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxx   # From PAT

# Legacy compatibility (deprecated, use GITHUB_TOKEN)
GH_WORKFLOW_TOKEN=${GITHUB_TOKEN}
```

## Testing Tokens

### Test OAuth Login

1. Deploy application: `azd deploy`
2. Open app URL: `azd show`
3. Click "Login with GitHub"
4. Should redirect to GitHub → Authorize → Redirect back

**Troubleshooting:**

- ❌ "Redirect URI mismatch" → Update OAuth app callback URL
- ❌ "Application suspended" → Check OAuth app status
- ❌ "Bad credentials" → Verify CLIENT_ID and CLIENT_SECRET

### Test Personal Access Token

```bash
# Test token locally
curl -H "Authorization: token ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  https://api.github.com/user

# Should return your user info
# If error 401: token is invalid
# If error 403: token lacks required scopes
```

### Test in Deployed App

1. Trigger an analysis on a repository
2. Check Container App logs:
   ```bash
   az containerapp logs show \
     --name ca-web-<id> \
     --resource-group rg-<env> \
     --follow
   ```
3. Look for successful GitHub API calls:
   ```
   ✅ Cloned repository: Azure-Samples/todo-nodejs-mongo
   ✅ Created PR #123: Update analysis results
   ```

**Troubleshooting:**

- ❌ "Bad credentials" → GITHUB_TOKEN not set or invalid
- ❌ "Resource not accessible" → Token lacks `repo` scope
- ❌ "Refusing to allow OAuth App" → Use PAT, not OAuth token
- ❌ "SAML enforcement" → Add `read:org` scope, enable SSO for token

## Token Rotation

When tokens expire, update them without downtime:

```bash
# Create new token at https://github.com/settings/tokens/new
# Copy the new token

# Update in Azure (will trigger rolling deployment)
azd env set GITHUB_TOKEN "ghp_NEW_TOKEN_HERE"
azd deploy

# Old token can be revoked after successful deployment
```

## Common Issues

### Issue: Analysis fails with "Authentication required"

**Cause**: GITHUB_TOKEN not set or expired

**Fix**:

```bash
# Verify token is set
azd env get-value GITHUB_TOKEN

# If empty, set it
azd env set GITHUB_TOKEN "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
azd deploy
```

### Issue: Can't create PR with "Resource not accessible by integration"

**Cause**: Token lacks `repo` scope

**Fix**:

1. Go to https://github.com/settings/tokens
2. Edit token → Add `repo` scope
3. Update in Azure:
   ```bash
   azd env set GITHUB_TOKEN "ghp_NEW_TOKEN_WITH_REPO_SCOPE"
   azd deploy
   ```

### Issue: Can't trigger workflow with "Refusing to allow OAuth App"

**Cause**: Using OAuth token instead of Personal Access Token

**Fix**:

- OAuth tokens (from user login) can't trigger workflows
- Use a Personal Access Token with `workflow` scope
- Set it as GITHUB_TOKEN (not GITHUB_CLIENT_ID/SECRET)

### Issue: SAML/SSO organization blocks access

**Cause**: Token not authorized for SSO

**Fix**:

1. Go to https://github.com/settings/tokens
2. Find your token
3. Click "Configure SSO" → Authorize for organizations
4. Or add `read:org` scope to token

## Production Deployment Checklist

Before deploying to production:

- [ ] Created GitHub OAuth App with correct callback URL
- [ ] Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in azd env
- [ ] Created Personal Access Token with repo + workflow + read:org scopes
- [ ] Set GITHUB_TOKEN in azd env
- [ ] Tested OAuth login flow in staging
- [ ] Tested repository analysis with PAT
- [ ] Configured token expiration reminder
- [ ] Documented token rotation procedure
- [ ] Set up monitoring for GitHub API rate limits

## Rate Limits

GitHub enforces API rate limits:

| Auth Type                 | Limit       | Notes                        |
| ------------------------- | ----------- | ---------------------------- |
| **Unauthenticated**       | 60/hour     | Don't use this               |
| **OAuth Token**           | 5,000/hour  | Per user, for user actions   |
| **Personal Access Token** | 5,000/hour  | For backend operations       |
| **GitHub App**            | 15,000/hour | Best for production (future) |

**Current setup**: Uses PAT (5,000 requests/hour)

**Monitor rate limits**:

```bash
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit
```

## Future: Migrate to GitHub App

For higher rate limits and better security, consider migrating to GitHub App:

**Benefits:**

- 15,000 requests/hour (3x more than PAT)
- Fine-grained permissions per repository
- Audit logs in organization settings
- No personal token tied to individual user

**Setup** (planned):

1. Create GitHub App
2. Install on organizations
3. Use app authentication instead of PAT
4. Update backend to use Octokit App authentication

See: https://docs.github.com/en/apps/creating-github-apps

## See Also

- [AZD_DEPLOYMENT.md](./AZD_DEPLOYMENT.md) - Full deployment guide
- [OAUTH_CONFIGURATION.md](../development/OAUTH_CONFIGURATION.md) - OAuth setup details
- [GitHub PAT Documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)
