# Logging Strategy for Template Doctor

## Current State

- **Server**: 143 console.\* calls (console.log, console.error, console.warn)
- **Frontend**: 433 console.\* calls
- **No structured logging**: Currently using plain console statements
- **No log levels**: Difficult to filter logs by severity
- **No log aggregation**: Logs are ephemeral and hard to search

---

## Server-Side: Pino Migration Plan

### Why Pino?

✅ **Fastest Node.js logger** (benchmarked)  
✅ **Structured JSON logging** (easy to parse/aggregate)  
✅ **Low overhead** (async by default)  
✅ **Azure-friendly** (integrates with Application Insights)  
✅ **Express middleware** (pino-http for request logging)  
✅ **TypeScript support** (excellent type definitions)

### Implementation Steps

#### 1. Install Dependencies

```bash
cd packages/server
npm install pino pino-http pino-pretty
npm install --save-dev @types/pino-http
```

#### 2. Create Logger Module (`packages/server/src/shared/logger.ts`)

```typescript
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined, // Production: JSON logs
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  base: {
    service: 'template-doctor-server',
    env: process.env.NODE_ENV || 'development',
  },
});

// Child loggers for different modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};

// HTTP request logger middleware
import pinoHttp from 'pino-http';

export const httpLogger = pinoHttp({
  logger,
  autoLogging: true,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) return 'warn';
    if (res.statusCode >= 500 || err) return 'error';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} - ${res.statusCode} - ${err.message}`;
  },
  // Redact sensitive data
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-github-token"]'],
    remove: true,
  },
});
```

#### 3. Add HTTP Logging Middleware (`packages/server/src/index.ts`)

```typescript
import { httpLogger } from './shared/logger.js';

// Add after CORS, before routes
app.use(httpLogger);
```

#### 4. Migration Examples

**Before:**

```typescript
console.log('[Database] Connected to MongoDB');
console.error('[Database] Connection failed:', error);
```

**After:**

```typescript
import { createLogger } from '../shared/logger.js';
const logger = createLogger('database');

logger.info('Connected to MongoDB');
logger.error({ err: error }, 'Connection failed');
```

**Structured Logging:**

```typescript
// Rich context
logger.info(
  {
    repoUrl: 'https://github.com/org/repo',
    analysisId: '123',
    duration: 1234,
  },
  'Analysis saved successfully',
);

// Error with stack trace
logger.error({ err: error, repoUrl }, 'Analysis save failed');

// Debug with detailed data
logger.debug({ config, request }, 'Processing request');
```

#### 5. Migration Checklist

- [ ] Install pino dependencies
- [ ] Create logger module
- [ ] Add HTTP logging middleware
- [ ] Migrate database.ts (16 console calls)
- [ ] Migrate analysis-storage.ts (17 console calls)
- [ ] Migrate azd-test-storage.ts (2 console calls)
- [ ] Migrate azd-validation.ts (5 console calls)
- [ ] Migrate auth.ts (2 console calls)
- [ ] Migrate index.ts (13 console calls)
- [ ] Migrate routes/\*.ts (remaining calls)
- [ ] Remove all console.\* calls
- [ ] Add to .gitignore: `*.log`

---

## Frontend: Browser Logging Options

### Option 1: **pino-browser** (Recommended)

**Pros:**

- ✅ Same API as server-side Pino (consistency!)
- ✅ Structured logging
- ✅ Level filtering
- ✅ Send logs to backend (via custom transport)
- ✅ TypeScript support

**Cons:**

- ⚠️ Adds ~10KB to bundle
- ⚠️ May be overkill for simple apps

**Installation:**

```bash
cd packages/app
npm install browser-bunyan pino-browser
```

**Implementation (`packages/app/src/shared/logger.ts`):**

```typescript
import pino from 'pino-browser';

const isDev = import.meta.env.DEV;

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  browser: {
    asObject: true, // Get object instead of serialized strings
    transmit: {
      level: 'error', // Send errors to backend
      send: function (level, logEvent) {
        // Send critical logs to backend
        if (level.value >= 50) {
          // error and fatal
          fetch('/api/v4/client-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logEvent),
          }).catch(() => {
            // Silently fail
          });
        }
      },
    },
  },
});

export const createLogger = (module: string) => {
  return logger.child({ module });
};
```

### Option 2: **console-feed** (Development Tool)

**Pros:**

- ✅ Beautiful console UI
- ✅ Filter/search logs
- ✅ Inspect objects
- ✅ Great for debugging

**Cons:**

- ⚠️ Dev-only (don't ship to production)
- ⚠️ Doesn't replace logging, just enhances it

### Option 3: **Lightweight Custom Logger** (Minimal)

**Pros:**

- ✅ Zero dependencies
- ✅ Tiny bundle impact
- ✅ Full control

**Implementation (`packages/app/src/shared/logger.ts`):**

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private module: string;
  private isDev: boolean;

  constructor(module: string) {
    this.module = module;
    this.isDev = import.meta.env.DEV;
  }

  private log(level: LogLevel, message: string, data?: any) {
    if (!this.isDev && level === 'debug') return;

    const prefix = `[${this.module}]`;
    const timestamp = new Date().toISOString();

    switch (level) {
      case 'debug':
        console.debug(timestamp, prefix, message, data);
        break;
      case 'info':
        console.info(timestamp, prefix, message, data);
        break;
      case 'warn':
        console.warn(timestamp, prefix, message, data);
        break;
      case 'error':
        console.error(timestamp, prefix, message, data);
        // Optionally send errors to backend
        if (!this.isDev) {
          this.sendToBackend(level, message, data);
        }
        break;
    }
  }

  private sendToBackend(level: string, message: string, data: any) {
    fetch('/api/v4/client-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        module: this.module,
        message,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {}); // Silent fail
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }
}

export const createLogger = (module: string) => new Logger(module);
```

**Usage:**

```typescript
import { createLogger } from '../shared/logger';
const logger = createLogger('search');

logger.info('Search results loaded', { count: results.length });
logger.error('API call failed', { error, url });
```

---

## Recommended Approach

### Phase 1: Server-Side (High Priority)

1. ✅ Install Pino + pino-http + pino-pretty
2. ✅ Create logger module
3. ✅ Add HTTP request logging middleware
4. ✅ Migrate critical services first (database, storage, auth)
5. ✅ Migrate remaining routes
6. ✅ Remove all console.\* calls

**Estimated effort**: 2-3 hours

### Phase 2: Frontend (Lower Priority)

**Choose one:**

**Option A: Lightweight Custom Logger** (Recommended for now)

- Pros: Fast to implement, no bundle bloat
- Cons: Less features
- Effort: 1 hour

**Option B: pino-browser** (Future enhancement)

- Pros: Full-featured, consistent with backend
- Cons: Larger bundle, more complexity
- Effort: 2-3 hours

### Phase 3: Observability (Future)

- [ ] Integrate with Azure Application Insights
- [ ] Set up log aggregation
- [ ] Create log dashboards
- [ ] Add distributed tracing
- [ ] Set up alerts

---

## Environment Variables

```env
# Server
LOG_LEVEL=debug           # dev: debug, prod: info
NODE_ENV=development      # production in prod

# Frontend (Vite)
VITE_LOG_LEVEL=debug      # Optional: control frontend log level
```

---

## Benefits After Migration

### Server:

- ✅ **Structured JSON logs** → Easy to parse and aggregate
- ✅ **Performance** → Pino is 5-10x faster than console.log
- ✅ **Azure Integration** → Works seamlessly with App Insights
- ✅ **Request tracing** → Automatic correlation IDs
- ✅ **Redaction** → Sensitive data automatically removed

### Frontend:

- ✅ **Level filtering** → Show only relevant logs
- ✅ **Backend reporting** → Critical errors sent to server
- ✅ **Production-safe** → Debug logs stripped in prod builds
- ✅ **Consistent** → Same logging patterns across codebase

---

## Next Steps

1. **Decision**: Choose frontend logging approach (recommend: Lightweight Custom)
2. **Create PR**: Implement server-side Pino migration
3. **Migrate services**: Start with database, storage services
4. **Add middleware**: HTTP request logging
5. **Clean up**: Remove all console.\* calls
6. **Document**: Update AGENTS.md with logging guidelines
