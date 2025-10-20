# API Improvements Plan

**Created**: 2025-10-19  
**Status**: 📋 Planning  
**Priority**: High - Security & Code Quality

---

## Overview

This plan outlines three critical improvements to the Template-Doctor API:

1. **Rate Limiting**: Implement API-wide rate limiting middleware
2. **OAuth 2.0 API Authentication**: Secure API requests with OAuth tokens
3. **Frontend Console.log Cleanup**: Remove debug logging from production code

---

## 1. API Rate Limiting

### Current State

✅ **Partial Implementation**

- Rate limiting EXISTS for `/api/v4/issue-ai-proxy` endpoint only
- Located in `packages/server/src/routes/misc.ts` (lines 365-393)
- In-memory bucket implementation
- Environment-configurable: `ISSUE_AI_RATE_LIMIT_WINDOW_MS` and `ISSUE_AI_RATE_LIMIT_MAX`

❌ **Missing**

- No rate limiting on other endpoints (OAuth, analysis, validation, etc.)
- No global rate limiting middleware
- No Redis/persistent storage for distributed deployments

### Recommended Solution

**Use `express-rate-limit` package** - Production-grade, widely adopted solution

#### Implementation Steps

1. **Install dependency**

   ```bash
   cd packages/server
   npm install express-rate-limit --save
   ```

2. **Create rate limit middleware** (`packages/server/src/middleware/rate-limit.ts`)

   ```typescript
   import rateLimit from 'express-rate-limit';

   // Global API rate limiter
   export const globalRateLimiter = rateLimit({
     windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
     max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // 100 requests per minute
     message: {
       error: 'Too many requests, please try again later',
       retryAfter: '60 seconds',
     },
     standardHeaders: true, // Return rate limit info in headers
     legacyHeaders: false,
     handler: (req, res) => {
       res.status(429).json({
         error: 'Rate limit exceeded',
         retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
       });
     },
   });

   // Stricter rate limiter for sensitive endpoints (OAuth, analysis)
   export const strictRateLimiter = rateLimit({
     windowMs: parseInt(process.env.STRICT_RATE_LIMIT_WINDOW_MS || '60000'),
     max: parseInt(process.env.STRICT_RATE_LIMIT_MAX || '20'), // 20 requests per minute
     message: {
       error: 'Too many requests to this endpoint, please try again later',
     },
     standardHeaders: true,
     legacyHeaders: false,
   });

   // AI proxy rate limiter (keep existing behavior)
   export const aiProxyRateLimiter = rateLimit({
     windowMs: parseInt(process.env.ISSUE_AI_RATE_LIMIT_WINDOW_MS || '60000'),
     max: parseInt(process.env.ISSUE_AI_RATE_LIMIT_MAX || '20'),
     standardHeaders: true,
     legacyHeaders: false,
   });
   ```

3. **Apply middleware in `packages/server/src/index.ts`**

   ```typescript
   import { globalRateLimiter } from './middleware/rate-limit.js';

   // Apply to all /api routes
   app.use('/api', globalRateLimiter);

   // Stricter limits applied per-route (see step 4)
   ```

4. **Apply strict limits to sensitive endpoints**

   ```typescript
   // In packages/server/src/routes/auth.ts
   import { strictRateLimiter } from '../middleware/rate-limit.js';

   authRouter.post('/github-oauth-token', strictRateLimiter, async (req, res) => {
     // ... existing code
   });

   // In packages/server/src/routes/analyze.ts
   import { strictRateLimiter } from '../middleware/rate-limit.js';

   analyzeRouter.post('/analyze-template', strictRateLimiter, async (req, res) => {
     // ... existing code
   });
   ```

5. **Replace existing AI proxy rate limiting**

   ```typescript
   // In packages/server/src/routes/misc.ts
   import { aiProxyRateLimiter } from '../middleware/rate-limit.js';

   // Remove existing rateLimitKey() and checkRateLimit() functions
   // Replace with:
   miscRouter.post('/issue-ai-proxy', aiProxyRateLimiter, async (req, res) => {
     // ... existing code without manual rate limit check
   });
   ```

6. **Environment variables** (`.env.example`)

   ```bash
   # Global API rate limiting
   RATE_LIMIT_WINDOW_MS=60000          # 1 minute
   RATE_LIMIT_MAX=100                  # 100 requests per minute

   # Strict rate limiting (OAuth, analysis)
   STRICT_RATE_LIMIT_WINDOW_MS=60000   # 1 minute
   STRICT_RATE_LIMIT_MAX=20            # 20 requests per minute

   # AI proxy rate limiting (existing)
   ISSUE_AI_RATE_LIMIT_WINDOW_MS=60000
   ISSUE_AI_RATE_LIMIT_MAX=20
   ```

#### Future Enhancement (Optional)

**Redis-based rate limiting for distributed deployments**

```bash
npm install rate-limit-redis redis --save
```

```typescript
import { createClient } from 'redis';
import RedisStore from 'rate-limit-redis';

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

export const globalRateLimiter = rateLimit({
  windowMs: 60000,
  max: 100,
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:global:',
  }),
});
```

#### Testing Requirements

- [ ] Test global rate limiter with 100+ rapid requests
- [ ] Test strict rate limiter on OAuth endpoint (>20 requests/min)
- [ ] Test strict rate limiter on analysis endpoint (>20 requests/min)
- [ ] Verify rate limit headers in response (`X-RateLimit-Limit`, `X-RateLimit-Remaining`)
- [ ] Test rate limit reset after window expires
- [ ] Playwright test: Verify 429 status code and error message

---

## 2. OAuth 2.0 API Authentication

### Current State

✅ **Frontend OAuth Implementation**

- GitHub OAuth flow for user login (device flow)
- Token stored in localStorage
- User authentication status tracked

❌ **Missing API Authentication**

- API endpoints do NOT validate OAuth tokens
- No Bearer token authentication
- Endpoints are publicly accessible (except admin endpoints)
- No user context in API requests

### Security Requirements

**Goal**: Authenticate API requests using GitHub OAuth tokens from frontend

**Scope**: Protect endpoints that require authentication:

- `/api/v4/analyze-template` - Template analysis
- `/api/v4/validation-*` - Validation endpoints
- `/api/v4/issue-create` - GitHub issue creation
- `/api/v4/action-*` - GitHub Actions endpoints
- `/api/v4/leaderboards` - Leaderboards (optional: allow public read, require auth for write)

**Public Endpoints** (no auth required):

- `/api/health` - Health check
- `/api/v4/client-settings` - Runtime config
- `/api/v4/github-oauth-token` - OAuth token exchange (used during login)

### Recommended Solution

**Implement Bearer Token Authentication Middleware**

#### Implementation Steps

1. **Create authentication middleware** (`packages/server/src/middleware/auth.ts`)

   ```typescript
   import { Request, Response, NextFunction } from 'express';
   import { Octokit } from '@octokit/rest';

   // Extend Express Request to include user info
   declare global {
     namespace Express {
       interface Request {
         user?: {
           login: string;
           id: number;
           name: string | null;
           email: string | null;
           avatar_url: string;
         };
         githubToken?: string;
       }
     }
   }

   /**
    * Middleware to validate GitHub OAuth token from Authorization header
    * Adds user info to req.user if token is valid
    */
   export async function authenticateGitHub(req: Request, res: Response, next: NextFunction) {
     try {
       // Extract token from Authorization header
       const authHeader = req.headers.authorization;

       if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return res.status(401).json({
           error: 'Missing or invalid Authorization header',
           message: 'Please provide a valid GitHub token in Authorization: Bearer <token>',
         });
       }

       const token = authHeader.substring(7); // Remove 'Bearer ' prefix

       // Validate token with GitHub API
       const octokit = new Octokit({ auth: token });

       try {
         const { data: user } = await octokit.users.getAuthenticated();

         // Attach user info and token to request
         req.user = {
           login: user.login,
           id: user.id,
           name: user.name,
           email: user.email,
           avatar_url: user.avatar_url,
         };
         req.githubToken = token;

         next();
       } catch (githubError: any) {
         // Invalid or expired token
         return res.status(401).json({
           error: 'Invalid GitHub token',
           message: 'Token validation failed. Please log in again.',
         });
       }
     } catch (error: any) {
       console.error('[auth] Authentication error:', error);
       return res.status(500).json({
         error: 'Authentication error',
         message: 'Failed to validate credentials',
       });
     }
   }

   /**
    * Optional middleware - allows both authenticated and unauthenticated requests
    * Attaches user info if token is present and valid
    */
   export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
     const authHeader = req.headers.authorization;

     if (!authHeader || !authHeader.startsWith('Bearer ')) {
       // No token provided - continue without user info
       return next();
     }

     // Token provided - validate it
     return authenticateGitHub(req, res, next);
   }
   ```

2. **Apply authentication to protected routes**

   **In `packages/server/src/routes/analyze.ts`:**

   ```typescript
   import { authenticateGitHub } from '../middleware/auth.js';

   analyzeRouter.post(
     '/analyze-template',
     strictRateLimiter,
     authenticateGitHub, // <-- Add authentication
     async (req: Request, res: Response) => {
       // Now req.user and req.githubToken are available
       const { user, githubToken } = req;

       // Use githubToken for GitHub API calls instead of env tokens
       // This provides per-user rate limits and audit trail

       // ... existing code
     },
   );
   ```

   **In `packages/server/src/routes/validation.ts`:**

   ```typescript
   import { authenticateGitHub } from '../middleware/auth.js';

   // Apply to all validation routes
   validationRouter.use(authenticateGitHub);
   ```

   **In `packages/server/src/routes/misc.ts`:**

   ```typescript
   import { authenticateGitHub } from '../middleware/auth.js';

   miscRouter.post(
     '/issue-create',
     strictRateLimiter,
     authenticateGitHub, // <-- Add authentication
     async (req: Request, res: Response) => {
       // Use req.githubToken for issue creation
       // ... existing code
     },
   );

   // AI proxy may want optional auth to track usage per user
   miscRouter.post(
     '/issue-ai-proxy',
     aiProxyRateLimiter,
     optionalAuth, // <-- Optional: track user if authenticated
     async (req: Request, res: Response) => {
       // ... existing code
     },
   );
   ```

3. **Update frontend to send tokens** (`packages/app/src/scripts/api-client.ts` or similar)

   ```typescript
   // Create API client helper that adds Authorization header
   export async function authenticatedFetch(
     url: string,
     options: RequestInit = {},
   ): Promise<Response> {
     // Get token from GitHub auth
     const token = GitHubAuth?.accessToken || localStorage.getItem('github_access_token');

     if (!token) {
       throw new Error('User not authenticated. Please log in.');
     }

     // Add Authorization header
     const headers = {
       ...options.headers,
       Authorization: `Bearer ${token}`,
       'Content-Type': 'application/json',
     };

     return fetch(url, { ...options, headers });
   }

   // Update all API calls to use authenticatedFetch
   export async function analyzeTemplate(repoUrl: string, ruleSet: string) {
     const response = await authenticatedFetch(`${apiBase}/api/v4/analyze-template`, {
       method: 'POST',
       body: JSON.stringify({ repoUrl, ruleSet }),
     });

     if (!response.ok) {
       if (response.status === 401) {
         // Token expired or invalid - trigger re-login
         GitHubAuth?.logout();
         throw new Error('Session expired. Please log in again.');
       }
       throw new Error(`Analysis failed: ${response.statusText}`);
     }

     return response.json();
   }
   ```

4. **Update error handling for 401 responses**

   ```typescript
   // Global fetch interceptor or error handler
   window.addEventListener('unhandledrejection', (event) => {
     if (
       event.reason?.message?.includes('401') ||
       event.reason?.message?.includes('Session expired')
     ) {
       NotificationSystem.show({
         message: 'Your session has expired. Please log in again.',
         type: 'error',
         duration: 5000,
       });

       // Redirect to login
       setTimeout(() => {
         GitHubAuth?.login();
       }, 2000);
     }
   });
   ```

5. **Update API documentation**
   - Add authentication requirements to endpoint docs
   - Document Authorization header format
   - Add error codes (401, 403) to API specs

#### Admin Endpoint Enhancement

**Existing admin authentication** (username-based):

```typescript
// packages/server/src/routes/admin.ts
const ADMIN_USERS = (process.env.ADMIN_GITHUB_USERS || '').split(',');
```

**Enhanced with OAuth**:

```typescript
import { authenticateGitHub } from '../middleware/auth.js';

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const ADMIN_USERS = (process.env.ADMIN_GITHUB_USERS || '').split(',');

  if (!ADMIN_USERS.includes(req.user.login)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }

  next();
}

// Apply to all admin routes
adminRouter.use(authenticateGitHub);
adminRouter.use(requireAdmin);
```

#### Testing Requirements

- [ ] Test authenticated request with valid token
- [ ] Test request without Authorization header (expect 401)
- [ ] Test request with invalid token (expect 401)
- [ ] Test request with expired token (expect 401)
- [ ] Test admin endpoint with non-admin user (expect 403)
- [ ] Test admin endpoint with admin user (expect 200)
- [ ] Playwright test: Login flow → API call → Logout → API call (expect 401)
- [ ] Verify req.user populated correctly
- [ ] Verify user-specific GitHub API calls use req.githubToken

---

## 3. Frontend Console.log Cleanup

### Current State

❌ **Extensive Debug Logging**

- **100+ console.log statements** found in `packages/app/src/**/*.ts`
- Debug logging in production code:
  - `auth.ts`: 30+ console.log statements (OAuth flow debugging)
  - `ruleset-modal.ts`: 40+ console.log statements (analysis flow debugging)
  - `config-loader.ts`: 15+ console.log statements (config loading)
  - `runtime-config.ts`: 15+ console.log statements (runtime config)
  - Other files: `api-routes.ts`, `templates-data-loader.ts`, etc.

### Goal

**Remove or replace debug console.log statements with proper logging**

Options:

1. **Remove entirely** (preferred for obvious debug statements)
2. **Replace with conditional debug logging** (for useful diagnostics)
3. **Keep only critical user-facing logs** (errors, warnings)

### Recommended Solution

**Use a debug logging utility that respects environment/localStorage flags**

#### Implementation Steps

1. **Create debug logger utility** (`packages/app/src/utils/logger.ts`)

   ```typescript
   /**
    * Debug logger that respects localStorage debug flag
    * Only logs in development or when debug flag is set
    */
   class Logger {
     private enabled: boolean;

     constructor() {
       this.enabled = this.isDebugEnabled();
     }

     private isDebugEnabled(): boolean {
       // Check localStorage flag
       const debugFlag = localStorage.getItem('template-doctor-debug');

       // Check if in development mode
       const isDev = import.meta.env.DEV;

       return isDev || debugFlag === 'true';
     }

     debug(module: string, message: string, ...data: any[]) {
       if (this.enabled) {
         const timestamp = new Date().toISOString();
         console.log(`[${timestamp}][${module}] ${message}`, ...data);
       }
     }

     info(module: string, message: string, ...data: any[]) {
       const timestamp = new Date().toISOString();
       console.info(`[${timestamp}][${module}] ${message}`, ...data);
     }

     warn(module: string, message: string, ...data: any[]) {
       const timestamp = new Date().toISOString();
       console.warn(`[${timestamp}][${module}] ${message}`, ...data);
     }

     error(module: string, message: string, ...data: any[]) {
       const timestamp = new Date().toISOString();
       console.error(`[${timestamp}][${module}] ${message}`, ...data);
     }

     // Enable/disable debug mode
     setDebug(enabled: boolean) {
       localStorage.setItem('template-doctor-debug', enabled.toString());
       this.enabled = enabled;
     }
   }

   export const logger = new Logger();

   // Expose globally for debugging in browser console
   if (typeof window !== 'undefined') {
     (window as any).enableDebug = () => logger.setDebug(true);
     (window as any).disableDebug = () => logger.setDebug(false);
   }
   ```

2. **Replace console.log statements systematically**

   **Priority 1: Remove obvious debug statements**

   ```typescript
   // REMOVE THESE - no diagnostic value in production
   // packages/app/src/scripts/auth.ts
   console.log('AUTH_CONFIG.redirectUri:', AUTH_CONFIG.redirectUri); // ❌ Remove
   console.log('window.location.origin:', window.location.origin); // ❌ Remove
   console.log('getBasePath():', getBasePath()); // ❌ Remove

   // packages/app/src/scripts/ruleset-modal.ts
   console.log('═══════════════════════════════════════════════════════'); // ❌ Remove
   console.log('[AnalyzeRepoIntegr] ▶ START at', new Date().toISOString()); // ❌ Remove
   ```

   **Priority 2: Convert useful diagnostics to debug logging**

   ```typescript
   // CONVERT TO DEBUG LOGGING
   // packages/app/src/scripts/auth.ts
   import { logger } from '../utils/logger.js';

   // Before:
   console.log('Starting login flow with scopes:', AUTH_CONFIG.scope);

   // After:
   logger.debug('auth', 'Starting login flow', { scopes: AUTH_CONFIG.scope });
   ```

   **Priority 3: Keep critical user-facing logs**

   ```typescript
   // KEEP AS console.error or console.warn
   // packages/app/src/scripts/auth.ts
   console.error('Error loading runtime config:', error); // ✅ Keep (user-facing error)
   console.warn('[GitHubAuth] Already have stored code; not overwriting'); // ✅ Keep (important warning)
   ```

3. **File-by-file cleanup plan**

   | File                       | Console.log Count | Action                                       |
   | -------------------------- | ----------------- | -------------------------------------------- |
   | `auth.ts`                  | 30+               | Remove 20, convert 5 to debug, keep 5 errors |
   | `ruleset-modal.ts`         | 40+               | Remove 35, convert 3 to debug, keep 2 errors |
   | `config-loader.ts`         | 15+               | Remove 8, convert 5 to debug, keep 2 errors  |
   | `runtime-config.ts`        | 15+               | Remove 8, convert 5 to debug, keep 2 errors  |
   | `api-routes.ts`            | 5                 | Remove 2, convert 3 to debug                 |
   | `templates-data-loader.ts` | 4                 | Convert all to debug                         |
   | `notifications.ts`         | 3                 | Keep errors, convert warnings to debug       |
   | `validation.ts`            | 5                 | Keep errors, convert debug to logger.debug   |
   | `server-bridge.ts`         | 3                 | Keep errors, convert warnings                |

4. **Update build configuration to strip debug logs in production** (optional)

   **Vite config** (`packages/app/vite.config.ts`):

   ```typescript
   import { defineConfig } from 'vite';

   export default defineConfig({
     build: {
       minify: 'terser',
       terserOptions: {
         compress: {
           drop_console: true, // Remove ALL console.* in production
           drop_debugger: true,
         },
       },
     },
   });
   ```

   **Better alternative - selective stripping**:

   ```typescript
   import { defineConfig } from 'vite';

   export default defineConfig({
     build: {
       minify: 'terser',
       terserOptions: {
         compress: {
           pure_funcs: ['console.log', 'console.debug'], // Only remove log/debug
           // Keep console.error, console.warn
         },
       },
     },
   });
   ```

5. **Add documentation for debug mode**

   ````markdown
   ## Debug Mode

   To enable verbose logging in production:

   1. Open browser console
   2. Run: `window.enableDebug()`
   3. Reload page

   To disable:

   ```javascript
   window.disableDebug();
   ```
   ````

   ```

   ```

#### Testing Requirements

- [ ] Build production bundle and verify console.log stripped
- [ ] Verify console.error and console.warn still present
- [ ] Test debug mode: `window.enableDebug()` → verify logs appear
- [ ] Test debug mode: `window.disableDebug()` → verify logs disappear
- [ ] Test development mode: verify debug logs visible by default
- [ ] Playwright tests: Should NOT see console.log in production mode
- [ ] Manual testing: Check all critical user flows work without errors

---

## Implementation Order

### Phase 1: Rate Limiting (1-2 days)

**Priority**: High - Security  
**Complexity**: Low

1. ✅ Install `express-rate-limit`
2. ✅ Create rate limit middleware
3. ✅ Apply global rate limiter to `/api`
4. ✅ Apply strict limiter to sensitive endpoints
5. ✅ Replace existing AI proxy rate limiting
6. ✅ Update `.env.example`
7. ✅ Test all scenarios
8. ✅ Document in README

### Phase 2: OAuth API Authentication (2-3 days)

**Priority**: High - Security  
**Complexity**: Medium

1. ✅ Create authentication middleware
2. ✅ Apply to protected endpoints
3. ✅ Update frontend API client
4. ✅ Add error handling for 401/403
5. ✅ Enhance admin authentication
6. ✅ Test authentication flow
7. ✅ Update API documentation

### Phase 3: Console.log Cleanup (1-2 days)

**Priority**: Medium - Code Quality  
**Complexity**: Medium (many files)

1. ✅ Create logger utility
2. ✅ Clean up `auth.ts` (highest priority)
3. ✅ Clean up `ruleset-modal.ts`
4. ✅ Clean up `config-loader.ts` and `runtime-config.ts`
5. ✅ Clean up remaining files
6. ✅ Configure Vite to strip logs in production
7. ✅ Test production build
8. ✅ Document debug mode

**Total Estimated Time**: 4-7 days

---

## Success Criteria

### Rate Limiting

- [ ] All API endpoints protected by rate limiting
- [ ] Rate limit headers present in responses
- [ ] 429 status code returned when limit exceeded
- [ ] Environment variables documented
- [ ] Tests passing for rate limit scenarios

### OAuth Authentication

- [ ] Protected endpoints require valid GitHub token
- [ ] Invalid/missing tokens return 401
- [ ] Admin endpoints check user permissions (403 for non-admins)
- [ ] Frontend sends Authorization header
- [ ] User experience: smooth re-authentication flow
- [ ] Tests passing for auth scenarios

### Console.log Cleanup

- [ ] Production build has no debug console.log statements
- [ ] Critical errors still logged (console.error)
- [ ] Debug mode works for diagnostics
- [ ] All user flows tested and working
- [ ] Documentation updated

---

## Security Considerations

### Rate Limiting

- **DDoS Protection**: Global rate limiter prevents API abuse
- **Resource Protection**: Stricter limits on expensive operations
- **Per-User Limits**: Consider user-based rate limiting (future enhancement)

### OAuth Authentication

- **Token Validation**: Validate tokens with GitHub on every request
- **Token Storage**: Store tokens securely (localStorage with HTTPS only)
- **Token Expiry**: Handle expired tokens gracefully
- **Audit Trail**: Log user actions for security monitoring
- **Scope Validation**: Verify token has required scopes

### General

- **HTTPS Only**: Ensure production uses HTTPS
- **CORS**: Keep CORS restrictive (specific origins only)
- **Input Validation**: Validate all request parameters
- **Error Messages**: Don't leak sensitive info in error messages

---

## Future Enhancements

### Rate Limiting

- [ ] Redis-backed rate limiting for distributed deployments
- [ ] Per-user rate limiting (tracked by GitHub username)
- [ ] Dynamic rate limits based on user tier (free vs. premium)
- [ ] Rate limit monitoring dashboard

### Authentication

- [ ] JWT tokens (instead of GitHub token validation on every request)
- [ ] Refresh tokens for long-lived sessions
- [ ] API keys for programmatic access
- [ ] Role-based access control (RBAC) beyond admin/user

### Logging

- [ ] Structured logging with log levels
- [ ] Log aggregation (e.g., Application Insights, LogRocket)
- [ ] Performance monitoring
- [ ] Error tracking (e.g., Sentry)

---

## References

- [express-rate-limit documentation](https://www.npmjs.com/package/express-rate-limit)
- [GitHub OAuth Apps documentation](https://docs.github.com/en/apps/oauth-apps)
- [Express middleware best practices](https://expressjs.com/en/guide/using-middleware.html)
- [Vite production build optimization](https://vitejs.dev/config/build-options.html)

---

**Next Steps**: Review plan with team → Approve → Begin Phase 1 implementation
