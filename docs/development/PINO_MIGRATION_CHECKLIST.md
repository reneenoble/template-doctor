# Pino Logging Migration Checklist

## ✅ Completed

### Core Infrastructure

- [x] Install dependencies (pino, pino-http, pino-pretty)
- [x] Create logger module (`packages/server/src/shared/logger.ts`)
- [x] Add HTTP logging middleware to Express (`index.ts`)

### Database Service (`packages/server/src/services/database.ts`)

- [x] Import logger (16 console.\* calls)
- [x] Replace all console.log/error with structured logging
- [x] Add context objects for structured data
- [x] Build verification passed

### Server Startup (`packages/server/src/index.ts`)

- [x] Import logger for startup messages (8 console.\* calls)
- [x] Replace database connection logging
- [x] Replace server startup logging
- [x] Replace configuration initialization logging

## 🔄 In Progress

### Analysis Storage Service (`packages/server/src/services/analysis-storage.ts`)

- [ ] Import logger (10 console.\* calls)
- [ ] Replace console.log/error with logger
- [ ] Add structured context (repoUrl, analysisId, etc.)

### AZD Validation Service (`packages/server/src/services/azd-validation.ts`)

- [ ] Import logger (5 console.\* calls)
- [ ] Replace artifact download logging
- [ ] Add error context for parsing failures

### AZD Test Storage (`packages/server/src/services/azd-test-storage.ts`)

- [ ] Import logger (3 console.\* calls)
- [ ] Replace test save/retrieve logging

### Configuration Storage (`packages/server/src/services/configuration-storage.ts`)

- [ ] Import logger
- [ ] Replace configuration CRUD logging

### Routes

- [ ] `packages/server/src/routes/analyze.ts` (2 console.\* calls)
- [ ] `packages/server/src/routes/auth.ts` (2 console.\* calls)
- [ ] `packages/server/src/routes/github.ts`
- [ ] `packages/server/src/routes/validation.ts`
- [ ] `packages/server/src/routes/analysis.ts`
- [ ] `packages/server/src/routes/results.ts`
- [ ] Other route files

### Middleware

- [ ] `packages/server/src/middleware/error-handler.ts`
- [ ] `packages/server/src/middleware/cors.ts` (if exists)

## 📋 Remaining Tasks

### Code Cleanup

- [ ] Remove all remaining console.\* calls (verify with grep)
- [ ] Update ESLint config to warn on console.\* usage
- [ ] Add linting rule: `"no-console": ["warn", { allow: [] }]`

### Testing

- [ ] Test local development logging (pretty format)
- [ ] Test production logging (JSON format)
- [ ] Verify HTTP request logging works
- [ ] Verify sensitive data redaction (tokens, passwords)
- [ ] Test log levels (debug, info, warn, error)

### Documentation

- [ ] Update AGENTS.md with logging guidelines
- [ ] Document logger usage patterns
- [ ] Add examples to LOGGING_STRATEGY.md
- [ ] Update environment variables docs (LOG_LEVEL)

## 🎯 Migration Patterns

### Before:

```typescript
console.log("[Database] Connected to MongoDB");
console.error("[Database] Connection failed:", error);
```

### After:

```typescript
import { createLogger } from "../shared/logger.js";
const logger = createLogger("database");

logger.info("Connected to MongoDB");
logger.error({ err: error }, "Connection failed");
```

### Structured Logging:

```typescript
// Rich context
logger.info(
    {
        repoUrl: "https://github.com/org/repo",
        analysisId: "123",
        duration: 1234,
    },
    "Analysis saved successfully",
);

// Error with stack trace
logger.error({ err: error, repoUrl }, "Analysis save failed");
```

## 📊 Progress Stats

- **Total console.\* calls in server**: 143
- **Migrated**: 24 (database.ts: 16, index.ts: 8)
- **Remaining**: 119
- **Completion**: ~17%

## 🚀 Next Steps

1. Migrate analysis-storage.ts (10 calls)
2. Migrate azd-validation.ts (5 calls)
3. Migrate route handlers
4. Add ESLint rule to prevent new console.\* usage
5. Test in Docker environment
6. Verify Azure deployment logs
