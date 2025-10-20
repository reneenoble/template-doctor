# Migration Guide

This guide helps you migrate your Template Doctor integrations when upgrading between major versions.

## Migrating to v3.0.0 (Unreleased)

### ⚠️ BREAKING CHANGE: API Authentication Required

**All API endpoints now require OAuth authentication** (except public health check and configuration endpoints).

#### What Changed

Previously, validation endpoints were publicly accessible without authentication. Starting in v3.0.0, all validation and analysis endpoints require a valid GitHub OAuth token.

#### Affected Endpoints

The following endpoints now return `401 Unauthorized` without authentication:

- `POST /api/v4/analyze-template`
- `POST /api/v4/validation-template`
- `POST /api/v4/validation-docker-image`
- `POST /api/v4/validation-ossf`
- `GET /api/v4/validation-status`
- `POST /api/v4/validation-cancel`
- `POST /api/v4/validation-callback`
- `POST /api/v4/issue-create`
- `POST /api/v4/batch-scan-start`
- All `/api/v4/action-*` endpoints
- All `/api/v4/admin/*` endpoints (admin users only)

#### Public Endpoints (No Authentication Required)

These endpoints remain publicly accessible:

- `GET /api/health` - Health check
- `GET /api/v4/client-settings` - Runtime configuration
- `POST /api/v4/github-oauth-token` - OAuth token exchange

#### Migration Steps

##### 1. Set Up GitHub OAuth App

If you haven't already, create a GitHub OAuth app:

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create a new OAuth app with:
   - Homepage URL: `http://localhost:3000` (local) or your production URL
   - Callback URL: `http://localhost:3000/callback.html` (must match exactly)
3. Note your Client ID and Client Secret

See [OAuth Configuration Guide](development/OAUTH_CONFIGURATION.md) for detailed setup.

##### 2. Update Environment Variables

Add OAuth credentials to your `.env` file:

```bash
# GitHub OAuth App (for user authentication)
GITHUB_CLIENT_ID=your_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_oauth_app_client_secret
```

##### 3. Update API Clients

**Before (v2.x):**

```javascript
// No authentication required
const response = await fetch('/api/v4/analyze-template', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ repository: 'owner/repo' }),
});
```

**After (v3.0):**

```javascript
// Authentication required - include GitHub token
const response = await fetch('/api/v4/analyze-template', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${githubToken}`, // Add this header
  },
  body: JSON.stringify({ repository: 'owner/repo' }),
});
```

##### 4. Implement OAuth Flow

For web applications, implement the GitHub OAuth flow:

```javascript
// 1. Redirect user to GitHub authorization
const clientId = 'your_client_id';
const redirectUri = 'http://localhost:3000/callback.html';
const scope = 'public_repo read:user';
window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;

// 2. In callback.html, exchange code for token
const code = new URLSearchParams(window.location.search).get('code');
const response = await fetch('/api/v4/github-oauth-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code }),
});
const { access_token } = await response.json();

// 3. Store token and use in subsequent requests
localStorage.setItem('github_token', access_token);
```

##### 5. For CI/CD and Scripts

For automated scripts and CI/CD pipelines, use a GitHub Personal Access Token:

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with scopes: `public_repo`, `read:user`
3. Use the token in your scripts:

```bash
#!/bin/bash
GITHUB_TOKEN="your_personal_access_token"

curl -X POST https://template-doctor.example.com/api/v4/analyze-template \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -d '{"repository": "owner/repo"}'
```

#### Admin Endpoints

Admin endpoints require both authentication AND admin privileges:

```bash
# Set admin users in environment variables
ADMIN_GITHUB_USERS=username1,username2,username3
```

Only users in `ADMIN_GITHUB_USERS` can access `/api/v4/admin/*` endpoints.

#### Rate Limiting

v3.0.0 also introduces three-tier rate limiting:

- **Standard endpoints** (config): 100 requests/minute
- **Authenticated endpoints** (analyze, validate): 20 requests/minute
- **Strict endpoints** (OAuth token exchange): 10 requests/minute

Rate limit exceeded returns `429 Too Many Requests`.

#### Testing Your Migration

1. Start the server with OAuth configured
2. Test public endpoints (should work without auth):

   ```bash
   curl http://localhost:3000/api/health
   curl http://localhost:3000/api/v4/client-settings
   ```

3. Test protected endpoints without auth (should return 401):

   ```bash
   curl -X POST http://localhost:3000/api/v4/analyze-template \
     -H "Content-Type: application/json" \
     -d '{"repository": "owner/repo"}'
   # Expected: 401 Unauthorized
   ```

4. Test protected endpoints with auth (should work):
   ```bash
   curl -X POST http://localhost:3000/api/v4/analyze-template \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer ${GITHUB_TOKEN}" \
     -d '{"repository": "owner/repo"}'
   # Expected: 200 OK with analysis results
   ```

#### Troubleshooting

**Problem**: Getting 401 errors even with token

**Solution**:

- Verify token is valid: `curl -H "Authorization: Bearer ${TOKEN}" https://api.github.com/user`
- Check token has required scopes: `public_repo`, `read:user`
- Ensure `Authorization` header format is exactly: `Bearer <token>` (with space)

**Problem**: OAuth callback not working

**Solution**:

- Verify callback URL in GitHub OAuth app matches exactly: `http://localhost:3000/callback.html`
- Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set correctly
- Ensure frontend and backend run on same port (3000) for OAuth to work

**Problem**: Admin endpoints returning 403

**Solution**:

- Verify your GitHub username is in `ADMIN_GITHUB_USERS` environment variable
- Check token belongs to admin user: Token username must match one in the list
- Restart server after changing `ADMIN_GITHUB_USERS`

#### Need Help?

- See [OAuth Configuration Guide](development/OAUTH_CONFIGURATION.md) for detailed OAuth setup
- See [Admin Authentication Guide](development/ADMIN_AUTHENTICATION.md) for admin setup
- Check [API Documentation](development/architecture.md) for complete endpoint reference
- Open an issue on GitHub if you encounter problems

---

## Previous Versions

### Migrating from v0.x to v1.0.0

See [CHANGELOG.md](../CHANGELOG.md) for details on the v1.0.0 migration.
