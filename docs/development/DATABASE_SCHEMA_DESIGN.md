# Database Schema Design Analysis

## Current Context

Template-Doctor performs two types of operations on templates:
1. **Static Analysis** - Code quality, best practices, security checks (runs frequently)
2. **AZD Deployment Tests** - Actual deployment to Azure (runs less frequently, expensive)

## Data Model Options

### Option 1: Separate Collections (Recommended) ✅

**Structure:**
```javascript
## Collections

### 1. `analysis` Collection (Template Analysis Results)

**Collection Name:** `analysis` (singular - matches TypeScript service property name)

```javascript
// analysis collection
{
  _id: ObjectId,
  repoUrl: "https://github.com/owner/repo",
  owner: "owner",
  repo: "repo",
  ruleSet: "dod",
  timestamp: 1696809600000,
  scanDate: ISODate("2024-10-09T00:00:00Z"),
  compliance: {
    percentage: 85,
    passed: 17,
    issues: 3
  },
  categories: {
    "documentation": {...},
    "security": {...}
  },
  issues: [...],
  compliant: [...],
  analysisResult: {...}, // Full analyzer output
  createdBy: "anfibiacreativa", // GitHub username who triggered the analysis
  scannedBy: ["user1"],
  upstreamTemplate: "https://github.com/azure-samples/todo-nodejs-mongo",
  archiveRequested: false,
  createdAt: ISODate,
  updatedAt: ISODate
}

// azdtests collection
{
  _id: ObjectId,
  repoUrl: "https://github.com/owner/repo",
  owner: "owner",
  repo: "repo",
  testId: "test-20241009-123456",
  timestamp: 1696809600000,
  status: "success", // pending | running | success | failed
  startedAt: ISODate,
  completedAt: ISODate,
  duration: 180000, // milliseconds
  result: {
    deploymentTime: 120000,
    resourcesCreated: 5,
    errors: [],
    warnings: ["Warning 1"],
    logs: "...",
    azdVersion: "1.5.0",
    azureRegion: "eastus"
  },
  triggeredBy: "user1",
  createdAt: ISODate,
  updatedAt: ISODate
}
```

**Pros:**
- ✅ **Independent lifecycles** - Analysis runs every PR, tests run monthly
- ✅ **Performance** - Queries for latest analyses don't load test data
- ✅ **Flexibility** - Can add deployment test-specific indexes
- ✅ **Scalability** - Analysis docs stay small (no growing test arrays)
- ✅ **Clear separation** - Different write patterns (analysis: frequent, tests: rare)
- ✅ **Easy aggregation** - Join on `repoUrl` when needed

**Cons:**
- ⚠️ Requires joins to see complete picture
- ⚠️ Slightly more complex queries for combined views

**Use Cases:**
1. **Dashboard tiles** - Show latest analyses (no test data needed) ✅
2. **Leaderboard** - Sort by compliance (no test data needed) ✅
3. **Template detail page** - Fetch analysis + separate query for tests ✅
4. **Test history** - Query azdtests collection only ✅

---

### Option 2: Embedded Documents (Nested)

**Structure:**
```javascript
{
  _id: ObjectId,
  repoUrl: "https://github.com/owner/repo",
  owner: "owner",
  repo: "repo",
  
  // Latest analysis data (overwrites on each scan)
  latestAnalysis: {
    ruleSet: "dod",
    timestamp: 1696809600000,
    scanDate: ISODate,
    compliance: {
      percentage: 85,
      passed: 17,
      issues: 3
    },
    categories: {...},
    issues: [...],
    compliant: [...],
    analysisResult: {...}
  },
  
  // Historical analyses (array grows with each scan)
  analysisHistory: [
    {
      timestamp: 1696809600000,
      compliance: {...},
      ruleSet: "dod"
    },
    // ... previous scans
  ],
  
  // AZD tests (array grows with each test)
  azdTests: [
    {
      testId: "test-20241009-123456",
      status: "success",
      startedAt: ISODate,
      completedAt: ISODate,
      duration: 180000,
      result: {...}
    },
    // ... previous tests
  ],
  
  // Template metadata
  scannedBy: ["user1", "user2"],
  upstreamTemplate: "...",
  archiveRequested: false,
  createdAt: ISODate,
  updatedAt: ISODate
}
```

**Pros:**
- ✅ Single document fetch for complete view
- ✅ Atomic updates (all data in one transaction)
- ✅ No joins needed

**Cons:**
- ❌ **Document size grows unbounded** (16MB MongoDB limit)
- ❌ **Poor performance** - Fetching analysis always loads ALL test history
- ❌ **Inefficient indexes** - Can't index into large arrays efficiently
- ❌ **Complex updates** - Updating one analysis loads entire history
- ❌ **Different access patterns** - 90% of queries don't need test data
- ❌ **Wasted bandwidth** - Dashboard loads test data unnecessarily

---

## Recommended Approach: Option 1 (Separate Collections)

### Rationale

1. **Access Pattern Analysis:**
   - **Frequent:** Latest analyses for dashboard (1000x/day)
   - **Rare:** Test results viewing (10x/day)
   - **Mismatch:** Embedding tests bloats 99% of queries

2. **Data Growth:**
   - **Analyses:** ~1 per template per week = 52/year
   - **Tests:** ~1 per template per month = 12/year
   - **Result:** Separate collections scale independently

3. **Query Performance:**
   - Dashboard: `db.analyses.find().sort({scanDate: -1}).limit(50)` - Fast, no test data
   - Leaderboard: `db.analyses.aggregate([...])` - Aggregates compliance only
   - Template detail: Two queries (analysis + tests) - Total <50ms

4. **Real-world Usage:**
   - Users browse analyses frequently (compliance scores, issues)
   - Users check test results occasionally (deployment validation)

### Collection Relationships

```
analyses ←→ azdtests
    ↓
  repoUrl (foreign key)
```

**Join Query Example:**
```javascript
// Get template with latest analysis + all test results
db.analyses.aggregate([
  { $match: { repoUrl: "https://github.com/owner/repo" }},
  { $sort: { scanDate: -1 }},
  { $limit: 1 },
  {
    $lookup: {
      from: "azdtests",
      localField: "repoUrl",
      foreignField: "repoUrl",
      as: "deploymentTests"
    }
  }
])
```

---

## Additional Collections

### `rulesets` Collection
Stores analysis ruleset configurations:
```javascript
{
  _id: ObjectId,
  name: "dod", // Unique ruleset identifier
  displayName: "DoD Best Practices",
  rules: [
    {
      id: "readme-exists",
      severity: "error",
      category: "documentation",
      enabled: true
    },
    // ... more rules
  ],
  version: "1.0.0",
  createdAt: ISODate,
  updatedAt: ISODate
}
```

### `configuration` Collection
Application-wide settings:
```javascript
{
  _id: ObjectId,
  key: "feature_flags.auto_save_results",
  value: "false",
  type: "boolean",
  description: "Automatically save analysis results to GitHub PRs",
  updatedBy: "admin",
  updatedAt: ISODate
}
```

---

## Indexes Strategy

### analyses Collection
```javascript
db.analyses.createIndex({ repoUrl: 1, scanDate: -1 })  // Template history
db.analyses.createIndex({ scanDate: -1 })               // Latest scans
db.analyses.createIndex({ "compliance.percentage": -1 }) // Leaderboard
db.analyses.createIndex({ owner: 1, repo: 1 })          // Lookup by owner/repo
db.analyses.createIndex({ ruleSet: 1 })                 // Filter by ruleset
```

### azdtests Collection
```javascript
db.azdtests.createIndex({ repoUrl: 1, startedAt: -1 }) // Template test history
db.azdtests.createIndex({ status: 1, startedAt: -1 })  // Failed tests
db.azdtests.createIndex({ testId: 1 }, { unique: true }) // Unique test IDs
```

---

## Migration Considerations

Since we have 56 existing filesystem results:
- All are **analyses** (no deployment tests yet)
- Map `window.reportData` → `analyses` documents
- Set `azdTests` collection empty initially
- Future: Add deployment test integration

---

## Conclusion

**Use Option 1: Separate Collections**

This provides:
- ✅ Best query performance for common operations
- ✅ Scalability as data grows
- ✅ Flexibility for future enhancements
- ✅ Clear separation of concerns
- ✅ Efficient indexes

The current implementation already supports this model - we just need to ensure the schema is finalized and documented.
