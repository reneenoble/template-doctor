# Leaderboards Implementation Guide
## Leaderboards Database Query Analysis
## Overview



The leaderboards feature provides analytics and insights about template quality, community activity, and technology trends. This document describes the phased implementation approach.This document proposes MongoDB aggregation queries for each leaderboard section based on Template Doctor's V2 database schema, identifies data model gaps, and provides phased implementation recommendations.



## Implementation Status## Current Database Schema (V2)



### ✅ Phase 1: IMPLEMENTED (Current)### `repos` Collection (Latest Analysis per Repo)

```javascript

**Status**: Deployed and functional  {

**Schema Changes**: None required    _id: ObjectId,

**Endpoints**: 3 sections working  owner: "Azure-Samples",

  repo: "todo-nodejs-mongo",

#### Working Sections  scanMeta: {

    analyzedBy: "user@example.com",

1. **Templates with Most Issues** (`/api/v4/leaderboards/most-issues`)    analyzedAt: ISODate,

   - Shows templates with highest issue counts    totalScans: 3

   - Includes severity classification (high/medium/low)  },

   - Data source: `repos.analysisResult.compliance.categories`  analysisResult: {

    score: 85,

2. **Most Prevalent Issues** (`/api/v4/leaderboards/prevalent-issues`)    compliance: {

   - Aggregates common issue categories across all templates      score: 85,

   - Shows frequency of each category      categories: [

   - Data source: `repos.analysisResult.compliance.categories`        {

          category: "Security",

3. **Most Active Templates** (`/api/v4/leaderboards/active-templates`)          checks: [...]

   - Ranks templates by scan activity        }

   - Uses `scanMeta.totalScans` counter      ]

   - Optional: Shows stars when metadata available    }

  }

4. **Global Stats** (`/api/v4/leaderboards/global/stats`)}

   - Total templates analyzed```

   - Total analysis scans performed

   - Coming soon: Templates with MCP, Total installs### `analysis` Collection (Historical Scans, max 10 per repo)

```javascript

### ⚠️ Phase 2: PLANNED (Next Sprint){

  _id: ObjectId,

**Status**: Not started    owner: "Azure-Samples",

**Schema Changes**: Required    repo: "todo-nodejs-mongo",

**Endpoints**: 5 additional sections  analyzedBy: "user@example.com",

  analyzedAt: ISODate,

#### Schema Additions Required  analysisResult: {

    score: 85,

Add to both `repos` and `analysis` collections:    compliance: { ... }

  }

```javascript}

{```

  // Existing fields...CREATE TABLE templates (

      id SERIAL PRIMARY KEY,

  collection: "aigallery",  // Filter by collection    name VARCHAR(255),

      owner VARCHAR(100),

  metadata: {    repository_url VARCHAR(500),

    // From GitHub API (background sync job)    primary_language VARCHAR(50),

    stars: 0,    stars INTEGER,

    forks: 0,    forks INTEGER,

    lastCommit: ISODate("2025-10-15T00:00:00Z"),    last_updated TIMESTAMP,

        total_downloads INTEGER

    // From GitHub language stats API);

    language: "Python"

  }-- User Analytics

}CREATE TABLE user_analytics (

```    id SERIAL PRIMARY KEY,

    username VARCHAR(100),

#### Sections to Implement    total_analyses INTEGER,

    collections_analyzed INTEGER,

1. **Top Analyzers (Overall)** (`/api/v4/leaderboards/top-analyzers-overall`)    templates_built INTEGER,

   - Needs: `collection` field    success_rate DECIMAL(5,2),

   - Ranks users by total analyses across all collections    last_activity TIMESTAMP

   - Shows number of unique collections analyzed);

```

2. **Top Analyzers (aigallery)** (`/api/v4/leaderboards/top-analyzers-aigallery`)

   - Needs: `collection` field### 2. GitHub API Integration

   - Ranks users by analyses in aigallery collection

   - Shows average template score**Purpose**: Fetch real repository metadata (stars, forks, activity)



3. **Most Successful Builders** (`/api/v4/leaderboards/successful-builders`)**Implementation**:

   - Needs: `metadata.stars`, `metadata.forks`

   - Ranks template authors by success metrics```typescript

   - Uses stars as download proxy// packages/api/src/github-metrics/

class GitHubMetricsService {

4. **Healthiest Templates (Python)** (`/api/v4/leaderboards/healthiest-python`)    async getRepositoryMetrics(owner: string, repo: string) {

   - Needs: `metadata.language`        // Fetch stars, forks, recent commits, contributors

   - Filters by language="Python"        // Cache results to avoid rate limits

   - Ranks by compliance score    }



5. **Healthiest Templates (JavaScript)** (`/api/v4/leaderboards/healthiest-javascript`)    async getTemplateActivity(templates: string[]) {

   - Needs: `metadata.language`        // Batch fetch activity metrics for multiple templates

   - Filters by language="JavaScript"        // Return activity scores based on commits, PRs, issues

   - Ranks by compliance score    }

}

#### Implementation Steps```



1. **Database Migration**### 3. AZD Deployment Analytics

   - Add `collection` field to existing documents (default: "aigallery")

   - Create `metadata` object structure**Purpose**: Track successful deployments by service type

   - Update database schema documentation

**Data Collection Points**:

2. **GitHub Metadata Service**

   - Create background job to fetch GitHub stats- Azure Developer CLI telemetry (if available)

   - Sync stars, forks, language stats- Analysis of azd configuration files success rates

   - Rate limit handling (5000 requests/hour)- Deployment target detection (ACA, AKS, Azure Functions)

   - Cache results for 24 hours

**Implementation**:

3. **Backfill Existing Data**

   - Script to populate metadata for existing templates```typescript

   - Bulk GitHub API calls with batching// packages/analyzer-core/src/azd-analyzer/

   - Progress tracking and error handlingclass AzdDeploymentAnalyzer {

    analyzeDeploymentConfig(templatePath: string) {

4. **API Implementation**        // Parse azure.yaml, infra/ directory

   - Add Phase 2 query logic to leaderboards routes        // Determine deployment targets

   - Update `available: false` to `true` for these sections        // Assess configuration completeness

   - Test with real data    }



5. **Frontend Updates**    calculateDeploymentScore(template: any) {

   - Remove "Coming Soon" placeholders        // Score based on config completeness, best practices

   - Wire up to Phase 2 endpoints        // Return success probability

   - Add loading states    }

}

**Estimated Effort**: 1-2 weeks (1 developer)```



### ❌ Phase 3: FUTURE### 4. AI Model Success Tracking



**Status**: Not planned  **Purpose**: Track which AI models perform best for different languages/scenarios

**Schema Changes**: AI/tech detection  

**Endpoints**: 3 advanced sections**Implementation**:



#### Schema Additions Required```typescript

// Track model usage and success rates

```javascriptinterface ModelUsage {

{    model: string;

  metadata: {    language: string;

    // ... Phase 2 fields ...    templateType: string;

        analysisSuccess: boolean;

    // Detected from README/code parsing    issuesFound: number;

    aiModel: "GPT-4o",    healthScore: number;

    aiProvider: "Azure OpenAI",    timestamp: Date;

    }

    // Detected from dependencies```

    technologies: [

      "Playwright",## API Endpoints to Implement

      "TypeScript",

      "Semantic Kernel"### Backend Functions (Azure Functions)

    ]

  }```typescript

}// packages/api/src/leaderboards/

```

// GET /api/v4/leaderboards/top-analyzers

#### Sections Plannedexport async function getTopAnalyzers(

    req: HttpRequest,

1. **Most Successful Models** - AI models ranked by template success    context: InvocationContext,

2. **Model/Language Success** - Heatmap of model+language combinations) {

3. **MSFT Tech Usage** - Microsoft technology adoption percentages    // Query analysis_results, group by analyzer_user

    // Return top users by analysis count

**Requirements**:}

- README parsing for AI model detection

- Dependency analysis for technology stack// GET /api/v4/leaderboards/template-issues

- Pattern matching for model referencesexport async function getTemplateIssues(

    req: HttpRequest,

**Estimated Effort**: 3-4 weeks (requires ML/NLP)    context: InvocationContext,

) {

### ❌ Phase 4: OPTIONAL    // Query issues, group by template

    // Return templates with highest issue counts

**Status**: Not planned  }

**Schema Changes**: Deployment tracking  

**Endpoints**: 1 telemetry section// GET /api/v4/leaderboards/prevalent-issues

export async function getPrevalentIssues(

#### Schema Additions Required    req: HttpRequest,

    context: InvocationContext,

```javascript) {

{    // Query issues, group by category

  deployments: {    // Return aggregated issue counts for pie chart

    azd: {}

      service: "ACA",  // ACA, AKS, AF

      count: 0,// GET /api/v4/leaderboards/model-success

      successRate: 0,export async function getModelSuccess(

      lastDeployed: null    req: HttpRequest,

    }    context: InvocationContext,

  }) {

}    // Query analysis_results, group by model_used

```    // Calculate success rates by model and language

}

#### Section Planned

// GET /api/v4/leaderboards/azd-deployments

1. **Successful AZD Deployments** - Templates ranked by deployment activityexport async function getAzdDeployments(

    req: HttpRequest,

**Requirements**:    context: InvocationContext,

- External telemetry integration) {

- User opt-in consent    // Query successful deployments by service type

- Privacy/compliance review    // Return deployment counts and success rates

- azd CLI integration}

```

**Estimated Effort**: 4-6 weeks (requires legal/compliance)

### Frontend Data Loading

---

```typescript

## API Reference// packages/app/src/scripts/leaderboards-data.ts

class LeaderboardsDataLoader {

### Endpoint Pattern    async loadAllLeaderboards(): Promise<LeaderboardsData> {

        const [

```            topAnalyzers,

GET /api/v4/leaderboards/:section            templateIssues,

```            prevalentIssues,

            modelSuccess,

### Query Parameters            azdDeployments,

        ] = await Promise.all([

- `collection` (string, optional): Filter by collection (e.g., "aigallery")            this.api.get("/leaderboards/top-analyzers"),

- `limit` (number, optional): Max results to return (default varies by section)            this.api.get("/leaderboards/template-issues"),

            this.api.get("/leaderboards/prevalent-issues"),

### Response Format            this.api.get("/leaderboards/model-success"),

            this.api.get("/leaderboards/azd-deployments"),

```typescript        ]);

{

  section: string;              // Section identifier        return {

  data: Array<any>;             // Leaderboard results            topAnalyzers,

  available: boolean;           // True if implemented            templateIssues,

  generatedAt: string;          // ISO timestamp            prevalentIssues,

  total?: number;               // Total count (if applicable)            modelSuccess,

}            azdDeployments,

```        };

    }

### Phase 1 Endpoints (✅ Available)}

```

```bash

# Templates with most issues## Data Processing Pipeline

GET /api/v4/leaderboards/most-issues?limit=10

### 1. Real-time Updates

# Most prevalent issue categories

GET /api/v4/leaderboards/prevalent-issues?limit=8```typescript

// When analysis completes, update leaderboards

# Most active templates (by scan count)class LeaderboardUpdater {

GET /api/v4/leaderboards/active-templates?limit=10    async updateAfterAnalysis(analysisResult: AnalysisResult) {

        // Update user statistics

# Global statistics        // Update template issue counts

GET /api/v4/leaderboards/global/stats        // Update model success rates

```        // Invalidate leaderboard cache

    }

### Phase 2 Endpoints (⏳ Coming Soon)}

```

```bash

# Top analyzers overall### 2. Batch Processing

GET /api/v4/leaderboards/top-analyzers-overall?limit=5

```typescript

# Top analyzers in aigallery// Nightly aggregation job

GET /api/v4/leaderboards/top-analyzers-aigallery?limit=5class LeaderboardAggregator {

    async runDailyAggregation() {

# Most successful template builders        // Recalculate all leaderboard metrics

GET /api/v4/leaderboards/successful-builders?limit=5        // Update GitHub repository metrics

        // Generate trending analysis

# Healthiest Python templates        // Cache results for fast loading

GET /api/v4/leaderboards/healthiest-python?limit=5    }

}

# Healthiest JavaScript templates```

GET /api/v4/leaderboards/healthiest-javascript?limit=5

```### 3. Caching Strategy



---```typescript

// Cache leaderboard data for performance

## Frontend Integrationinterface CacheConfig {

    topAnalyzers: { ttl: "1 hour" };

### Phase 1: Current Implementation    templateIssues: { ttl: "30 minutes" };

    prevalentIssues: { ttl: "2 hours" };

The frontend `leaderboards.html` currently uses dummy data. To integrate Phase 1 endpoints:    modelSuccess: { ttl: "4 hours" };

}

1. **Update data loading** in `packages/app/leaderboards.html`:```



```javascript## Migration Strategy

// Replace dummy data with API calls

async function loadLeaderboardData(section) {### Phase 1: Database Setup

  try {

    const response = await fetch(`/api/v4/leaderboards/${section}`);1. Choose database (Azure SQL, Cosmos DB, or PostgreSQL)

    const data = await response.json();2. Create schema/collections for analysis results

    3. Implement data migration from existing JS result files

    if (!data.available) {4. Set up data access layer

      showComingSoon(section);

      return;### Phase 2: API Implementation

    }

    1. Create leaderboard API endpoints

    return data.data;2. Implement data aggregation queries

  } catch (error) {3. Add caching layer

    console.error(`Failed to load ${section}:`, error);4. Test with existing result data

    showError(section);

  }### Phase 3: Frontend Integration

}

```1. Replace mock data with API calls

2. Add loading states and error handling

2. **Handle unavailable sections**:3. Implement real-time updates

4. Add data refresh mechanisms

```javascript

function showComingSoon(section) {### Phase 4: Advanced Features

  const container = document.querySelector(`[data-section="${section}"]`);

  container.innerHTML = `1. Historical trending analysis

    <div class="coming-soon">2. Comparative analytics

      <h3>Coming Soon</h3>3. User-specific leaderboards

      <p>This feature requires Phase 2 implementation.</p>4. Export/reporting features

      <p>See <a href="/docs/development/LEADERBOARDS_IMPLEMENTATION.md">implementation plan</a>.</p>

    </div>## Performance Considerations

  `;

}### Database Optimization

```

- Index on frequently queried columns (user, template, timestamp)

3. **Update global stats**:- Partitioning for large datasets

- Read replicas for leaderboard queries

```javascript

async function loadGlobalStats() {### Caching

  const response = await fetch('/api/v4/leaderboards/global/stats');

  const stats = await response.json();- Redis cache for aggregated results

  - CDN caching for static leaderboard data

  // Update only available metrics- Browser caching with appropriate TTLs

  if (stats.available.totalTemplatesAnalyzed) {

    document.getElementById('total-templates').textContent = stats.totalTemplatesAnalyzed;### API Rate Limits

  }

  if (stats.available.totalAnalyses) {- GitHub API rate limiting considerations

    document.getElementById('total-analyses').textContent = stats.totalAnalyses;- Batch processing for external API calls

  }- Graceful degradation when APIs unavailable

  // Show placeholders for unavailable metrics

  document.getElementById('templates-mcp').textContent = 'Coming in Phase 2';## Security & Privacy

  document.getElementById('total-installs').textContent = 'Coming in Phase 2';

}### Data Privacy

```

- Anonymize user data in public leaderboards

### Phase 2: Planned Updates- Implement opt-out mechanisms

- GDPR compliance for EU users

Once Phase 2 is deployed:

### Access Control

1. Remove "Coming Soon" placeholders for Phase 2 sections

2. Update `loadLeaderboardData()` to handle all sections- Admin-only access to detailed analytics

3. Add loading states and error handling- Public vs private leaderboard sections

4. Implement auto-refresh (every 5 minutes)- Rate limiting on leaderboard APIs



---## Monitoring & Analytics



## Testing### Metrics to Track



### Local Testing (Phase 1)- Leaderboard page views and engagement

- Data freshness and update frequency

```bash- API performance and error rates

# Start MongoDB and server- Cache hit rates and effectiveness

docker-compose --profile combined up

### Alerts

# Test endpoints

curl http://localhost:3001/api/v4/leaderboards/most-issues- Data pipeline failures

curl http://localhost:3001/api/v4/leaderboards/prevalent-issues- Stale data detection

curl http://localhost:3001/api/v4/leaderboards/active-templates- API rate limit approaching

curl http://localhost:3001/api/v4/leaderboards/global/stats- Unusual activity patterns

```

## Testing Strategy

### Phase 2 Testing

### Unit Tests

After schema migration:

- Data aggregation logic

```bash- Chart rendering functions

# Verify metadata populated- API endpoint responses

mongosh template_doctor --eval "db.repos.findOne({}, {metadata: 1})"

### Integration Tests

# Test new endpoints

curl http://localhost:3001/api/v4/leaderboards/top-analyzers-overall- End-to-end leaderboard loading

curl http://localhost:3001/api/v4/leaderboards/healthiest-python- Data consistency checks

```- Performance benchmarks



---### Load Testing



## Deployment Checklist- High-traffic leaderboard access

- Database query performance

### Phase 1 Deployment (✅ Complete)- Cache effectiveness under load



- [x] Create leaderboards routes (`packages/server/src/routes/leaderboards.ts`)## Documentation

- [x] Register routes in Express (`packages/server/src/index.ts`)

- [x] Implement 3 working queries### Developer Documentation

- [x] Build and test server

- [ ] Update frontend to call APIs (next task)- API endpoint documentation

- [ ] Deploy to Azure- Database schema documentation

- Data pipeline architecture

### Phase 2 Deployment (⏳ Planned)- Deployment procedures



- [ ] Design database migration script### User Documentation

- [ ] Create GitHub metadata sync service

- [ ] Test migration on local MongoDB- Leaderboard metrics explanation

- [ ] Backfill existing templates- How rankings are calculated

- [ ] Implement Phase 2 queries- Data update frequency

- [ ] Update frontend- Privacy and data usage policies

- [ ] Deploy to Cosmos DB

- [ ] Monitor performance---



---## Next Steps



## Performance Considerations1. **Database Design**: Finalize schema based on existing result file structure

2. **API Development**: Start with most critical endpoints (top analyzers, prevalent issues)

### Phase 13. **Data Migration**: Create scripts to import existing JS result files

4. **Frontend Integration**: Update leaderboards.html to consume real APIs

- **Query Optimization**: All queries use indexes on `repos` collection5. **Testing**: Implement comprehensive test suite

- **Caching**: Frontend should cache results for 5 minutes6. **Documentation**: Create detailed API and deployment documentation

- **Limits**: Default limits prevent excessive data transfer

This implementation will transform the current beautiful mock dashboard into a fully functional analytics platform that provides real insights into Template Doctor usage and template quality across the Azure ecosystem.

### Phase 2

- **GitHub API Rate Limits**: 5000 requests/hour per token
- **Background Jobs**: Metadata sync runs nightly
- **Indexes**: Add indexes on `collection`, `metadata.language`, `metadata.stars`

### Monitoring

```bash
# Check query performance
mongosh template_doctor --eval "db.repos.aggregate([...]).explain('executionStats')"

# Monitor leaderboard API response times
curl -w "@curl-format.txt" http://localhost:3001/api/v4/leaderboards/most-issues
```

---

## Related Documentation

- [LEADERBOARDS_QUERIES.md](./LEADERBOARDS_QUERIES.md) - Complete MongoDB queries and schema analysis
- [DATABASE_SCHEMA_V2.md](./DATABASE_SCHEMA_V2.md) - Current database schema
- [DATA_LAYER.md](./DATA_LAYER.md) - Data layer architecture

---

## Questions & Decisions

### Q: Should we implement Phase 2 before initial deployment?

**Decision**: No, deploy Phase 1 first.

**Rationale**:
- Phase 1 provides immediate value (3 functional sections)
- Schema migration can be done in next sprint
- Allows time to gather user feedback on priorities

### Q: How to handle empty leaderboards on new deployments?

**Decision**: Seed database with sample templates (already implemented in postdeploy hook).

**Implementation**: `hooks/postdeploy.sh` adds Azure-Samples/todo-nodejs-mongo on first deployment.

### Q: Should GitHub metadata sync be real-time or batch?

**Decision**: Batch job (nightly).

**Rationale**:
- Avoids rate limit issues
- Stars/forks change slowly
- Reduces API costs

---

## Next Steps

1. **Immediate** (this sprint):
   - Update frontend to call Phase 1 endpoints
   - Test with real MongoDB data
   - Deploy to Azure with azd up

2. **Sprint 2** (next 1-2 weeks):
   - Design and test database migration
   - Implement GitHub metadata sync service
   - Deploy Phase 2 (8 working sections)

3. **Future** (if demand exists):
   - Evaluate Phase 3 (AI/tech detection)
   - Gather feedback on Phase 4 (deployment tracking)
