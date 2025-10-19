# Database-First Architecture Migration

**Status**: ✅ Core implementation complete  
**Date**: October 8, 2025  
**Migration Type**: Architectural shift from PR-based filesystem to database-first storage

## Executive Summary

Template Doctor is transitioning from a **PR-based filesystem workflow** to a **database-first architecture** using Cosmos DB with MongoDB API. This eliminates the need for creating PRs to save results and enables real-time querying, leaderboards, and dynamic dashboards.

### Key Changes

- ❌ **Removed**: PR workflow for saving results (`/api/v4/add-template-pr`)
- ✅ **Added**: Direct database storage on analysis completion
- ✅ **Added**: Real-time results API (`/api/v4/results/*`)
- ✅ **Added**: Leaderboard and statistics aggregations
- ✅ **Added**: 4 collections: `analysis`, `azdtests`, `rulesets`, `configuration`

## Architecture Overview

### Database Collections

#### 1. `analysis` - Template Analysis Results

Stores all template analysis scans.

**Schema:**

```typescript
{
  _id: ObjectId,
  repoUrl: string,          // GitHub repo URL
  owner: string,            // Extracted from repoUrl
  repo: string,             // Extracted from repoUrl
  ruleSet: string,          // e.g., "dod", "security"
  timestamp: number,        // Unix timestamp
  scanDate: Date,           // ISO date
  compliance: {
    percentage: number,     // 0-100
    passed: number,         // Count of passing checks
    issues: number,         // Count of issues
  },
  categories: { ... },      // Category-wise compliance
  issues: [...],            // Array of issue objects
  compliant: [...],         // Array of passing checks
  analysisResult: any,      // Full analyzer output
  scannedBy: string[],      // Scanner identifiers
  upstreamTemplate: string, // Optional upstream template
  archiveRequested: boolean,
  createdAt: Date,
  updatedAt: Date,
}
```

**Indexes:**

- `{ repoUrl: 1, timestamp: -1 }` - Latest scans per repo
- `{ owner: 1, repo: 1 }` - Repo lookup
- `{ scanDate: -1 }` - Recent scans
- `{ 'compliance.percentage': -1 }` - Leaderboard sorting

#### 2. `azdtests` - AZD Deployment Test Results

Stores Azure Developer CLI deployment test results.

**Schema:**

```typescript
{
  _id: ObjectId,
  repoUrl: string,
  owner: string,
  repo: string,
  testId: string,           // Unique test identifier
  timestamp: number,
  status: 'pending' | 'running' | 'success' | 'failed',
  startedAt: Date,
  completedAt: Date,
  duration: number,         // milliseconds
  result: {
    deploymentTime: number,
    resourcesCreated: number,
    errors: string[],
    warnings: string[],
    logs: string,
    azdUpSuccess: boolean,
    azdDownSuccess: boolean,
  },
  error: string,
  createdAt: Date,
}
```

**Indexes:**

- `{ repoUrl: 1, timestamp: -1 }` - Latest tests per repo
- `{ status: 1, startedAt: -1 }` - Active tests

#### 3. `rulesets` - Analysis Ruleset Configurations

Stores configurable rulesets for analysis.

**Schema:**

```typescript
{
  _id: ObjectId,
  name: string,             // Unique key: "dod", "security"
  displayName: string,
  description: string,
  rules: [{
    id: string,
    enabled: boolean,
    severity: 'error' | 'warning' | 'info',
    category: string,
    description: string,
  }],
  isDefault: boolean,
  createdBy: string,
  createdAt: Date,
  updatedAt: Date,
}
```

**Indexes:**

- `{ name: 1 }` - Unique ruleset lookup

#### 4. `configuration` - Application Configuration

Stores application config as key-value pairs.

**Schema:**

```typescript
{
  _id: ObjectId,
  key: string,              // Unique config key
  value: any,               // JSON value
  category: string,         // "features", "limits", "oauth"
  description: string,
  updatedBy: string,
  createdAt: Date,
  updatedAt: Date,
}
```

**Indexes:**

- `{ key: 1 }` - Unique config key
- `{ category: 1 }` - Category lookup

## API Endpoints

### Analysis Endpoints

#### POST `/api/v4/analyze-template`

**Purpose**: Analyze a template and save results to database  
**Auth**: Optional Bearer token  
**Body**:

```json
{
    "repoUrl": "https://github.com/owner/repo",
    "ruleSet": "dod",
    "azureDeveloperCliEnabled": true,
    "aiDeprecationCheckEnabled": true
}
```

**Response**: Analysis result (also saved to database)

**Database Operations**:

1. Run analyzer
2. Save to `analysis` collection
3. Return result to frontend

### Results Query Endpoints

#### GET `/api/v4/results/latest?limit=50`

**Purpose**: Get latest analysis results for tiles/dashboard  
**Response**:

```json
{
  "count": 50,
  "results": [{
    "id": "...",
    "repoUrl": "...",
    "owner": "...",
    "repo": "...",
    "compliance": { ... },
    "scanDate": "...",
  }]
}
```

#### GET `/api/v4/results/leaderboard?limit=100`

**Purpose**: Get top templates by compliance percentage  
**Algorithm**: Latest scan per repo, sorted by compliance  
**Response**:

```json
{
    "count": 100,
    "leaderboard": [
        {
            "repoUrl": "...",
            "owner": "...",
            "repo": "...",
            "compliance": 95.2,
            "lastScan": "...",
            "scanCount": 12
        }
    ]
}
```

#### GET `/api/v4/results/repo/:owner/:repo`

**Purpose**: Get all analyses for a specific repository  
**Response**:

```json
{
  "repoUrl": "...",
  "count": 5,
  "stats": {
    "totalScans": 5,
    "averageCompliance": 87.4,
    "bestCompliance": 92.1,
    "worstCompliance": 81.2,
    "lastScan": "...",
  },
  "analyses": [...]
}
```

#### GET `/api/v4/results/:id`

**Purpose**: Get full analysis result by ID  
**Response**: Complete Analysis document with all fields

#### GET `/api/v4/results/search?owner=...&repo=...&ruleSet=...&minCompliance=80`

**Purpose**: Search analyses by criteria  
**Query Params**:

- `owner`: Filter by GitHub owner
- `repo`: Filter by repo name
- `ruleSet`: Filter by ruleset
- `minCompliance`: Minimum compliance percentage
- `limit`: Result limit (default: 50, max: 200)

## Implementation Files

### Backend Services

#### `packages/server/src/services/database.ts`

**Purpose**: MongoDB client with Managed Identity authentication  
**Key Features**:

- MI token acquisition and refresh (every 1 hour)
- Connection pooling (maxPoolSize: 10, minPoolSize: 2)
- Index creation on startup
- Health check endpoint
- Graceful shutdown handlers

**Usage**:

```typescript
import { database } from "./services/database.js";

await database.connect();
const analyses = await database.analysis.find().toArray();
```

#### `packages/server/src/services/analysis-storage.ts`

**Purpose**: High-level API for analysis operations  
**Methods**:

- `saveAnalysis(data)` - Save analysis result
- `getLatestAnalyses(limit)` - Get recent scans
- `getAnalysesByRepo(repoUrl)` - Get repo history
- `getAnalysisById(id)` - Get single result
- `getLeaderboard(limit)` - Top templates
- `getTemplateStats(repoUrl)` - Aggregated stats

**Usage**:

```typescript
import { analysisStorage } from './services/analysis-storage.js';

const id = await analysisStorage.saveAnalysis({
  repoUrl: '...',
  ruleSet: 'dod',
  compliance: { ... },
  analysisResult: { ... },
});
```

### Backend Routes

#### `packages/server/src/routes/analyze.ts`

**Modified**: Now saves to database after analysis  
**Flow**:

1. Receive analysis request
2. Fork-first strategy for repo access
3. List and fetch file contents
4. Run analyzer
5. **Save to database** ← NEW
6. Return result

#### `packages/server/src/routes/results.ts`

**New**: Results query API  
**Endpoints**: `/latest`, `/leaderboard`, `/repo/:owner/:repo`, `/:id`, `/search`

#### `packages/server/src/index.ts`

**Modified**:

- Initialize database on startup
- Register results router
- Update health check with DB status

## Infrastructure

### Bicep Template

**File**: `infra/database.bicep`  
**Resources**:

- Cosmos DB account (MongoDB API, serverless)
- Database: `template-doctor`
- Built-in Data Contributor role assignment
- Diagnostic settings for monitoring
- Continuous backup (7-day point-in-time restore)

**Deployment**:

```bash
az deployment group create \
  --resource-group rg-template-doctor \
  --template-file infra/database.bicep \
  --parameters principalId=<container-app-mi-id>
```

### Environment Variables

**Required**:

- `COSMOS_ENDPOINT` - Cosmos DB endpoint (e.g., `https://cosmos-xyz.mongo.cosmos.azure.com:10255`)
- `COSMOS_DATABASE_NAME` - Database name (default: `template-doctor`)

**Optional**:

- `GITHUB_TOKEN` - GitHub PAT for API access
- `GH_WORKFLOW_TOKEN` - Workflow token
- `GITHUB_TOKEN_ANALYZER` - Analyzer token

## Migration Plan

### Phase 1: Core Implementation ✅ COMPLETE

- [x] Design new database schema
- [x] Implement database service with MI auth
- [x] Implement analysis storage service
- [x] Update analyze endpoint to save to database
- [x] Create results API routes
- [x] Initialize database on server startup
- [x] Update health check endpoint

### Phase 2: Frontend Integration 🔄 IN PROGRESS

- [ ] Update tiles to fetch from `/api/v4/results/latest`
- [ ] Update leaderboard to fetch from `/api/v4/results/leaderboard`
- [ ] Update report viewer to fetch from `/api/v4/results/:id`
- [ ] Add search functionality using `/api/v4/results/search`
- [ ] Remove references to filesystem results

### Phase 3: AZD Test Integration 📋 PLANNED

- [ ] Create AZD test storage service
- [ ] Update validation endpoints to save to `azdtests` collection
- [ ] Create AZD test query endpoints
- [ ] Update frontend to display AZD test results

### Phase 4: Infrastructure Deployment 📋 PLANNED

- [ ] Deploy Bicep template to Azure
- [ ] Configure Managed Identity for Container Apps
- [ ] Set environment variables in Container Apps
- [ ] Test database connectivity from production
- [ ] Monitor RU consumption and performance

### Phase 5: Data Migration 📋 PLANNED

- [ ] Create migration script to backfill 56 existing results
- [ ] Run migration script against production database
- [ ] Validate data integrity
- [ ] Archive old filesystem results

### Phase 6: Cleanup 📋 PLANNED

- [ ] Remove PR workflow endpoints (`add-template-pr`, `submit-analysis-dispatch`)
- [ ] Remove filesystem result writing code
- [ ] Update documentation
- [ ] Remove old GitHub workflow files

## Rollback Plan

If issues arise during deployment:

1. **Disable database writes**: Set `COSMOS_ENDPOINT` to empty string
2. **Server continues to work**: Database connection is optional
3. **Health check shows DB status**: Monitor `/api/health` endpoint
4. **No data loss**: All data in Cosmos DB is preserved

## Testing Strategy

### Unit Tests

- Database service connection and token refresh
- Analysis storage service methods
- Results API endpoint responses

### Integration Tests

- End-to-end analysis flow (analyze → save → query)
- Leaderboard aggregation accuracy
- Search query filtering

### Performance Tests

- RU consumption per operation
- Query response times
- Connection pool behavior under load

### Manual Tests

- MI authentication from Container Apps
- Database failover behavior
- Token refresh during long-running operations

## Cost Estimation

**Cosmos DB Serverless**:

- Analysis writes: ~0.05 RU/write × 1000 scans/month = 50 RU
- Query reads: ~5 RU/query × 10,000 queries/month = 50,000 RU
- Index overhead: ~10% = 5,000 RU
- **Total**: ~55,000 RU/month × $0.35/million RU = **~$0.02/month**

**Storage**:

- Average analysis size: ~50 KB
- 1000 analyses: 50 MB × $0.25/GB = **~$0.01/month**

**Estimated Total**: **~$2/month** (with buffer for growth)

## Security Considerations

### Authentication

- ✅ Managed Identity only (no connection strings)
- ✅ Token-based MongoDB auth
- ✅ Automatic token refresh (1 hour)
- ✅ RBAC role assignment (Data Contributor)

### Network Security

- ✅ SSL/TLS required (port 10255)
- ✅ Private endpoint support (future enhancement)
- ❌ IP firewall (not required for MI auth)

### Data Protection

- ✅ Encryption at rest (Azure-managed keys)
- ✅ Encryption in transit (TLS 1.2+)
- ✅ Continuous backup (7-day PITR)
- ✅ Geo-redundancy (optional)

## Monitoring and Alerts

### Metrics to Track

- **Database Health**: Connection status, latency
- **RU Consumption**: Per-operation and total
- **Query Performance**: P95 latency for common queries
- **Error Rate**: Failed writes, timeouts, auth failures

### Recommended Alerts

- Database connection failures > 5 in 5 minutes
- RU consumption > 1M/day (cost control)
- Query latency P95 > 1000ms
- Failed token refresh attempts

## Next Steps

1. **Deploy Infrastructure**

    ```bash
    cd infra
    az deployment group create --resource-group rg-template-doctor --template-file database.bicep
    ```

2. **Configure Environment Variables**

    ```bash
    az containerapp update \
      --name ca-template-doctor \
      --resource-group rg-template-doctor \
      --set-env-vars "COSMOS_ENDPOINT=<endpoint>" "COSMOS_DATABASE_NAME=template-doctor"
    ```

3. **Update Frontend**
    - Replace filesystem data loading with API calls
    - Test tiles, leaderboard, report viewer

4. **Run Migration Script**
    - Backfill 56 existing results
    - Validate data integrity

5. **Remove Legacy Code**
    - Delete PR workflow endpoints
    - Clean up filesystem writes

## References

- [Cosmos DB MongoDB API Docs](https://learn.microsoft.com/azure/cosmos-db/mongodb/introduction)
- [Managed Identity with Cosmos DB](https://learn.microsoft.com/azure/cosmos-db/managed-identity-based-authentication)
- [MongoDB Node.js Driver](https://mongodb.github.io/node-mongodb-native/)
- [Bicep Cosmos DB Examples](https://learn.microsoft.com/azure/templates/microsoft.documentdb/databaseaccounts)
