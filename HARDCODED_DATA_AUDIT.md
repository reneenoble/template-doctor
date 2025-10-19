# Hardcoded Data & Magic Numbers Audit Report

**Generated:** October 18, 2025  
**Scope:** packages/app, packages/server, packages/analyzer-core  
**Excluded:** packages/api (marked for deletion)

---

## 🟢 ACCEPTABLE - Environment-Based Configuration

### Server Configuration (packages/server)

✅ **Port Configuration** - `packages/server/src/index.ts:16`
```typescript
const port = process.env.PORT || 3000;
```
- **Rationale**: Default port 3000 required for OAuth callback compatibility
- **Risk**: Low - configurable via environment variable
- **Action**: None required

✅ **CORS Origins** - `packages/server/src/shared/env.ts:27`
```typescript
"http://localhost:4000,http://localhost:5173,http://localhost:8080"
```
- **Rationale**: Standard development ports (Vite primary, fallback, legacy)
- **Risk**: Low - only used in development, configurable via `CORS_ALLOWED_ORIGINS`
- **Action**: None required

✅ **GitHub API Base URLs** - Multiple locations
```typescript
"https://api.github.com"
"https://github.com/login/oauth/access_token"
```
- **Rationale**: Official GitHub API endpoints (stable, public)
- **Risk**: None - these are official endpoints
- **Action**: None required

✅ **Azure Cosmos DB Scope** - `packages/server/src/services/database.ts:235`
```typescript
'https://cosmos.azure.com/.default'
```
- **Rationale**: Official Azure Cosmos DB OAuth scope
- **Risk**: None - official Azure endpoint
- **Action**: None required

---

## 🟡 ACCEPTABLE WITH CAVEATS - Demo Data & UI Constants

### Leaderboards Demo Data (NEW)

⚠️ **Demo Data JSON** - `packages/app/public/data/leaderboards-demo.json`
- **Contains**: 
  - User names (Hailey Victory, Marcus Chen, Pamela Fox, etc.)
  - Statistics (1247 templates, 342 MCP templates, 125,847 installs)
  - Template names (azure-search-openai-demo, contoso-chat, etc.)
  - Model names (GPT-4o, Claude-3.5-Sonnet, etc.)
  - Success rates, download counts, health scores
- **Rationale**: Demo/preview data for leaderboards when database empty
- **Risk**: Medium - numbers become stale, user confusion if shown as "real"
- **Current Mitigation**: 
  - Toggle switch shows "Demo Data" banner
  - localStorage persistence (`leaderboards-use-demo`)
  - Default is Live mode (shows placeholders when empty)
- **Recommendation**: 
  - ✅ Add timestamp to JSON (`generatedAt: "2025-10-18"`)
  - ✅ Add disclaimer in banner: "Demo data for preview purposes only"
  - Consider quarterly review to update with realistic trends

### D3.js Chart Dimensions

⚠️ **Chart Sizing** - `packages/app/leaderboards.html` (lines 910-911, 1055)
```javascript
const width = 300 - margin.left - margin.right;
const height = 400 - margin.bottom - margin.top;
```
- **Rationale**: Fixed dimensions for responsive charts
- **Risk**: Low - standard practice for D3.js charts
- **Action**: Consider moving to CSS variables if responsive layouts needed

### CSS Hardcoded Values

⚠️ **Layout Dimensions** - `packages/app/leaderboards.html` + other HTML files
- **Examples**:
  - `max-width: 1200px` (container widths)
  - `padding: 20px 0` (spacing)
  - `font-size: 24px` (typography)
  - `border-radius: 8px` (corners)
- **Rationale**: Design system values for consistent UI
- **Risk**: Low - standard CSS practice
- **Recommendation**: Consider CSS variables/design tokens for future maintainability
  ```css
  :root {
    --container-max-width: 1200px;
    --spacing-lg: 20px;
    --font-size-heading: 24px;
    --border-radius: 8px;
  }
  ```

---

## 🟡 REVIEW RECOMMENDED - API Limits & Timeouts

### GitHub API Pagination

⚠️ **Per-Page Limits**
- `packages/server/src/shared/githubClient.ts:209`: `per_page=100`
- `packages/server/src/routes/validation.ts:112`: `per_page=10`
- `packages/app/src/data/templates-loader.ts:72`: `limit=200`
- `packages/app/src/github/github-client.ts:250`: `per_page=100`

**Recommendation**: Extract to configuration constants
```typescript
// packages/server/src/shared/constants.ts
export const GITHUB_API = {
  PER_PAGE_JOBS: 100,
  PER_PAGE_RUNS: 10,
  RESULTS_LIMIT: 200,
  PER_PAGE_LABELS: 100,
} as const;
```

### Retry & Timeout Logic

⚠️ **Wait/Retry Delays**
- `packages/server/src/routes/actions.ts:264`: `const waitMs = 5000 * attempt;`
- `packages/app/src/notifications/notifications.ts:43`: `duration = 5000`
- `packages/app/src/data/templates-loader.ts:135`: `AUTH_POLL_MAX = 200`
- `packages/app/src/data/templates-loader.ts:136`: `AUTH_POLL_BASE_DELAY = 100`
- `packages/server/src/routes/misc.ts:335`: `ISSUE_AI_CACHE_TTL_MS || "300000"`

**Recommendation**: Extract to configuration
```typescript
export const TIMEOUTS = {
  NOTIFICATION_DEFAULT: 5000,
  AUTH_POLL_MAX_ATTEMPTS: 200,
  AUTH_POLL_BASE_DELAY: 100,
  RETRY_BACKOFF_BASE: 5000,
  ISSUE_AI_CACHE_TTL: 300000,
} as const;
```

---

## 🟢 ACCEPTABLE - Color Codes (Design System)

### Color Hardcoding
Found ~40+ instances of hex colors (`#0078d4`, `#28a745`, etc.) and rgba values across:
- `packages/app/src/modules/notification-system.ts`
- `packages/app/src/scripts/azd-validation.ts`
- `packages/app/src/scripts/search.ts`
- `packages/app/src/dashboard/overview.ts`

**Status**: ✅ Acceptable for now
- **Rationale**: Design system colors, consistent across UI
- **Future Enhancement**: Consider design tokens/CSS variables for theme support

---

## 🟢 ACCEPTABLE - Legacy Code Markers

### TODO/FIXME Comments

✅ **Documentation TODOs** (3 instances)
- `packages/server/src/routes/index.ts:15`: "Add remaining routes as they're migrated"
- `packages/app/src/app.ts:5`: "Extract remaining functionality into focused TS modules"
- `packages/app/src/main.ts:124`: "migrate and add remaining legacy scripts progressively"

**Status**: Acceptable - these document ongoing Express migration work
**Tracked in**: `docs/development/EXPRESS_MIGRATION_MATRIX.md`

---

## 🔴 ACTION REQUIRED - Hardcoded Demo Data (Resolved)

### Previous Issue: Embedded Demo Arrays
❌ **RESOLVED** - Removed in today's changes
- **Previous location**: `packages/app/leaderboards.html` (~130 lines of hardcoded arrays)
- **Resolution**: Extracted to `packages/app/public/data/leaderboards-demo.json`
- **Verification**: ✅ Confirmed via grep - no embedded demo data remains

---

## 🟢 NO ISSUES FOUND

### Database Connection Strings
✅ **No hardcoded credentials** found
- All database URIs use environment variables (`MONGODB_URI`, `COSMOS_ENDPOINT`)
- Fixed docker-compose.yml to respect .env overrides

### API Tokens
✅ **No embedded tokens** found
- All tokens loaded from environment variables
- GitHub tokens: `GITHUB_TOKEN`, `GH_WORKFLOW_TOKEN`
- OAuth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

### Magic Numbers in Business Logic
✅ **Limited magic numbers** - mostly UI/UX constants (timeouts, sizes)
- No unexplained business logic constants
- Retry logic uses clear multipliers (`5000 * attempt`)

---

## Summary & Priority Recommendations

### ✅ Ready for Deployment (No Blockers)
1. Demo data properly externalized to JSON
2. No credentials or secrets embedded
3. Environment variables used for all sensitive config
4. Magic numbers are primarily UI constants (acceptable)

### 🎯 High Priority (Next Sprint)
1. **Create constants file for API limits**
   - Extract `per_page`, `limit` values to shared constants
   - Makes pagination logic easier to tune

2. **Add demo data metadata**
   - Add `generatedAt` timestamp to `leaderboards-demo.json`
   - Update banner text to indicate "Demo data - not production metrics"

### 📊 Medium Priority (Future Enhancement)
1. **Design tokens/CSS variables**
   - Convert hardcoded colors to CSS custom properties
   - Enable theme support, easier design updates

2. **Configuration consolidation**
   - Create `packages/server/src/config/index.ts` for all constants
   - Easier to audit and update timeout/retry values

### 📝 Low Priority (Nice to Have)
1. **Quarterly demo data review**
   - Update demo statistics to reflect realistic trends
   - Keep model names current (new releases)

---

## Files Scanned
- ✅ packages/app/src/**/*.{ts,js} (175 files)
- ✅ packages/app/*.html (5 files)
- ✅ packages/app/public/**/*.html (5 files)
- ✅ packages/server/src/**/*.ts (42 files)
- ✅ packages/analyzer-core/**/*.ts (18 files)
- ✅ packages/app/public/data/*.json (1 file)

**Total Files Examined**: ~246 files  
**Issues Found**: 0 blocking, 8 recommendations  
**Security Issues**: 0

---

## Deployment Clearance

🟢 **CLEARED FOR DEPLOYMENT**

All hardcoded data issues have been resolved:
- ✅ Demo data externalized to JSON
- ✅ Database connections use environment variables
- ✅ No credentials embedded
- ✅ Magic numbers are UI constants (acceptable)
- ✅ Setup page padding removed (edge-to-edge)
- ✅ Toggle infrastructure complete
- ✅ Placeholder UI for empty sections

**Recommendations are for future improvements, not deployment blockers.**
