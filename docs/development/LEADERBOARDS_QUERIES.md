# Leaderboards MongoDB Queries & Data Model Analysis

## Executive Summary

Analysis of 12 leaderboard sections reveals:
- ✅ **3 sections** work with current schema (no changes needed)
- ⚠️ **5 sections** need minor metadata additions (Phase 2)
- ❌ **4 sections** need AI/tech detection (Phase 3+)

## Current MongoDB V2 Schema

### `repos` Collection
```javascript
{
  _id: ObjectId,
  owner: "Azure-Samples",
  repo: "todo-nodejs-mongo",
  scanMeta: {
    analyzedBy: "user@example.com",
    analyzedAt: ISODate,
    totalScans: 3
  },
  analysisResult: {
    score: 85,
    compliance: {
      score: 85,
      categories: [
        { category: "Security", checks: [...] }
      ]
    }
  }
}
```

### `analysis` Collection (historical, max 10)
```javascript
{
  _id: ObjectId,
  owner: "Azure-Samples",
  repo: "todo-nodejs-mongo",
  analyzedBy: "user@example.com",
  analyzedAt: ISODate,
  analysisResult: { score: 85, compliance: {...} }
}
```

---

## Leaderboard Queries

### 1. Top Analyzers (Overall) - ⚠️ NEEDS `collection` FIELD

```javascript
db.analysis.aggregate([
  {
    $group: {
      _id: "$analyzedBy",
      analyses: { $sum: 1 },
      collections: { $addToSet: "$collection" }
    }
  },
  {
    $project: {
      name: "$_id",
      analyses: 1,
      collections: { $size: "$collections" },
      _id: 0
    }
  },
  { $sort: { analyses: -1 } },
  { $limit: 5 }
])
```

**Data needed**: `collection: "aigallery"`

---

### 2. Top Analyzers (aigallery) - ⚠️ NEEDS `collection` FIELD

```javascript
db.analysis.aggregate([
  { $match: { collection: "aigallery" } },
  {
    $group: {
      _id: "$analyzedBy",
      analyses: { $sum: 1 },
      avgScore: { $avg: "$analysisResult.score" }
    }
  },
  {
    $project: {
      name: "$_id",
      analyses: 1,
      score: { $round: ["$avgScore", 1] },
      _id: 0
    }
  },
  { $sort: { analyses: -1 } },
  { $limit: 5 }
])
```

**Data needed**: Same as #1

---

### 3. Most Successful Builders - ⚠️ NEEDS GitHub METADATA

```javascript
db.repos.aggregate([
  {
    $group: {
      _id: "$owner",
      templates: { $sum: 1 },
      avgScore: { $avg: "$analysisResult.score" },
      totalStars: { $sum: "$metadata.stars" }
    }
  },
  {
    $project: {
      name: "$_id",
      templates: 1,
      successRate: { $round: ["$avgScore", 1] },
      totalDownloads: "$totalStars",  // Use stars as proxy
      _id: 0
    }
  },
  { $sort: { templates: -1 } },
  { $limit: 5 }
])
```

**Data needed**: `metadata.stars`, `metadata.forks`

---

### 4. Templates with Most Issues - ✅ WORKS NOW

```javascript
db.repos.aggregate([
  {
    $addFields: {
      issuesCount: {
        $reduce: {
          input: "$analysisResult.compliance.categories",
          initialValue: 0,
          in: { $add: ["$$value", { $size: "$$this.checks" }] }
        }
      },
      severity: {
        $switch: {
          branches: [
            { case: { $lt: ["$analysisResult.score", 70] }, then: "high" },
            { case: { $lt: ["$analysisResult.score", 85] }, then: "medium" }
          ],
          default: "low"
        }
      }
    }
  },
  { $sort: { issuesCount: -1 } },
  { $limit: 10 },
  {
    $project: {
      name: "$repo",
      author: "$owner",
      issues: "$issuesCount",
      severity: 1,
      _id: 0
    }
  }
])
```

**✅ No changes needed**

---

### 5. Most Prevalent Issues - ✅ WORKS NOW

```javascript
db.repos.aggregate([
  { $unwind: "$analysisResult.compliance.categories" },
  { $unwind: "$analysisResult.compliance.categories.checks" },
  {
    $group: {
      _id: "$analysisResult.compliance.categories.category",
      count: { $sum: 1 }
    }
  },
  {
    $project: {
      category: "$_id",
      issue: "$_id",
      count: 1,
      _id: 0
    }
  },
  { $sort: { count: -1 } },
  { $limit: 8 }
])
```

**✅ No changes needed**

---

### 6. Most Active Templates - ✅ WORKS NOW (with optional stars)

```javascript
db.repos.aggregate([
  {
    $project: {
      name: "$repo",
      author: "$owner",
      activity: "$scanMeta.totalScans",
      stars: { $ifNull: ["$metadata.stars", 0] },
      _id: 0
    }
  },
  { $sort: { activity: -1 } },
  { $limit: 10 }
])
```

**✅ Works now, enhanced with stars later**

---

### 7. Healthiest Templates (Python) - ⚠️ NEEDS `metadata.language`

```javascript
db.repos.aggregate([
  { $match: { "metadata.language": "Python" } },
  {
    $project: {
      name: "$repo",
      author: "$owner",
      health: "$analysisResult.score",
      downloads: { $ifNull: ["$metadata.stars", 0] },
      _id: 0
    }
  },
  { $sort: { health: -1 } },
  { $limit: 5 }
])
```

**Data needed**: `metadata.language: "Python"`

---

### 8. Healthiest Templates (JavaScript) - ⚠️ NEEDS `metadata.language`

Same as #7, filter by `"JavaScript"`

---

### 9. Most Successful Models - ❌ NEEDS AI MODEL DETECTION

```javascript
db.repos.aggregate([
  { $match: { "metadata.aiModel": { $exists: true } } },
  {
    $group: {
      _id: "$metadata.aiModel",
      success: { $avg: "$analysisResult.score" },
      templates: { $sum: 1 }
    }
  },
  {
    $project: {
      model: "$_id",
      success: { $round: ["$success", 1] },
      templates: 1,
      _id: 0
    }
  },
  { $sort: { success: -1 } },
  { $limit: 9 }
])
```

**Data needed**: `metadata.aiModel: "GPT-4o"` (parse from README/code)

---

### 10. Model/Language Success - ❌ NEEDS AI MODEL + LANGUAGE

```javascript
db.repos.aggregate([
  {
    $match: {
      "metadata.aiModel": { $exists: true },
      "metadata.language": { $exists: true }
    }
  },
  {
    $group: {
      _id: {
        model: "$metadata.aiModel",
        language: "$metadata.language"
      },
      success: { $avg: "$analysisResult.score" },
      templates: { $sum: 1 }
    }
  },
  {
    $project: {
      model: "$_id.model",
      language: "$_id.language",
      success: { $round: ["$success", 1] },
      templates: 1,
      _id: 0
    }
  },
  { $sort: { success: -1 } },
  { $limit: 12 }
])
```

**Data needed**: Both aiModel and language

---

### 11. Successful AZD Deployments - ❌ NEEDS DEPLOYMENT TRACKING

```javascript
db.repos.aggregate([
  { $match: { "deployments.azd": { $exists: true } } },
  {
    $project: {
      name: "$repo",
      author: "$owner",
      service: "$deployments.azd.service",
      deployments: "$deployments.azd.count",
      successRate: "$deployments.azd.successRate",
      _id: 0
    }
  },
  { $sort: { deployments: -1 } },
  { $limit: 5 }
])
```

**Data needed**: External telemetry or opt-in tracking

---

### 12. MSFT Tech Usage - ❌ NEEDS TECH DETECTION

```javascript
db.repos.aggregate([
  { $unwind: "$metadata.technologies" },
  {
    $group: {
      _id: "$metadata.technologies",
      count: { $sum: 1 }
    }
  },
  {
    $lookup: {
      from: "repos",
      pipeline: [{ $count: "total" }],
      as: "totalCount"
    }
  },
  {
    $project: {
      tech: "$_id",
      usage: {
        $multiply: [
          { $divide: ["$count", { $arrayElemAt: ["$totalCount.total", 0] }] },
          100
        ]
      },
      _id: 0
    }
  },
  { $sort: { usage: -1 } },
  { $limit: 6 }
])
```

**Data needed**: `metadata.technologies: ["Playwright", "TypeScript"]`

---

## Proposed Schema Additions

### Phase 2: Basic Metadata (Add to both `repos` and `analysis`)

```javascript
{
  // Existing fields...
  
  collection: "aigallery",  // For collection filtering
  
  metadata: {
    // From GitHub API (background job)
    stars: 0,
    forks: 0,
    lastCommit: ISODate,
    
    // Detected from GitHub language stats
    language: "Python"
  }
}
```

### Phase 3: AI/Tech Detection (Future)

```javascript
{
  metadata: {
    // ... Phase 2 fields ...
    
    // Detected from README/code parsing
    aiModel: "GPT-4o",
    aiProvider: "Azure OpenAI",
    
    // Detected from package.json, requirements.txt, etc.
    technologies: [
      "Playwright",
      "TypeScript",
      "Semantic Kernel"
    ]
  }
}
```

### Phase 4: Deployment Tracking (Optional)

```javascript
{
  deployments: {
    azd: {
      service: "ACA",  // ACA, AKS, AF
      count: 0,
      successRate: 0,
      lastDeployed: null
    }
  }
}
```

---

## Implementation Phases

### ✅ Phase 1: Implement Now (No Schema Changes)
**Leaderboards**:
- Templates with Most Issues
- Most Prevalent Issues
- Most Active Templates (using scanMeta.totalScans)

**Effort**: Low (just API endpoints + queries)

---

### ⚠️ Phase 2: Add Basic Metadata (Next Sprint)
**Schema additions**:
- `collection` field
- `metadata.language` (from GitHub API)
- `metadata.stars/forks` (from GitHub API)

**Leaderboards enabled**:
- Top Analyzers (Overall)
- Top Analyzers (aigallery)
- Most Successful Builders
- Healthiest Templates (Python/JS)

**Effort**: Medium
- Update database schema
- Create GitHub API integration service
- Backfill existing data

---

### ❌ Phase 3: AI/Tech Detection (Future)
**Schema additions**:
- `metadata.aiModel`
- `metadata.technologies`

**Requires**:
- README parsing
- Code analysis for imports/dependencies
- Pattern matching for AI model references

**Leaderboards enabled**:
- Most Successful Models
- Model/Language Success
- MSFT Tech Usage

**Effort**: High (ML/parsing required)

---

### ❌ Phase 4: Deployment Tracking (Optional)
**External integration required**:
- Telemetry service
- User opt-in tracking
- azd CLI integration

**Leaderboards enabled**:
- Successful AZD Deployments

**Effort**: Very High (privacy/compliance considerations)

---

## Recommended Implementation Order

### Sprint 1 (This Sprint)
1. ✅ Create `/api/v4/leaderboards` endpoint
2. ✅ Implement Phase 1 queries (3 sections)
3. ✅ Update leaderboards.html to call API
4. ✅ Show "Coming Soon" for other sections

### Sprint 2
1. Add `collection` field to schema
2. Create GitHub metadata sync service
3. Implement Phase 2 queries (5 more sections)
4. Backfill existing data

### Future
- Phase 3: AI/Tech detection (if resources available)
- Phase 4: Deployment tracking (if user demand)

---

## API Endpoint Design

```typescript
// GET /api/v4/leaderboards/:section
interface LeaderboardParams {
  section: 'top-analyzers-overall' 
    | 'most-issues' 
    | 'prevalent-issues'
    | 'active-templates'
    | ...;
  collection?: string;  // Optional filter
  limit?: number;       // Default: 5-10 depending on section
}

interface LeaderboardResponse {
  section: string;
  data: Array<any>;
  available: boolean;   // false if Phase 2/3 not implemented
  generatedAt: string;
  total?: number;
}
```

---

## Decision Required

**Question**: Which phases should we implement before deployment?

**Option A (Minimum Viable)**: Phase 1 only (3 sections)
- Pros: Fast, no schema changes, deploy now
- Cons: Mostly empty leaderboards

**Option B (Recommended)**: Phase 1 + Phase 2 (8 sections)
- Pros: Most leaderboards functional, GitHub data valuable
- Cons: 1-2 week delay, schema migration needed

**Option C (Full Featured)**: All phases
- Pros: Complete feature set
- Cons: 4-6 week delay, complex implementation

What's your preference?
