# Leaderboards Data Aggregation Implementation Plan

## Overview

This document outlines the implementation plan for converting the current mock leaderboards dashboard into a functional system that aggregates real data from Template Doctor analysis results.

## Current State

- **Static Mock Data**: Leaderboards currently display hardcoded fake data for demonstration purposes
- **Beautiful UI**: Complete dashboard with D3.js visualizations (pie charts, bar charts, heatmaps)
- **Real Template Names**: Using actual Azure Sample repository names from batch scan URLs
- **AI Foundry Models**: Updated with current models (GPT-4o, Claude-3.5-Sonnet, Phi-3.5-Mini, etc.)

## Data Sources to Implement

### 1. Analysis Results Database

**Current**: Stored as JS files in `packages/app/results/`
**Need**: Database or structured storage system

**Required Tables/Collections**:

```sql
-- Analysis Results
CREATE TABLE analysis_results (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(255),
    repository_owner VARCHAR(100),
    repository_name VARCHAR(100),
    analyzer_user VARCHAR(100),
    collection_name VARCHAR(100),
    timestamp TIMESTAMP,
    issues_count INTEGER,
    health_score DECIMAL(5,2),
    language VARCHAR(50),
    model_used VARCHAR(100),
    deployment_target VARCHAR(20), -- ACA, AKS, AF
    success BOOLEAN
);

-- Issues Detected
CREATE TABLE issues (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES analysis_results(id),
    category VARCHAR(50), -- Security, Documentation, Dependencies, etc.
    issue_type VARCHAR(255),
    severity VARCHAR(20), -- high, medium, low
    count INTEGER
);

-- Template Metadata
CREATE TABLE templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    owner VARCHAR(100),
    repository_url VARCHAR(500),
    primary_language VARCHAR(50),
    stars INTEGER,
    forks INTEGER,
    last_updated TIMESTAMP,
    total_downloads INTEGER
);

-- User Analytics
CREATE TABLE user_analytics (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100),
    total_analyses INTEGER,
    collections_analyzed INTEGER,
    templates_built INTEGER,
    success_rate DECIMAL(5,2),
    last_activity TIMESTAMP
);
```

### 2. GitHub API Integration

**Purpose**: Fetch real repository metadata (stars, forks, activity)

**Implementation**:

```typescript
// packages/api/src/github-metrics/
class GitHubMetricsService {
    async getRepositoryMetrics(owner: string, repo: string) {
        // Fetch stars, forks, recent commits, contributors
        // Cache results to avoid rate limits
    }

    async getTemplateActivity(templates: string[]) {
        // Batch fetch activity metrics for multiple templates
        // Return activity scores based on commits, PRs, issues
    }
}
```

### 3. AZD Deployment Analytics

**Purpose**: Track successful deployments by service type

**Data Collection Points**:

- Azure Developer CLI telemetry (if available)
- Analysis of azd configuration files success rates
- Deployment target detection (ACA, AKS, Azure Functions)

**Implementation**:

```typescript
// packages/analyzer-core/src/azd-analyzer/
class AzdDeploymentAnalyzer {
    analyzeDeploymentConfig(templatePath: string) {
        // Parse azure.yaml, infra/ directory
        // Determine deployment targets
        // Assess configuration completeness
    }

    calculateDeploymentScore(template: any) {
        // Score based on config completeness, best practices
        // Return success probability
    }
}
```

### 4. AI Model Success Tracking

**Purpose**: Track which AI models perform best for different languages/scenarios

**Implementation**:

```typescript
// Track model usage and success rates
interface ModelUsage {
    model: string;
    language: string;
    templateType: string;
    analysisSuccess: boolean;
    issuesFound: number;
    healthScore: number;
    timestamp: Date;
}
```

## API Endpoints to Implement

### Backend Functions (Azure Functions)

```typescript
// packages/api/src/leaderboards/

// GET /api/v4/leaderboards/top-analyzers
export async function getTopAnalyzers(
    req: HttpRequest,
    context: InvocationContext,
) {
    // Query analysis_results, group by analyzer_user
    // Return top users by analysis count
}

// GET /api/v4/leaderboards/template-issues
export async function getTemplateIssues(
    req: HttpRequest,
    context: InvocationContext,
) {
    // Query issues, group by template
    // Return templates with highest issue counts
}

// GET /api/v4/leaderboards/prevalent-issues
export async function getPrevalentIssues(
    req: HttpRequest,
    context: InvocationContext,
) {
    // Query issues, group by category
    // Return aggregated issue counts for pie chart
}

// GET /api/v4/leaderboards/model-success
export async function getModelSuccess(
    req: HttpRequest,
    context: InvocationContext,
) {
    // Query analysis_results, group by model_used
    // Calculate success rates by model and language
}

// GET /api/v4/leaderboards/azd-deployments
export async function getAzdDeployments(
    req: HttpRequest,
    context: InvocationContext,
) {
    // Query successful deployments by service type
    // Return deployment counts and success rates
}
```

### Frontend Data Loading

```typescript
// packages/app/src/scripts/leaderboards-data.ts
class LeaderboardsDataLoader {
    async loadAllLeaderboards(): Promise<LeaderboardsData> {
        const [
            topAnalyzers,
            templateIssues,
            prevalentIssues,
            modelSuccess,
            azdDeployments,
        ] = await Promise.all([
            this.api.get("/leaderboards/top-analyzers"),
            this.api.get("/leaderboards/template-issues"),
            this.api.get("/leaderboards/prevalent-issues"),
            this.api.get("/leaderboards/model-success"),
            this.api.get("/leaderboards/azd-deployments"),
        ]);

        return {
            topAnalyzers,
            templateIssues,
            prevalentIssues,
            modelSuccess,
            azdDeployments,
        };
    }
}
```

## Data Processing Pipeline

### 1. Real-time Updates

```typescript
// When analysis completes, update leaderboards
class LeaderboardUpdater {
    async updateAfterAnalysis(analysisResult: AnalysisResult) {
        // Update user statistics
        // Update template issue counts
        // Update model success rates
        // Invalidate leaderboard cache
    }
}
```

### 2. Batch Processing

```typescript
// Nightly aggregation job
class LeaderboardAggregator {
    async runDailyAggregation() {
        // Recalculate all leaderboard metrics
        // Update GitHub repository metrics
        // Generate trending analysis
        // Cache results for fast loading
    }
}
```

### 3. Caching Strategy

```typescript
// Cache leaderboard data for performance
interface CacheConfig {
    topAnalyzers: { ttl: "1 hour" };
    templateIssues: { ttl: "30 minutes" };
    prevalentIssues: { ttl: "2 hours" };
    modelSuccess: { ttl: "4 hours" };
}
```

## Migration Strategy

### Phase 1: Database Setup

1. Choose database (Azure SQL, Cosmos DB, or PostgreSQL)
2. Create schema/collections for analysis results
3. Implement data migration from existing JS result files
4. Set up data access layer

### Phase 2: API Implementation

1. Create leaderboard API endpoints
2. Implement data aggregation queries
3. Add caching layer
4. Test with existing result data

### Phase 3: Frontend Integration

1. Replace mock data with API calls
2. Add loading states and error handling
3. Implement real-time updates
4. Add data refresh mechanisms

### Phase 4: Advanced Features

1. Historical trending analysis
2. Comparative analytics
3. User-specific leaderboards
4. Export/reporting features

## Performance Considerations

### Database Optimization

- Index on frequently queried columns (user, template, timestamp)
- Partitioning for large datasets
- Read replicas for leaderboard queries

### Caching

- Redis cache for aggregated results
- CDN caching for static leaderboard data
- Browser caching with appropriate TTLs

### API Rate Limits

- GitHub API rate limiting considerations
- Batch processing for external API calls
- Graceful degradation when APIs unavailable

## Security & Privacy

### Data Privacy

- Anonymize user data in public leaderboards
- Implement opt-out mechanisms
- GDPR compliance for EU users

### Access Control

- Admin-only access to detailed analytics
- Public vs private leaderboard sections
- Rate limiting on leaderboard APIs

## Monitoring & Analytics

### Metrics to Track

- Leaderboard page views and engagement
- Data freshness and update frequency
- API performance and error rates
- Cache hit rates and effectiveness

### Alerts

- Data pipeline failures
- Stale data detection
- API rate limit approaching
- Unusual activity patterns

## Testing Strategy

### Unit Tests

- Data aggregation logic
- Chart rendering functions
- API endpoint responses

### Integration Tests

- End-to-end leaderboard loading
- Data consistency checks
- Performance benchmarks

### Load Testing

- High-traffic leaderboard access
- Database query performance
- Cache effectiveness under load

## Documentation

### Developer Documentation

- API endpoint documentation
- Database schema documentation
- Data pipeline architecture
- Deployment procedures

### User Documentation

- Leaderboard metrics explanation
- How rankings are calculated
- Data update frequency
- Privacy and data usage policies

---

## Next Steps

1. **Database Design**: Finalize schema based on existing result file structure
2. **API Development**: Start with most critical endpoints (top analyzers, prevalent issues)
3. **Data Migration**: Create scripts to import existing JS result files
4. **Frontend Integration**: Update leaderboards.html to consume real APIs
5. **Testing**: Implement comprehensive test suite
6. **Documentation**: Create detailed API and deployment documentation

This implementation will transform the current beautiful mock dashboard into a fully functional analytics platform that provides real insights into Template Doctor usage and template quality across the Azure ecosystem.
