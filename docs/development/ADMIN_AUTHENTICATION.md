# Admin Authentication & Authorization

## Overview

Admin endpoints in Template Doctor are protected by GitHub-based authentication and role-based authorization. This ensures only designated administrators can modify system configuration.

## Security Model

### Authentication Flow

1. **Client includes GitHub token** in Authorization header:

   ```
   Authorization: Bearer <github_personal_access_token>
   ```

2. **Server validates token** with GitHub API:

   ```
   GET https://api.github.com/user
   ```

3. **Server checks authorization** against admin user list:

   ```
   ADMIN_GITHUB_USERS=username1,username2,username3
   ```

4. **Access granted** if user is in admin list

### Protected Endpoints

All endpoints under `/api/v4/admin/*` require authentication and admin privileges:

- `GET /api/v4/admin/config` - List all settings
- `GET /api/v4/admin/config/:key` - Get single setting
- `PUT /api/v4/admin/config/:key` - Update single setting
- `POST /api/v4/admin/config` - Bulk update settings
- `DELETE /api/v4/admin/config/:key` - Delete setting (reset to default)
- `POST /api/v4/admin/config/reset` - Reset all to defaults

## Configuration

### Environment Variables

**Required** in `.env` file:

```bash
# Admin users (comma-separated GitHub usernames)
ADMIN_GITHUB_USERS=octocat,username2,username3

# GitHub token for the admin user (for testing)
GITHUB_TOKEN=ghp_your_personal_access_token_here
```

### Docker Compose

The `docker-compose.yml` automatically passes `ADMIN_GITHUB_USERS` to containers:

```yaml
environment:
  - ADMIN_GITHUB_USERS=${ADMIN_GITHUB_USERS}
```

### Azure Deployment

When deploying to Azure, set the environment variable via `azd env set` or in the Azure Portal:

```bash
azd env set ADMIN_GITHUB_USERS "octocat,username2"
```

Or add to `infra/main.bicep`:

```bicep
{
  name: 'ADMIN_GITHUB_USERS'
  value: adminGitHubUsers
}
```

## Usage Examples

### Test Authentication (No Token)

```bash
curl http://localhost:3000/api/v4/admin/config
```

**Response:**

```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid Authorization header. Expected: Bearer <github_token>"
}
```

### Test with Invalid Token

```bash
curl -H "Authorization: Bearer fake_token" \
  http://localhost:3000/api/v4/admin/config
```

**Response:**

```json
{
  "error": "Unauthorized",
  "message": "Invalid GitHub token or unable to fetch user information"
}
```

### Test with Valid Admin Token

```bash
# Get your GitHub token
export GITHUB_TOKEN=ghp_your_token_here

# List all settings
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  http://localhost:3000/api/v4/admin/config | jq
```

**Response:**

```json
{
  "settings": [
    {
      "_id": "...",
      "key": "DEFAULT_RULE_SET",
      "value": "dod",
      "category": "features",
      "updatedBy": "anfibiacreativa",
      "createdAt": "2025-10-16T09:45:00.000Z",
      "updatedAt": "2025-10-16T09:45:00.000Z"
    }
  ]
}
```

### Update a Setting

```bash
curl -X PUT \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "security"}' \
  http://localhost:3000/api/v4/admin/config/DEFAULT_RULE_SET | jq
```

**Response:**

```json
{
  "success": true,
  "key": "DEFAULT_RULE_SET",
  "value": "security"
}
```

### Bulk Update Settings

```bash
curl -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "DEFAULT_RULE_SET": "security",
      "REQUIRE_AUTH_FOR_RESULTS": "true",
      "ISSUE_AI_ENABLED": "true"
    }
  }' \
  http://localhost:3000/api/v4/admin/config | jq
```

**Response:**

```json
{
  "success": true,
  "updated": 3
}
```

### Test Non-Admin User

```bash
# Use token from a user NOT in ADMIN_GITHUB_USERS
export OTHER_TOKEN=ghp_another_users_token

curl -H "Authorization: Bearer $OTHER_TOKEN" \
  http://localhost:3000/api/v4/admin/config
```

**Response:**

```json
{
  "error": "Forbidden",
  "message": "User 'otheruser' does not have admin privileges",
  "hint": "Contact the system administrator to request admin access"
}
```

## Security Logs

The server logs authentication events:

```
[Auth] Admin access granted to: anfibiacreativa
[Auth] Unauthorized admin access attempt by: otheruser
[Auth] GitHub user fetch failed: 401
```

Monitor logs with:

```bash
# Docker Compose
docker logs template-doctor-combined | grep Auth

# Azure Container Apps
az containerapp logs show -n <app-name> -g <resource-group> --follow | grep Auth
```

## Security Best Practices

### 1. Limit Admin Users

Only add trusted users to `ADMIN_GITHUB_USERS`:

```bash
# ✅ Good: Minimal admin list
ADMIN_GITHUB_USERS=lead-developer,devops-engineer

# ❌ Bad: Too many admins
ADMIN_GITHUB_USERS=user1,user2,user3,user4,user5
```

### 2. Use Fine-Grained PATs

Create GitHub Personal Access Tokens with minimal scopes:

- **Required scopes**: None (only `read:user` is needed, which is implicit)
- **Optional**: Add `repo` scope only if admin needs to trigger workflows

### 3. Rotate Tokens Regularly

```bash
# Create new token at: https://github.com/settings/tokens
# Update .env
GITHUB_TOKEN=ghp_new_token_here

# Restart services
docker-compose --profile combined restart
```

### 4. Monitor Admin Activity

All admin actions are logged with the GitHub username:

```javascript
{
  "key": "DEFAULT_RULE_SET",
  "value": "security",
  "updatedBy": "anfibiacreativa",  // ← Audit trail
  "updatedAt": "2025-10-16T09:50:00.000Z"
}
```

### 5. Use HTTPS in Production

**Never** send tokens over HTTP in production:

```bash
# ✅ Production (HTTPS)
https://template-doctor.azurewebsites.net/api/v4/admin/config

# ❌ Development only (HTTP)
http://localhost:3000/api/v4/admin/config
```

### 6. No Admin Tokens in Frontend

Admin tokens should **never** be exposed to browser clients:

- ✅ Store tokens in `.env` (server-side)
- ✅ Use in CI/CD pipelines with secrets
- ❌ Never embed in frontend JavaScript
- ❌ Never commit to version control

## Troubleshooting

### "Admin access not configured"

**Cause**: `ADMIN_GITHUB_USERS` environment variable not set

**Fix**:

```bash
# Add to .env
echo "ADMIN_GITHUB_USERS=your_github_username" >> .env

# Restart
docker-compose --profile combined down
docker-compose --profile combined up -d
```

### "Invalid GitHub token"

**Cause**: Token expired, revoked, or has insufficient scopes

**Fix**:

1. Create new token at https://github.com/settings/tokens
2. Update `.env` with new token
3. Restart services

### "User does not have admin privileges"

**Cause**: GitHub username not in `ADMIN_GITHUB_USERS` list

**Fix**:

```bash
# Add user to admin list
ADMIN_GITHUB_USERS=existing_admin,new_admin_username

# Restart
docker-compose --profile combined restart
```

### Verify Your Token Works

```bash
# Test token with GitHub API directly
export GITHUB_TOKEN=ghp_your_token

curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/user | jq '.login'
```

Should return your GitHub username. If not, token is invalid.

## Implementation Details

### Middleware Stack

```typescript
// All /api/v4/admin/* routes use this middleware chain:
adminConfigRouter.use(requireAuth); // 1. Validate GitHub token
adminConfigRouter.use(requireAdmin); // 2. Check admin privileges
```

### Authentication Middleware

Location: `packages/server/src/middleware/auth.ts`

```typescript
export async function requireAuth(req, res, next) {
  // Extract token from Authorization: Bearer <token>
  // Validate with GitHub API
  // Attach req.githubUser
}

export function requireAdmin(req, res, next) {
  // Check req.githubUser against ADMIN_GITHUB_USERS
  // Grant or deny access
}
```

### Route Guards

Location: `packages/server/src/routes/admin-config.ts`

```typescript
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const adminConfigRouter = Router();

// Apply to ALL routes
adminConfigRouter.use(requireAuth);
adminConfigRouter.use(requireAdmin);

// All routes after this are protected
adminConfigRouter.get('/config', ...);
adminConfigRouter.put('/config/:key', ...);
```

## Testing Security

Run the test suite:

```bash
./scripts/test-admin-security.sh
```

Or manually:

```bash
# 1. Test no auth (should fail)
curl http://localhost:3000/api/v4/admin/config

# 2. Test invalid token (should fail)
curl -H "Authorization: Bearer fake" \
  http://localhost:3000/api/v4/admin/config

# 3. Test valid admin (should succeed)
export GITHUB_TOKEN=$(grep GITHUB_TOKEN .env | cut -d= -f2)
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  http://localhost:3000/api/v4/admin/config

# 4. Test create setting (should succeed)
curl -X PUT \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"test"}' \
  http://localhost:3000/api/v4/admin/config/TEST

# 5. Verify audit trail
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  http://localhost:3000/api/v4/admin/config | \
  jq '.settings[] | select(.key == "TEST") | .updatedBy'
```

## Related Documentation

- [Configuration Storage](./configuration-storage.md) - Database-backed settings
- [Environment Variables](./ENVIRONMENT_VARIABLES.md) - Complete .env reference
- [Docker Compose Guide](../DOCKER_COMPOSE_GUIDE.md) - Local deployment
- [Azure Deployment](../deployment/AZD_DEPLOYMENT.md) - Production deployment
