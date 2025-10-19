# Database Migration Plan: Cosmos DB with MongoDB API

## Overview

Migrate Template Doctor from filesystem-based result storage to Cosmos DB with MongoDB API, using Managed Identity for authentication.

## Architecture Decisions

### Database Choice: Cosmos DB with MongoDB API

- **Why Cosmos DB**: Azure-native, globally distributed, auto-scaling
- **Why MongoDB API**: Document model fits existing JSON structure, mature Node.js driver, developer-friendly query syntax
- **Authentication**: Managed Identity (RBAC) - no connection strings, enhanced security

### Migration Strategy: Dual-Write Pattern

- **Phase 1**: Write to both filesystem and database
- **Phase 2**: Read from database, fallback to filesystem
- **Phase 3**: Database-only (filesystem deprecated)
- **Rationale**: Zero-downtime migration, safe rollback

## Schema Design

### Collections

#### 1. `templates` Collection

```typescript
interface Template {
    _id: ObjectId;
    repoUrl: string; // unique index
    owner: string; // from repoUrl
    repo: string; // from repoUrl
    lastScanned: Date;
    scanCount: number;
    ruleSet: string; // 'azd' | 'dod' | 'custom'
    latestScanId: ObjectId; // ref to scans
    createdAt: Date;
    updatedAt: Date;
}
```

**Indexes:**

- `{ repoUrl: 1 }` - unique
- `{ owner: 1, repo: 1 }` - compound
- `{ lastScanned: -1 }` - for recent scans query
- `{ ruleSet: 1 }` - for filtering

#### 2. `scans` Collection

```typescript
interface Scan {
    _id: ObjectId;
    templateId: ObjectId; // ref to templates
    repoUrl: string; // denormalized for queries
    ruleSet: string;
    timestamp: Date;
    compliance: {
        percentage: number;
        passed: number;
        issues: number;
        errors: number;
        warnings: number;
    };
    issues: Array<{
        id: string;
        severity: "error" | "warning" | "info";
        message: string;
        error: string;
        category?: string;
    }>;
    compliant: Array<{
        id: string;
        category: string;
        message: string;
        details?: any;
    }>;
    azdValidation?: {
        // from artifact parsing
        azdUpSuccess: boolean;
        azdUpTime: string | null;
        azdDownSuccess: boolean;
        azdDownTime: string | null;
        psRuleErrors: number;
        psRuleWarnings: number;
        securityStatus: "pass" | "warnings" | "errors";
        overallStatus: "success" | "warning" | "failure";
        resultFileContent?: string; // optional, can be large
    };
    dashboardPath: string; // legacy filesystem path
    dataPath: string; // legacy filesystem path
    createdAt: Date;
}
```

**Indexes:**

- `{ templateId: 1, timestamp: -1 }` - for template history
- `{ repoUrl: 1, timestamp: -1 }` - queries by URL
- `{ timestamp: -1 }` - recent scans across all templates
- `{ 'compliance.percentage': 1 }` - for filtering by compliance

#### 3. `validation_runs` Collection

```typescript
interface ValidationRun {
    _id: ObjectId;
    scanId: ObjectId; // ref to scans
    repoUrl: string;
    runId: string; // UUID from workflow
    githubRunId: number;
    githubRunUrl: string;
    status: "queued" | "in_progress" | "completed" | "failed" | "cancelled";
    conclusion: string | null;
    triggeredBy: string; // user or system
    startedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
}
```

**Indexes:**

- `{ runId: 1 }` - unique, UUID lookup
- `{ githubRunId: 1 }` - GitHub run lookup
- `{ scanId: 1 }` - link to scan
- `{ status: 1, startedAt: -1 }` - active runs

## Infrastructure (Bicep)

### Resources to Create

```bicep
// File: infra/database.bicep

@description('Cosmos DB account for Template Doctor')
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: 'cosmos-${resourceToken}'
  location: location
  kind: 'MongoDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [
      { name: 'EnableMongo' }
      { name: 'EnableServerless' } // Serverless for cost-efficiency
    ]
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
  }
}

resource mongoDatabase 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2023-04-15' = {
  parent: cosmosAccount
  name: 'template-doctor'
  properties: {
    resource: {
      id: 'template-doctor'
    }
  }
}

// Collections created via MongoDB driver (not Bicep) for flexibility

// RBAC: Assign Cosmos DB Built-in Data Contributor to Container Apps MI
resource roleAssignment 'Microsoft.DocumentDB/databaseAccounts/mongodbRoleAssignments@2023-04-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, containerAppIdentity.principalId, 'contributor')
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/mongodbRoleDefinitions/00000000-0000-0000-0000-000000000001' // Built-in Data Contributor
    principalId: containerAppIdentity.principalId
    scope: cosmosAccount.id
  }
}

output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output cosmosDatabaseName string = 'template-doctor'
```

### Environment Variables

```bash
# Backend (.env / Container Apps env vars)
COSMOS_ENDPOINT=https://cosmos-xyz.mongo.cosmos.azure.com:10255
COSMOS_DATABASE_NAME=template-doctor
AZURE_CLIENT_ID=<managed-identity-client-id>  # For DefaultAzureCredential
```

## Implementation

### 1. Database Service Layer

**File:** `packages/server/src/services/database.ts`

```typescript
import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import { DefaultAzureCredential } from "@azure/identity";

class DatabaseService {
    private client: MongoClient | null = null;
    private db: Db | null = null;

    async connect(): Promise<void> {
        const endpoint = process.env.COSMOS_ENDPOINT;
        const dbName = process.env.COSMOS_DATABASE_NAME || "template-doctor";

        if (!endpoint) {
            throw new Error("COSMOS_ENDPOINT not configured");
        }

        // Managed Identity authentication
        const credential = new DefaultAzureCredential();
        const token = await credential.getToken(
            "https://cosmos.azure.com/.default",
        );

        const connectionString = `${endpoint}/?authMechanism=MONGODB-X509&tls=true`;

        this.client = new MongoClient(connectionString, {
            auth: {
                username: token.token, // Access token as username
                password: "", // Empty for token auth
            },
            tlsAllowInvalidCertificates: false,
        });

        await this.client.connect();
        this.db = this.client.db(dbName);

        // Create indexes on first connect
        await this.createIndexes();
    }

    async createIndexes(): Promise<void> {
        const templates = this.db!.collection("templates");
        await templates.createIndex({ repoUrl: 1 }, { unique: true });
        await templates.createIndex({ owner: 1, repo: 1 });
        await templates.createIndex({ lastScanned: -1 });

        const scans = this.db!.collection("scans");
        await scans.createIndex({ templateId: 1, timestamp: -1 });
        await scans.createIndex({ repoUrl: 1, timestamp: -1 });
        await scans.createIndex({ timestamp: -1 });

        const validationRuns = this.db!.collection("validation_runs");
        await validationRuns.createIndex({ runId: 1 }, { unique: true });
        await validationRuns.createIndex({ githubRunId: 1 });
    }

    get templates(): Collection {
        if (!this.db) throw new Error("Database not connected");
        return this.db.collection("templates");
    }

    get scans(): Collection {
        if (!this.db) throw new Error("Database not connected");
        return this.db.collection("scans");
    }

    get validationRuns(): Collection {
        if (!this.db) throw new Error("Database not connected");
        return this.db.collection("validation_runs");
    }

    async disconnect(): Promise<void> {
        await this.client?.close();
    }
}

export const db = new DatabaseService();
```

### 2. Result Storage Service (Dual-Write)

**File:** `packages/server/src/services/result-storage.ts`

```typescript
import { db } from "./database";
import fs from "fs/promises";
import path from "path";

export class ResultStorageService {
    async saveAnalysisResult(data: {
        repoUrl: string;
        ruleSet: string;
        compliance: any;
        issues: any[];
        compliant: any[];
        azdValidation?: any;
    }): Promise<{ scanId: string; templateId: string }> {
        const { owner, repo } = this.parseRepoUrl(data.repoUrl);

        // 1. Upsert template
        const templateResult = await db.templates.findOneAndUpdate(
            { repoUrl: data.repoUrl },
            {
                $set: {
                    owner,
                    repo,
                    lastScanned: new Date(),
                    ruleSet: data.ruleSet,
                    updatedAt: new Date(),
                },
                $inc: { scanCount: 1 },
                $setOnInsert: { createdAt: new Date() },
            },
            { upsert: true, returnDocument: "after" },
        );

        const templateId = templateResult.value!._id;

        // 2. Insert scan
        const scan = {
            templateId,
            repoUrl: data.repoUrl,
            ruleSet: data.ruleSet,
            timestamp: new Date(),
            compliance: data.compliance,
            issues: data.issues,
            compliant: data.compliant,
            azdValidation: data.azdValidation || null,
            dashboardPath: "", // populated below
            dataPath: "", // populated below
            createdAt: new Date(),
        };

        const scanResult = await db.scans.insertOne(scan);
        const scanId = scanResult.insertedId;

        // 3. Update template with latest scan reference
        await db.templates.updateOne(
            { _id: templateId },
            { $set: { latestScanId: scanId } },
        );

        // 4. DUAL WRITE: Also save to filesystem (migration period)
        if (process.env.ENABLE_FILESYSTEM_WRITE !== "false") {
            await this.saveToFilesystem(data, scanId.toString());
        }

        return {
            scanId: scanId.toString(),
            templateId: templateId.toString(),
        };
    }

    async getLatestScans(limit: number = 50): Promise<any[]> {
        // Try database first
        try {
            return await db.scans
                .find({})
                .sort({ timestamp: -1 })
                .limit(limit)
                .toArray();
        } catch (error) {
            console.error(
                "[ResultStorage] DB query failed, falling back to filesystem",
                error,
            );
            return this.getFromFilesystem();
        }
    }

    private parseRepoUrl(url: string): { owner: string; repo: string } {
        const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) throw new Error(`Invalid repo URL: ${url}`);
        return { owner: match[1], repo: match[2] };
    }

    private async saveToFilesystem(data: any, scanId: string): Promise<void> {
        // Legacy filesystem write (existing implementation)
        // ... existing code ...
    }

    private async getFromFilesystem(): Promise<any[]> {
        // Legacy filesystem read
        // ... existing code ...
    }
}

export const resultStorage = new ResultStorageService();
```

### 3. Update API Endpoints

**File:** `packages/server/src/routes/analysis.ts`

```typescript
import { resultStorage } from "../services/result-storage";

// POST /api/v4/analyze
router.post("/analyze", async (req, res) => {
    const { repoUrl, ruleSet } = req.body;

    // ... validation ...

    // Run analysis
    const analysisResult = await runAnalysis(repoUrl, ruleSet);

    // Save to database (+ filesystem during migration)
    const { scanId, templateId } = await resultStorage.saveAnalysisResult({
        repoUrl,
        ruleSet,
        compliance: analysisResult.compliance,
        issues: analysisResult.issues,
        compliant: analysisResult.compliant,
    });

    res.json({
        success: true,
        scanId,
        templateId,
        compliance: analysisResult.compliance,
    });
});

// GET /api/v4/results
router.get("/results", async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;

    const scans = await resultStorage.getLatestScans(limit);

    res.json({ scans });
});
```

## Migration Script

**File:** `scripts/migrate-to-database.ts`

```typescript
import { db } from "../packages/server/src/services/database";
import { glob } from "glob";
import fs from "fs/promises";

async function migrateFilesystemToDatabase() {
    await db.connect();

    const dataFiles = await glob("packages/app/results/**/*-data.js");

    console.log(`Found ${dataFiles.length} result files to migrate`);

    for (const file of dataFiles) {
        const content = await fs.readFile(file, "utf-8");

        // Extract window.reportData = {...}
        const match = content.match(/window\.reportData\s*=\s*({[\s\S]+?});/);
        if (!match) continue;

        const data = JSON.parse(match[1]);

        // Migrate to database
        await resultStorage.saveAnalysisResult({
            repoUrl: data.repoUrl,
            ruleSet: data.ruleSet,
            compliance: data.compliance,
            issues: data.compliance.issues,
            compliant: data.compliance.compliant,
            azdValidation: data.azdValidation,
        });

        console.log(`✓ Migrated ${data.repoUrl} (${data.timestamp})`);
    }

    console.log("Migration complete!");
    await db.disconnect();
}

migrateFilesystemToDatabase().catch(console.error);
```

## Testing Strategy

### Unit Tests

- Database service connection with MI
- CRUD operations for each collection
- Index creation and uniqueness constraints

### Integration Tests

- Dual-write verification (DB + filesystem)
- Fallback to filesystem when DB unavailable
- Migration script accuracy

### Load Tests

- Cosmos DB RU consumption under load
- Connection pooling behavior
- Query performance with indexes

## Rollback Plan

1. **Immediate rollback**: Set `ENABLE_FILESYSTEM_WRITE=false` to stop dual-write
2. **Database rollback**: Switch API to read from filesystem only (feature flag)
3. **Full rollback**: Revert to pre-database commits

## Deployment Checklist

- [ ] Deploy Cosmos DB via Bicep
- [ ] Assign MI permissions (RBAC)
- [ ] Test MI authentication from Container Apps
- [ ] Deploy dual-write code
- [ ] Run migration script for existing results
- [ ] Monitor RU consumption
- [ ] Verify fallback works
- [ ] Gradually disable filesystem reads
- [ ] Remove filesystem writes after 30 days stable

## Cost Estimation

**Cosmos DB Serverless:**

- Read operations: ~0.3 RU per document
- Write operations: ~5 RU per document
- Storage: $0.25 per GB/month

**Expected monthly cost (1000 scans/month):**

- Writes: 1000 × 5 RU = 5,000 RU = ~$0.50
- Reads: 10,000 × 0.3 RU = 3,000 RU = ~$0.30
- Storage (5 GB): $1.25
- **Total: ~$2/month**

## Success Metrics

- ✅ 100% of new scans saved to database
- ✅ < 100ms query response time (p95)
- ✅ Zero data loss during migration
- ✅ Filesystem fallback working
- ✅ MI authentication success rate > 99.9%
