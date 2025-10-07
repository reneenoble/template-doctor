# Setup Endpoint - Configuration Persistence

The `/api/v4/setup` endpoint allows authorized users to manage runtime configuration overrides that persist across server restarts using GitHub Gists.

## Overview

- **GET /api/v4/setup** - Load current configuration overrides from GitHub Gist
- **POST /api/v4/setup** - Save configuration overrides to GitHub Gist

## Architecture

### Storage: GitHub Gist (Private)

Configuration is stored as a CSV file in a private GitHub Gist:

```csv
key,value,updated_by,updated_at
feature1,enabled,anfibiacreativa,2025-10-06T12:42:57.675Z
timeout,5000,anfibiacreativa,2025-10-06T12:42:57.675Z
```

**File**: `template-doctor-config.csv`

### Authorization

Only users listed in `SETUP_ALLOWED_USERS` environment variable can modify configuration:

```bash
SETUP_ALLOWED_USERS=user1,user2,admin
```

## Setup Instructions

### 1. Create GitHub Gist (One-time)

**Option A: Via GitHub UI**

1. Go to https://gist.github.com/
2. Create a new **secret** (private) gist
3. Filename: `template-doctor-config.csv`
4. Content:
    ```csv
    key,value,updated_by,updated_at
    ```
5. Click "Create secret gist"
6. Copy the Gist ID from the URL (e.g., `https://gist.github.com/USERNAME/abc123def456` → `abc123def456`)

**Option B: Via API (requires `gist` scope)**

```bash
curl -X POST https://api.github.com/gists \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Template Doctor Configuration Overrides",
    "public": false,
    "files": {
      "template-doctor-config.csv": {
        "content": "key,value,updated_by,updated_at\n"
      }
    }
  }'
```

### 2. Configure Environment Variables

Add to `.env`:

```bash
# GitHub Gist ID for config persistence
CONFIG_GIST_ID=your_gist_id_here

# Authorized users (comma-separated)
SETUP_ALLOWED_USERS=yourusername,teammate
```

### 3. GitHub Token Requirements

The `GITHUB_TOKEN` or `GH_TOKEN` must have the `gist` scope:

```bash
# Required scopes: repo, workflow, gist
GITHUB_TOKEN=ghp_your_token_here
```

**To add `gist` scope to existing token:**

1. Go to https://github.com/settings/tokens
2. Click on your token
3. Enable `gist` scope
4. Click "Update token"
5. Copy the regenerated token (shown once)
6. Update `.env` with new token

## API Usage

### GET - Load Configuration

```bash
curl http://localhost:3001/api/v4/setup
```

**Response:**

```json
{
    "overrides": {
        "feature1": "enabled",
        "timeout": "5000"
    },
    "metadata": [
        {
            "key": "feature1",
            "value": "enabled",
            "updatedBy": "anfibiacreativa",
            "updatedAt": "2025-10-06T12:42:57.675Z"
        }
    ],
    "count": 2,
    "source": "gist:abc123def456"
}
```

### POST - Save Configuration

**Add or Update:**

```bash
curl -X POST http://localhost:3001/api/v4/setup \
  -H "Content-Type: application/json" \
  -d '{
    "user": "anfibiacreativa",
    "overrides": {
      "feature1": "enabled",
      "timeout": "5000",
      "newKey": "newValue"
    }
  }'
```

**Delete (set to null):**

```bash
curl -X POST http://localhost:3001/api/v4/setup \
  -H "Content-Type: application/json" \
  -d '{
    "user": "anfibiacreativa",
    "overrides": {
      "oldKey": null
    }
  }'
```

**Response:**

```json
{
    "ok": true,
    "message": "Configuration overrides saved to Gist",
    "applied": 2,
    "timestamp": "2025-10-06T12:42:57.675Z",
    "gist": {
        "id": "abc123def456",
        "url": "https://gist.github.com/username/abc123def456",
        "file": "template-doctor-config.csv"
    }
}
```

## Security

### What Gets Stored (Safe ✅)

- Configuration keys and values (e.g., `feature1=enabled`)
- Username who made the change
- Timestamp of change

### What NEVER Gets Stored (Protected 🔒)

- ❌ GitHub tokens
- ❌ OAuth secrets
- ❌ API keys
- ❌ Any credentials

Tokens are only used for **authentication** when accessing the GitHub API - they are never written to the Gist.

### Authorization Flow

1. User sends request with `user` field
2. Server checks if `user` is in `SETUP_ALLOWED_USERS`
3. If authorized, server uses `GITHUB_TOKEN` to update Gist
4. Server returns success/failure response

## Error Handling

### Missing Gist Configuration

```json
{
    "overrides": {},
    "metadata": [],
    "count": 0,
    "message": "No configuration overrides found",
    "hint": "Set CONFIG_GIST_ID environment variable"
}
```

### Unauthorized User

```json
{
    "error": "Unauthorized: user not in SETUP_ALLOWED_USERS",
    "requestedUser": "hacker"
}
```

### Missing Token Scope

```
Error: RequestError [HttpError]: Not Found
```

**Solution**: Add `gist` scope to GitHub token (see setup instructions above)

## Integration

### With config-overrides.ts

The setup endpoint works alongside the in-memory override system in `packages/server/src/shared/config-overrides.ts`:

1. **On GET**: Load overrides from Gist → Apply to memory
2. **On POST**:
    - Update Gist with new values
    - Apply overrides to memory immediately
3. **On server restart**:
    - GET endpoint can reload from Gist
    - Or admin can manually re-POST overrides

### Deployment Considerations

**Azure Container Apps / Production:**

- Set `CONFIG_GIST_ID` in environment variables
- Set `SETUP_ALLOWED_USERS` to admin usernames
- Ensure `GITHUB_TOKEN` has `gist` scope
- Use private Gist for sensitive configurations

**Local Development:**

- Use same or separate Gist for testing
- Can use different `CONFIG_GIST_ID` per environment
- Test authorization with your own username

## Smoke Testing

The setup endpoint is included in `scripts/smoke-api.sh`:

```bash
# Section 17: Setup Configuration Overrides
./scripts/smoke-api.sh
```

**Expected Results:**

- GET returns current overrides (or empty if none)
- POST rejects unauthorized users (403)
- POST succeeds for authorized users (200)

## Troubleshooting

### "CONFIG_GIST_ID not configured"

Add `CONFIG_GIST_ID` to `.env` file

### "Requires authentication" (401)

- Check `GITHUB_TOKEN` is set in `.env`
- Verify token is valid (not expired)

### "Not Found" (404) on POST

- Token missing `gist` scope
- Add scope at https://github.com/settings/tokens
- Update token in `.env`

### "Unauthorized: user not in SETUP_ALLOWED_USERS"

- Add your username to `SETUP_ALLOWED_USERS` in `.env`
- Restart server to load new env vars

### Gist exists but file not found

- Manually add `template-doctor-config.csv` to the Gist
- Or POST will create it automatically
