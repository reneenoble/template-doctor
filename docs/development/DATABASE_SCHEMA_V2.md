# Database Schema V2 - Repository-Centric Design

## Overview

This schema treats **repositories as the primary entity**, with analysis results stored separately for historical tracking. AZD test results are embedded in the repo document since we only need the latest.

## Collections

### 1. `repos` Collection (Repository Metadata + Latest Test)

**Collection Name:** `repos`

```javascript
{
  _id: ObjectId,
  repoUrl: "https://github.com/Azure-Samples/todo-nodejs-mongo", // Unique index
  owner: "Azure-Samples",
  repo: "todo-nodejs-mongo",
  
  // Latest analysis summary (for quick dashboard queries)
  latestAnalysis: {
    scanDate: ISODate("2024-10-09T12:00:00Z"),
    ruleSet: "dod",
    compliancePercentage: 85.5,
    passed: 17,
    issues: 3,
    analysisId: ObjectId("...") // Reference to full analysis document
  },
  
  // Embedded latest AZD test result (only keep most recent)
  latestAzdTest: {
    testId: "test-20241009-001",
    timestamp: ISODate("2024-10-01T10:00:00Z"),
    status: "success", // "pending" | "running" | "success" | "failed"
    duration: 450000, // milliseconds
    result: {
      deploymentTime: 420000,
      resourcesCreated: 8,
      azdUpSuccess: true,
      azdDownSuccess: true,
      errors: [],
      warnings: ["Bicep file could use managed identity"],
      endpoints: [
        { name: "web", url: "https://app-xxx.azurewebsites.net" }
      ]
    }
  },
  
  // Repository metadata
  upstreamTemplate: "https://github.com/azure-samples/todo-nodejs-mongo",
  archiveRequested: false,
  tags: ["nodejs", "mongodb", "azd-template"],
  
  createdAt: ISODate,
  updatedAt: ISODate
}
```

**Indexes:**
```javascript
db.repos.createIndex({ repoUrl: 1 }, { unique: true })
db.repos.createIndex({ owner: 1, repo: 1 })
db.repos.createIndex({ "latestAnalysis.compliancePercentage": -1 })
db.repos.createIndex({ "latestAnalysis.scanDate": -1 })
```

### 2. `analysis` Collection (Historical Analysis Results)

**Collection Name:** `analysis`

**Retention Policy:** Keep last 10 analysis results per repository (TTL or manual cleanup)

```javascript
{
  _id: ObjectId,
  repoUrl: "https://github.com/Azure-Samples/todo-nodejs-mongo", // Foreign key to repos
  owner: "Azure-Samples",
  repo: "todo-nodejs-mongo",
  
  // Analysis metadata
  scanDate: ISODate("2024-10-09T12:00:00Z"),
  ruleSet: "dod",
  timestamp: 1728489600000,
  
  // Compliance summary
  compliance: {
    percentage: 85.5,
    passed: 17,
    issues: 3
  },
  
  // Category breakdown
  categories: {
    "documentation": {
      enabled: true,
      percentage: 100,
      issues: [],
      compliant: [...]
    },
    "security": {
      enabled: true,
      percentage: 66.7,
      issues: [...],
      compliant: [...]
    },
    "azure-developer-cli": {
      enabled: true,
      percentage: 80,
      issues: [...],
      compliant: [...]
    }
  },
  
  // Detailed results
  issues: [
    {
      id: "managed-identity-recommended",
      severity: "warning",
      message: "Consider using Managed Identity",
      error: "Connection string detected",
      category: "security"
    }
  ],
  
  compliant: [
    {
      id: "readme-exists",
      category: "documentation",
      message: "README.md exists",
      details: { path: "README.md" }
    }
  ],
  
  // Full analyzer output (for detailed drill-down)
  analysisResult: {
    repoUrl: "...",
    branch: "main",
    totalChecks: 20,
    passedChecks: 17,
    failedChecks: 3,
    analyzedAt: "2024-10-09T12:00:00Z"
  },
  
  // Audit fields
  createdBy: "anfibiacreativa", // GitHub username who triggered
  scannedBy: ["scanner-instance-1"],
  
  createdAt: ISODate,
  updatedAt: ISODate
}
```

**Indexes:**
```javascript
db.analysis.createIndex({ repoUrl: 1, scanDate: -1 })
db.analysis.createIndex({ scanDate: -1 })
db.analysis.createIndex({ "compliance.percentage": -1 })
db.analysis.createIndex({ createdBy: 1 })
```

**Retention Strategy:**
```javascript
// Keep only last 10 analyses per repo
db.analysis.aggregate([
  { $sort: { repoUrl: 1, scanDate: -1 } },
  { $group: { 
      _id: "$repoUrl", 
      analyses: { $push: "$$ROOT" } 
  }},
  { $project: { 
      toDelete: { $slice: ["$analyses", 10, 999] }
  }},
  { $unwind: "$toDelete" },
  { $replaceRoot: { newRoot: "$toDelete" } }
]).forEach(doc => db.analysis.deleteOne({ _id: doc._id }));
```

### 3. `rulesets` Collection (Unchanged)

```javascript
{
  _id: ObjectId,
  name: "dod",
  displayName: "Department of Defense",
  description: "DOD security and compliance requirements",
  version: "1.0.0",
  enabled: true,
  rules: [
    {
      id: "readme-exists",
      category: "documentation",
      severity: "error",
      enabled: true,
      description: "README.md must exist"
    }
  ],
  createdAt: ISODate,
  updatedAt: ISODate
}
```

### 4. `configuration` Collection (Unchanged)

```javascript
{
  _id: ObjectId,
  key: "max_analysis_history",
  value: 10,
  category: "retention",
  description: "Maximum number of analysis results to keep per repo",
  updatedBy: "admin",
  createdAt: ISODate,
  updatedAt: ISODate
}
```

## Query Patterns

### Dashboard (Latest Results)
```javascript
// Fast - only queries repos collection
db.repos.find({})
  .sort({ "latestAnalysis.scanDate": -1 })
  .limit(50)
```

### Leaderboard (Top Compliance)
```javascript
// Fast - indexed on compliance percentage
db.repos.find({})
  .sort({ "latestAnalysis.compliancePercentage": -1 })
  .limit(20)
```

### Repository Detail Page
```javascript
// 1. Get repo with latest test
const repo = db.repos.findOne({ repoUrl: "..." })

// 2. Get last 10 analysis results for trend chart
const history = db.analysis.find({ repoUrl: "..." })
  .sort({ scanDate: -1 })
  .limit(10)
```

### Analysis Trend Chart
```javascript
// Get historical compliance percentages
db.analysis.find(
  { repoUrl: "..." },
  { scanDate: 1, "compliance.percentage": 1 }
)
.sort({ scanDate: -1 })
.limit(10)
```

## Benefits of This Design

### ✅ Advantages

1. **Repository-Centric Access**
   - Repos are the main entity users interact with
   - One document per repo = simple, fast dashboard queries
   - Latest analysis embedded for speed

2. **Historical Tracking**
   - Keep 10 analysis results per repo for trend analysis
   - Separate collection = doesn't bloat repo documents
   - Easy to query specific time ranges

3. **Efficient AZD Tests**
   - Only latest test matters (embedded in repo)
   - No separate collection needed
   - Updated in-place when new test runs

4. **Optimized Query Patterns**
   - Dashboard: Single query to `repos` collection
   - Leaderboard: Single sorted query on indexed field
   - Details: One repo lookup + one analysis query
   - Trends: Efficient indexed query on repoUrl + scanDate

5. **Clean Data Lifecycle**
   - Old analysis results automatically pruned (>10 per repo)
   - Repo documents stay small and fast
   - AZD test is always current (overwrites)

### 📊 Access Pattern Analysis

- **Frequent (1000x/day):** Dashboard latest results → `repos` collection only
- **Common (100x/day):** Leaderboard → `repos` with index
- **Occasional (10x/day):** Repository detail → `repos` + `analysis` history
- **Rare (1x/day):** Trend analysis → `analysis` with date range

### 🔄 Write Patterns

1. **New Analysis Scan:**
   ```javascript
   // 1. Insert full analysis result
   const result = db.analysis.insertOne({...})
   
   // 2. Update repo with latest summary
   db.repos.updateOne(
     { repoUrl: "..." },
     { 
       $set: { 
         latestAnalysis: {
           scanDate: ...,
           compliancePercentage: ...,
           analysisId: result.insertedId
         },
         updatedAt: new Date()
       }
     },
     { upsert: true } // Create repo if doesn't exist
   )
   
   // 3. Prune old analyses (keep last 10)
   const count = db.analysis.countDocuments({ repoUrl: "..." })
   if (count > 10) {
     const toDelete = db.analysis.find({ repoUrl: "..." })
       .sort({ scanDate: -1 })
       .skip(10)
       .toArray()
     db.analysis.deleteMany({ _id: { $in: toDelete.map(d => d._id) } })
   }
   ```

2. **New AZD Test:**
   ```javascript
   // Simply overwrite latest test in repo document
   db.repos.updateOne(
     { repoUrl: "..." },
     { 
       $set: { 
         latestAzdTest: {...},
         updatedAt: new Date()
       }
     }
   )
   ```

## Migration from V1 to V2

### Step 1: Create `repos` collection from existing `analysis`
```javascript
db.analysis.aggregate([
  { $sort: { repoUrl: 1, scanDate: -1 } },
  { $group: {
      _id: "$repoUrl",
      latest: { $first: "$$ROOT" },
      owner: { $first: "$owner" },
      repo: { $first: "$repo" }
  }},
  { $project: {
      _id: 0,
      repoUrl: "$_id",
      owner: "$owner",
      repo: "$repo",
      latestAnalysis: {
        scanDate: "$latest.scanDate",
        ruleSet: "$latest.ruleSet",
        compliancePercentage: "$latest.compliance.percentage",
        passed: "$latest.compliance.passed",
        issues: "$latest.compliance.issues",
        analysisId: "$latest._id"
      },
      latestAzdTest: null,
      upstreamTemplate: "$latest.upstreamTemplate",
      archiveRequested: "$latest.archiveRequested",
      tags: [],
      createdAt: "$latest.createdAt",
      updatedAt: "$latest.updatedAt"
  }},
  { $out: "repos" }
])
```

### Step 2: Prune old analyses (keep last 10 per repo)
```javascript
// (Use retention script from above)
```

### Step 3: Update application code
- Change dashboard to query `repos` collection
- Update detail page to fetch from `repos` + `analysis` history
- Modify write logic to update both collections

## Comparison: V1 vs V2

| Aspect | V1 (Flat Analysis) | V2 (Repo-Centric) |
|--------|-------------------|-------------------|
| **Dashboard Query** | 26 analysis docs | 26 repo docs (faster) |
| **Leaderboard** | Sort all analyses | Sort repos (indexed) |
| **Historical Data** | One doc per scan | Last 10 per repo (limited) |
| **AZD Tests** | Separate collection | Embedded (latest only) |
| **Write Pattern** | Insert analysis | Insert analysis + update repo |
| **Data Growth** | Unlimited | Capped at 10 per repo |
| **Primary Entity** | Analysis scan | Repository |

## Recommended Approach: V2

**Reasoning:**
- Users think in terms of **repositories**, not individual scans
- Latest results are queried 100x more than historical data
- Historical trends only need last 10 scans (sufficient for charts)
- AZD tests are infrequent, latest is all we need
- Bounded growth prevents runaway collection size

## Common Query Examples

### Find repositories with low compliance
```javascript
db.repos.find({
  "latestAnalysis.compliancePercentage": { $lt: 50 }
}).sort({ "latestAnalysis.compliancePercentage": 1 })
```

### Get analysis trend for a repository
```javascript
db.analysis.find({
  repoUrl: "https://github.com/owner/repo"
}).sort({ scanDate: -1 }).limit(10)
```

### Count analyses per ruleset
```javascript
db.analysis.aggregate([
  { $group: { _id: "$ruleSet", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

### Find repositories with security issues
```javascript
db.analysis.find({
  "categories.security.issues.0": { $exists: true }
})
```

### Average compliance by category
```javascript
db.analysis.aggregate([
  { $match: { "categories": { $exists: true } } },
  {
    $project: {
      repoMgmt: "$categories.repositoryManagement.percentage",
      deployment: "$categories.deployment.percentage",
      security: "$categories.security.percentage"
    }
  },
  {
    $group: {
      _id: null,
      avgRepoMgmt: { $avg: "$repoMgmt" },
      avgDeployment: { $avg: "$deployment" },
      avgSecurity: { $avg: "$security" }
    }
  }
])
```

## Performance Considerations

### Cosmos DB RU Consumption

Typical Request Unit costs for common operations:

| Operation | RUs | Notes |
|-----------|-----|-------|
| Insert analysis | ~10 | Depends on document size (typically 10-50KB) |
| Update repos | ~5 | Small updates to latestAnalysis |
| Query latest 50 repos | ~20 | With index on scanDate |
| Historical query (10 docs) | ~10 | With compound index on repoUrl + scanDate |
| Aggregation pipeline | ~50+ | Varies by complexity and data size |

### Optimization Tips

1. **Always use indexes** - All queries should hit indexed fields to minimize RU consumption
2. **Limit results** - Use `.limit()` to avoid scanning entire collection
3. **Project only needed fields** - Reduce document size in results with `.project()`
4. **Batch writes** - Group multiple operations when possible to reduce connection overhead
5. **Use TTL indexes** - For automatic data expiration (if needed for old analyses)
6. **Monitor RU consumption** - Set alerts in Azure Portal for high RU usage
7. **Choose appropriate consistency** - Eventual consistency is cheaper than strong for read-heavy workloads

### Sample Query Costs

**Dashboard (50 latest repositories):**
```javascript
// ~20 RUs with index on latestAnalysis.scanDate
db.repos.find({})
  .sort({ "latestAnalysis.scanDate": -1 })
  .limit(50)
  .project({ _id: 1, repoUrl: 1, owner: 1, repo: 1, latestAnalysis: 1 })
```

**Leaderboard (top 100 by compliance):**
```javascript
// ~30 RUs with index on latestAnalysis.compliancePercentage
db.repos.find({})
  .sort({ "latestAnalysis.compliancePercentage": -1 })
  .limit(100)
  .project({ _id: 1, repoUrl: 1, owner: 1, repo: 1, latestAnalysis: 1 })
```

## Backup Strategy

### Local Development (MongoDB)

**Daily Backup Script:**
```bash
#!/bin/bash
# Save to /scripts/backup-mongodb.sh

BACKUP_DIR="/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
mongodump --db=template_doctor --out="${BACKUP_DIR}/${DATE}"

# Keep last 7 days only
find "${BACKUP_DIR}" -type d -mtime +7 -exec rm -rf {} +

echo "Backup completed: ${BACKUP_DIR}/${DATE}"
```

**Automated Backup (Cron):**
```bash
# Add to crontab: crontab -e
# Run daily at 2 AM
0 2 * * * /scripts/backup-mongodb.sh >> /var/log/mongodb-backup.log 2>&1
```

**Restore from Backup:**
```bash
# Restore specific backup
mongorestore --db=template_doctor /backups/mongodb/20250115_020000/template_doctor

# Restore specific collection
mongorestore --db=template_doctor --collection=repos /backups/mongodb/20250115_020000/template_doctor/repos.bson
```

### Cosmos DB (Production)

**Point-in-Time Restore (PITR):**
1. Enable in Azure Portal:
   - Navigate to Cosmos DB account
   - Settings → Backup & Restore
   - Enable "Point in Time Restore"
   - Set retention period (7-35 days)

2. Restore from PITR:
   - Portal → Backup & Restore → Restore
   - Select timestamp
   - Choose collections to restore
   - Create new Cosmos DB account (cannot restore to existing)

**Periodic Exports for Long-Term Archival:**
```bash
# Export using Data Migration Tool
dt.exe /s:DocumentDB /s.ConnectionString:"AccountEndpoint=https://...;AccountKey=...;Database=template_doctor" /s.Collection:repos /t:JsonFile /t.File:./exports/repos-export.json /t.Overwrite

# Or use Azure Data Factory:
# 1. Create pipeline with Cosmos DB source
# 2. Set JSON sink to Azure Blob Storage
# 3. Schedule monthly runs
```

**Backup Best Practices:**
- Enable PITR for 30-day retention
- Export to Azure Blob Storage monthly for long-term archival
- Test restore process quarterly
- Document restore procedures
- Monitor backup job status with Azure Monitor alerts

## Schema Validation (Optional)

MongoDB schema validation can enforce data quality at the database level:

```javascript
// Create repos collection with validation
db.createCollection("repos", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["repoUrl", "owner", "repo", "createdAt", "updatedAt"],
      properties: {
        repoUrl: {
          bsonType: "string",
          pattern: "^https://github.com/",
          description: "must be a valid GitHub URL"
        },
        owner: {
          bsonType: "string",
          minLength: 1,
          description: "must be a non-empty string"
        },
        repo: {
          bsonType: "string",
          minLength: 1,
          description: "must be a non-empty string"
        },
        latestAnalysis: {
          bsonType: "object",
          properties: {
            compliancePercentage: {
              bsonType: "number",
              minimum: 0,
              maximum: 100,
              description: "must be between 0 and 100"
            },
            passed: {
              bsonType: "int",
              minimum: 0
            },
            issues: {
              bsonType: "int",
              minimum: 0
            }
          }
        }
      }
    }
  }
})

// Create analysis collection with validation
db.createCollection("analysis", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["repoUrl", "owner", "repo", "scanDate", "ruleSet", "compliance", "createdAt"],
      properties: {
        repoUrl: {
          bsonType: "string",
          pattern: "^https://github.com/"
        },
        compliance: {
          bsonType: "object",
          required: ["percentage", "passed", "issues"],
          properties: {
            percentage: {
              bsonType: "number",
              minimum: 0,
              maximum: 100
            }
          }
        }
      }
    }
  }
})
```

## See Also

- [DATA_LAYER.md](./DATA_LAYER.md) - Comprehensive data layer documentation with setup guides
- [database.ts](../../packages/server/src/services/database.ts) - Database service implementation
- [analysis-storage.ts](../../packages/server/src/services/analysis-storage.ts) - Analysis storage service with upsert logic
- [LOCAL_DATABASE_TESTING.md](./LOCAL_DATABASE_TESTING.md) - Local MongoDB testing with Compass
- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) - Database connection configuration
