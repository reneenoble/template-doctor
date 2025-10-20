# OAuth Setup Guide - Port 3000

## Quick Setup for Testing with OAuth

### Port Allocation for OAuth Testing

| Service             | Port   | OAuth Callback URL                    |
| ------------------- | ------ | ------------------------------------- |
| **Vite Preview**    | `3000` | `http://localhost:3000/callback.html` |
| **Express Backend** | `3001` | N/A (API server)                      |

## Step 1: Create GitHub OAuth App (Port 3000)

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: `Template Doctor Local (Port 3000)`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/callback.html`
4. Click "Register application"
5. Copy the **Client ID** (starts with `Ov23...`)
6. Generate a **Client Secret** and copy it

## Step 2: Update Configuration

### Update `.env` in repo root:

```bash
# GitHub OAuth (Port 3000 app)
GITHUB_CLIENT_ID=.YourClientID
GITHUB_CLIENT_SECRET=your_secret_here

# GitHub Tokens (same as before)
GITHUB_TOKEN=ghp_your_pat_token
GH_WORKFLOW_TOKEN=ghp_your_workflow_token
GITHUB_TOKEN_ANALYZER=ghp_your_analyzer_token
```

### Update `packages/app/config.preview.json`:

```json
{
  "githubOAuth": {
    "clientId": ".YourClientID",
    "redirectUri": "http://localhost:3000/callback.html"
  },
  "backend": {
    "baseUrl": "http://localhost:3001"
  }
}
```

### Update `packages/server/.env`:

```bash
PORT=3001
GITHUB_CLIENT_ID=.YourClientID
GITHUB_CLIENT_SECRET=your_secret_here
```

## Step 3: Start Both Servers

### Terminal 1: Start Express Backend

```bash
cd packages/server
npm run dev
```

You should see:

```
🚀 Template Doctor server running on port 3001
📊 Health check: http://localhost:3001/api/health
🔑 GitHub Token configured: true
```

### Terminal 2: Start Frontend Preview

```bash
./preview.sh
```

Or manually:

```bash
cd packages/app
npm run build
npm run preview
```

You should see:

```
🚀 Starting preview server on port 3000...
  🖥️  Frontend: http://localhost:3000
  🔐 OAuth Callback: http://localhost:3000/callback.html
  ⚙️  Backend: http://localhost:3001
```

## Step 4: Test OAuth Login

1. Open http://localhost:3000
2. Click "Login with GitHub"
3. You'll be redirected to GitHub for authorization
4. After authorizing, you'll be redirected back to `http://localhost:3000/callback.html`
5. The app will exchange the code for a token via `http://localhost:3001/api/v4/github-oauth-token`
6. You should be logged in!

## Architecture

```
┌─────────────────────────────────────────┐
│  Browser: http://localhost:3000         │
│  (Vite Preview - Production Build)      │
└─────────────────┬───────────────────────┘
                  │
                  │ 1. User clicks "Login"
                  ↓
┌─────────────────────────────────────────┐
│  GitHub OAuth                           │
│  Redirect to authorize                  │
└─────────────────┬───────────────────────┘
                  │
                  │ 2. User authorizes
                  ↓
┌─────────────────────────────────────────┐
│  Callback: localhost:3000/callback.html │
│  (receives code parameter)              │
└─────────────────┬───────────────────────┘
                  │
                  │ 3. POST code to backend
                  ↓
┌─────────────────────────────────────────┐
│  Express: http://localhost:3001         │
│  POST /api/v4/github-oauth-token        │
│  Returns: { access_token: "gho_..." }  │
└─────────────────────────────────────────┘
```

## Troubleshooting

### "OAuth redirect URI mismatch"

- **Problem**: GitHub OAuth app callback URL doesn't match
- **Solution**: Verify callback URL in GitHub settings is exactly `http://localhost:3000/callback.html`

### "Backend not configured for GitHub OAuth"

- **Problem**: Express server missing CLIENT_ID or CLIENT_SECRET
- **Solution**: Check `packages/server/.env` has both values set

### "Failed to exchange token"

- **Problem**: Backend can't reach GitHub or wrong client credentials
- **Solution**:
  1. Check internet connection
  2. Verify CLIENT_ID and CLIENT_SECRET match GitHub app
  3. Check backend logs: `docker logs template-doctor-server`

### Port already in use

```bash
# Kill process on port 3000
lsof -ti :3000 | xargs kill -9

# Kill process on port 3001
lsof -ti :3001 | xargs kill -9
```

### Frontend can't reach backend

- **Problem**: CORS or wrong backend URL
- **Solution**: Check `config.preview.json` has `"baseUrl": "http://localhost:3001"`

## Alternative: Create Separate OAuth Apps for Each Port

If you want to test multiple environments:

| Environment     | Port   | OAuth App Name          | Callback URL                            |
| --------------- | ------ | ----------------------- | --------------------------------------- |
| **Development** | `4000` | Template Doctor Dev     | `http://localhost:4000/callback.html`   |
| **Preview**     | `3000` | Template Doctor Preview | `http://localhost:3000/callback.html`   |
| **Production**  | `443`  | Template Doctor Prod    | `https://your-domain.com/callback.html` |

Each needs its own GitHub OAuth app with matching callback URLs.

## Environment Variables Reference

```bash
# Required for OAuth
GITHUB_CLIENT_ID=.         # From GitHub OAuth app
GITHUB_CLIENT_SECRET=abcd1234...   # From GitHub OAuth app

# Required for API operations
GITHUB_TOKEN=ghp_...               # Personal Access Token
GH_WORKFLOW_TOKEN=ghp_...          # Workflow token (same as GITHUB_TOKEN)
GITHUB_TOKEN_ANALYZER=ghp_...      # Analyzer token (same as GITHUB_TOKEN)
```

## Quick Commands

```bash
# Start preview mode (port 3000)
./preview.sh

# Or manually:
cd packages/app && npm run build && npm run preview

# Start Express backend (port 3001)
cd packages/server && npm run dev

# Test health
curl http://localhost:3001/api/health

# Test OAuth endpoint (should return 400 - missing code)
curl -X POST http://localhost:3001/api/v4/github-oauth-token
```

## Config Files Summary

### `packages/app/config.preview.json` (Port 3000)

```json
{
  "githubOAuth": {
    "clientId": "Ov23li6IDVTv9Ml50OKi",
    "redirectUri": "http://localhost:3000/callback.html"
  },
  "backend": {
    "baseUrl": "http://localhost:3001"
  }
}
```

### `packages/app/config.local.json` (Port 4000 - Dev)

```json
{
  "githubOAuth": {
    "clientId": "Ov23li6IDVTv9Ml50OKi",
    "redirectUri": "http://localhost:4000/callback.html"
  },
  "backend": {
    "baseUrl": "http://localhost:3001"
  }
}
```

---

**Ready to test!** 🚀

1. Start backend: `cd packages/server && npm run dev`
2. Start preview: `./preview.sh`
3. Open: http://localhost:3000
4. Login with GitHub OAuth
