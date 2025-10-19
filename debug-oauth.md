# OAuth Debugging Guide

You're seeing a 401 error when trying to access GitHub API. This means the authentication token is missing or invalid.

## Steps to Debug:

### 1. Check if OAuth Token Exchange Happened

Open browser DevTools (F12) and run these commands in Console:

```javascript
// Check for access token in storage
console.log('Session token:', sessionStorage.getItem('gh_access_token'));
console.log('Local token:', localStorage.getItem('gh_access_token'));

// Check for pending OAuth code
console.log('Pending code:', sessionStorage.getItem('gh_auth_code'));

// Check current auth state
console.log('Auth state:', window.GitHubAuth?.isAuthenticated());
console.log('Current user:', window.GitHubClient?.currentUser);
```

### 2. Check Network Tab for OAuth Requests

1. Open DevTools → Network tab
2. Filter by: `github-oauth-token`
3. Look for POST request to `/api/v4/github-oauth-token`

**Expected flow:**
- POST `/api/v4/github-oauth-token` with `{code: "..."}` → Returns `{access_token: "..."}`
- If this request is missing, the OAuth callback didn't trigger token exchange

### 3. Check OAuth Configuration

Run in console:
```javascript
console.log('Config:', window.TemplateDoctorConfig);
console.log('OAuth Client ID:', window.TemplateDoctorConfig?.githubOAuth?.clientId);
```

### 4. Common Issues:

#### Issue 1: OAuth Callback Not Configured Correctly
- **Symptom**: No POST to `/api/v4/github-oauth-token`
- **Cause**: GitHub OAuth app callback URL doesn't match `http://localhost:3000/callback.html`
- **Fix**: Update GitHub OAuth app settings to use `http://localhost:3000/callback.html`

#### Issue 2: Token Exchange Failed
- **Symptom**: POST to `/api/v4/github-oauth-token` returns error
- **Cause**: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set in server .env
- **Fix**: Verify `.env` has both values set

#### Issue 3: Token Not Stored
- **Symptom**: POST succeeds but token not in storage
- **Cause**: Auth module not storing token correctly
- **Fix**: Check console for any JavaScript errors during token storage

#### Issue 4: Using Old Token
- **Symptom**: Token exists but is expired/invalid
- **Cause**: Cached old token from previous session
- **Fix**: Clear storage and re-authenticate:
  ```javascript
  sessionStorage.clear();
  localStorage.clear();
  window.location.reload();
  ```

### 5. Quick Fix - Re-Authenticate

If all else fails, force a fresh OAuth flow:

```javascript
// Clear all auth data
sessionStorage.removeItem('gh_access_token');
sessionStorage.removeItem('gh_auth_code');
sessionStorage.removeItem('gh_auth_state');
localStorage.removeItem('gh_access_token');
localStorage.removeItem('oauth_state');

// Reload page - should show "Sign in with GitHub" button
window.location.reload();
```

### 6. Check Server Logs

In terminal, check if server received OAuth request:
```bash
docker logs template-doctor-combined --tail 100 | grep -i oauth
```

Expected: `GitHub OAuth response { requestId: '...', status: 200, hasError: false }`

### 7. Verify Environment Variables

Check server has OAuth credentials:
```bash
docker exec template-doctor-combined env | grep GITHUB_CLIENT
```

Should show:
- `GITHUB_CLIENT_ID=...`
- `GITHUB_CLIENT_SECRET=...`

If missing, these need to be in `.env` file at project root.
