# Template Doctor Data Layer Documentation

This document describes the MongoDB-based data layer architecture, local development setup, testing procedures, and Cosmos DB deployment configuration.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Database Schema](#database-schema)
- [Local Development Setup](#local-development-setup)
- [Testing with MongoDB Compass](#testing-with-mongodb-compass)
- [API Endpoints](#api-endpoints)
- [Cosmos DB Deployment](#cosmos-db-deployment)
- [Data Migration](#data-migration)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

Template Doctor uses a **MongoDB database** with a V2 schema design optimized for both real-time dashboards and historical analysis tracking.

### Design Philosophy

- **Repos Collection**: One document per repository with latest analysis summary (fast dashboard queries)
- **Analysis Collection**: Historical analysis records (up to 10 per repository)
- **Automatic Pruning**: Old analyses automatically deleted to prevent unbounded growth

### Collections

1. **`repos`** - Repository metadata and latest analysis summary
2. **`analysis`** - Full historical analysis results

## Database Schema

### Repos Collection

Stores one document per repository with the latest analysis summary.

```typescript
interface Repo {
  _id?: ObjectId;
  repoUrl: string;              // Unique identifier (e.g., "https://github.com/owner/repo")
  owner: string;                // Repository owner
  repo: string;                 // Repository name
  latestAnalysis?: {            // Latest analysis summary
    scanDate: Date;
    ruleSet: string;
    compliancePercentage: number;
    passed: number;
    issues: number;
    analysisId: ObjectId;       // Reference to full analysis document
  };
  latestAzdTest?: {             // Latest AZD deployment test (optional)
    testId: string;
    status: string;
    timestamp: Date;
    duration?: number;
    result?: any;
  };
  tags: string[];               // Categorization tags
  upstreamTemplate?: string;    // Canonical upstream template name
  archiveRequested?: boolean;   // Whether to archive to central repo
  createdAt: Date;              // First scan date
  updatedAt: Date;              // Last update date
}
```

**Indexes:**
- `repoUrl` (unique)
- `latestAnalysis.scanDate` (descending, for dashboard sorting)
- `latestAnalysis.compliancePercentage` (descending, for leaderboard)

### Analysis Collection

Stores full historical analysis results (up to 10 per repository).

```typescript
interface Analysis {
  _id?: ObjectId;
  repoUrl: string;              // Repository URL
  owner: string;                // Repository owner
  repo: string;                 // Repository name
  ruleSet: string;              // Rule set used (e.g., "dod", "partner")
  timestamp: number;            // Unix timestamp
  scanDate: Date;               // Analysis date
  compliance: {                 // Compliance summary
    percentage: number;
    issues: number;
    passed: number;
  };
  categories?: Record<string, { // Category breakdown
    enabled: boolean;
    issues: any[];
    compliant: any[];
    percentage: number;
  }>;
  issues: any[];                // Full issue details
  compliant: any[];             // Full compliant check details
  analysisResult: any;          // Complete analyzer output
  scannedBy?: string[];         // User who initiated scan
  upstreamTemplate?: string;    // Template name
  archiveRequested?: boolean;   // Archive flag
  createdAt: Date;              // Record creation date
  updatedAt: Date;              // Record update date
}
```

**Indexes:**
- `repoUrl` (for historical queries)
- `scanDate` (descending, for pruning/sorting)

## Local Development Setup

### Prerequisites

- **MongoDB Community Edition** installed locally
- **MongoDB Compass** (optional but recommended for GUI access)
- **Node.js 20+**

### Installation

#### macOS (Homebrew)

```bash
# Install MongoDB Community Edition
brew tap mongodb/brew
brew install mongodb-community@7.0

# Start MongoDB service
brew services start mongodb-community@7.0

# Verify MongoDB is running
mongosh --eval "db.version()"
```

#### Windows

Download and install from [MongoDB Download Center](https://www.mongodb.com/try/download/community).

#### Linux (Ubuntu/Debian)

```bash
# Import MongoDB GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Configuration

1. **Environment Variables**

   Create or update `.env` in the project root:

   ```bash
   # MongoDB Connection (Local Development)
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DATABASE=template_doctor
   
   # Or use Cosmos DB (Production)
   # COSMOS_DB_CONNECTION_STRING=mongodb://your-cosmos-account.mongo.cosmos.azure.com:10255/?ssl=true...
   # MONGODB_DATABASE=template_doctor
   ```

2. **Connection Priority**

   The application uses this connection priority:
   1. `COSMOS_DB_CONNECTION_STRING` (if set, uses Cosmos DB)
   2. `MONGODB_URI` (local MongoDB)
   3. Default: `mongodb://localhost:27017` (for local dev)

### Initialize Database

1. **Start MongoDB** (if not already running):

   ```bash
   # macOS
   brew services start mongodb-community@7.0
   
   # Linux
   sudo systemctl start mongod
   
   # Docker (alternative)
   docker run -d -p 27017:27017 --name mongodb mongo:7.0
   ```

2. **Seed Database with Sample Data**:

   ```bash
   # Seed from JSON files in data/seed/
   npm run db:seed
   
   # Force re-seed (drops existing data)
   npm run db:seed:force
   ```

3. **Verify Connection**:

   ```bash
   mongosh
   use template_doctor
   show collections
   db.repos.countDocuments()
   db.analysis.countDocuments()
   ```

## Testing with MongoDB Compass

MongoDB Compass provides a GUI for exploring and testing your database.

### Installation

Download from [MongoDB Compass Downloads](https://www.mongodb.com/try/download/compass).

### Connect to Local Database

1. **Open MongoDB Compass**
2. **Connection String**: `mongodb://localhost:27017`
3. **Click Connect**
4. **Select Database**: `template_doctor`

### Exploring Data

#### View Repos Collection

1. Navigate to `template_doctor` > `repos`
2. **Documents View**: See all repository entries
3. **Schema View**: Analyze document structure
4. **Indexes**: Verify indexes are created

**Sample Query** (Filter):
```json
{ "latestAnalysis.compliancePercentage": { "$gte": 80 } }
```

#### View Analysis Collection

1. Navigate to `template_doctor` > `analysis`
2. **Sort** by `scanDate` descending to see latest analyses

**Sample Query** (Find all analyses for a repo):
```json
{ "repoUrl": "https://github.com/owner/repo" }
```

#### Aggregation Pipeline Examples

**Count analyses per repository**:
```javascript
[
  {
    $group: {
      _id: "$repoUrl",
      count: { $sum: 1 },
      avgCompliance: { $avg: "$compliance.percentage" }
    }
  },
  { $sort: { count: -1 } }
]
```

**Top 10 repositories by compliance**:
```javascript
[
  {
    $lookup: {
      from: "repos",
      localField: "repoUrl",
      foreignField: "repoUrl",
      as: "repo"
    }
  },
  { $unwind: "$repo" },
  { $sort: { "repo.latestAnalysis.compliancePercentage": -1 } },
  { $limit: 10 },
  {
    $project: {
      repoUrl: 1,
      compliance: "$repo.latestAnalysis.compliancePercentage",
      scanDate: "$repo.latestAnalysis.scanDate"
    }
  }
]
```

### Manual Testing Scenarios

#### 1. Create New Analysis

Run analysis via API:
```bash
curl -X POST http://localhost:3000/api/v4/analyze-template \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/owner/repo",
    "ruleSet": "dod"
  }'
```

**Verify in Compass**:
1. Check `repos` collection - new document or updated `latestAnalysis`
2. Check `analysis` collection - new document inserted
3. Verify `analysisId` in repos matches `_id` in analysis

#### 2. Update Existing Repository

Run another analysis on the same repo:
```bash
# Run the same curl command again
```

**Verify in Compass**:
1. `repos` collection - `updatedAt` changed, `createdAt` unchanged
2. `analysis` collection - new document added, count incremented
3. `latestAnalysis.analysisId` points to newest analysis

#### 3. Verify Pruning (After 11th Analysis)

Run 11 analyses for the same repository, then check:

```javascript
// In Compass aggregation
db.analysis.countDocuments({ repoUrl: "https://github.com/owner/repo" })
// Should return 10 (oldest pruned)
```

#### 4. Test Leaderboard Query

```bash
curl -s "http://localhost:3000/api/v4/results/leaderboard?limit=10" | jq '.leaderboard'
```

**Verify in Compass**:
```javascript
db.repos.find({ "latestAnalysis": { $exists: true } })
  .sort({ "latestAnalysis.compliancePercentage": -1 })
  .limit(10)
```

## API Endpoints

### Analysis Endpoints

#### Create Analysis
```http
POST /api/v4/analyze-template
Content-Type: application/json

{
  "repoUrl": "https://github.com/owner/repo",
  "ruleSet": "dod",
  "azureDeveloperCliEnabled": true,
  "aiDeprecationCheckEnabled": true
}
```

**Response**: Full analysis result + saves to database

#### Batch Analysis
```http
POST /api/v4/analyze-template
Content-Type: application/json

{
  "repos": [
    "https://github.com/owner/repo1",
    "https://github.com/owner/repo2"
  ],
  "ruleSet": "dod"
}
```

### Query Endpoints

#### Get Latest Results (Dashboard)
```http
GET /api/v4/results/latest?limit=50
```

**Response**:
```json
{
  "count": 50,
  "results": [
    {
      "id": "...",
      "repoUrl": "https://github.com/owner/repo",
      "owner": "owner",
      "repo": "repo",
      "latestAnalysis": {
        "scanDate": "2025-10-15T12:30:32.532Z",
        "ruleSet": "dod",
        "compliancePercentage": 85,
        "passed": 20,
        "issues": 3
      },
      "tags": []
    }
  ]
}
```

#### Get Repository Details with History
```http
GET /api/v4/results/repo/:owner/:repo
```

**Response**:
```json
{
  "repoUrl": "https://github.com/owner/repo",
  "owner": "owner",
  "repo": "repo",
  "latestAnalysis": { ... },
  "analyses": [
    { "scanDate": "...", "compliance": { ... } },
    { "scanDate": "...", "compliance": { ... } }
  ],
  "stats": {
    "totalScans": 5,
    "averageCompliance": 82.4,
    "bestCompliance": 90,
    "worstCompliance": 70,
    "lastScan": "2025-10-15T12:30:32.532Z"
  }
}
```

#### Get Leaderboard
```http
GET /api/v4/results/leaderboard?limit=100
```

**Response**:
```json
{
  "count": 100,
  "leaderboard": [
    {
      "repoUrl": "...",
      "owner": "...",
      "repo": "...",
      "compliance": 95,
      "lastScan": "2025-10-15T12:30:32.532Z",
      "scanCount": 8
    }
  ]
}
```

## Cosmos DB Deployment

Azure Cosmos DB for MongoDB provides a fully managed, globally distributed database service.

### Create Cosmos DB Account

#### Option 1: Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. **Create a resource** > **Azure Cosmos DB**
3. **API**: Select **Azure Cosmos DB for MongoDB**
4. **Account name**: `template-doctor-cosmos` (must be globally unique)
5. **Location**: Choose your region
6. **Capacity mode**: 
   - **Serverless** (recommended for dev/low traffic)
   - **Provisioned throughput** (for production with predictable load)
7. **Review + create**

#### Option 2: Azure CLI

```bash
# Variables
RESOURCE_GROUP="template-doctor-rg"
ACCOUNT_NAME="template-doctor-cosmos"
LOCATION="eastus"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Cosmos DB account with MongoDB API (Serverless)
az cosmosdb create \
  --name $ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --kind MongoDB \
  --server-version 4.2 \
  --capabilities EnableServerless \
  --locations regionName=$LOCATION

# Get connection string
az cosmosdb keys list \
  --name $ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  -o tsv
```

### Configure Application

1. **Get Connection String** from Azure Portal:
   - Navigate to your Cosmos DB account
   - **Settings** > **Connection String**
   - Copy **PRIMARY CONNECTION STRING**

2. **Update Environment Variables**:

   ```bash
   # Production (.env or Azure App Settings)
   COSMOS_DB_CONNECTION_STRING=mongodb://template-doctor-cosmos:****@template-doctor-cosmos.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@template-doctor-cosmos@
   MONGODB_DATABASE=template_doctor
   ```

3. **Connection String Format**:
   ```
   mongodb://<account-name>:<primary-key>@<account-name>.mongo.cosmos.azure.com:10255/<database>?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@<account-name>@
   ```

### Create Database and Collections

The application automatically creates collections and indexes on first connection, but you can manually create them:

```bash
# Using mongosh with Cosmos DB
mongosh "mongodb://your-cosmos-account.mongo.cosmos.azure.com:10255/?ssl=true" \
  --username your-cosmos-account \
  --password <primary-key>

# Create database
use template_doctor

# Create collections (automatic on first insert)
db.createCollection("repos")
db.createCollection("analysis")

# Create indexes
db.repos.createIndex({ "repoUrl": 1 }, { unique: true })
db.repos.createIndex({ "latestAnalysis.scanDate": -1 })
db.repos.createIndex({ "latestAnalysis.compliancePercentage": -1 })
db.analysis.createIndex({ "repoUrl": 1 })
db.analysis.createIndex({ "scanDate": -1 })
```

### Cosmos DB Considerations

#### Request Units (RUs)

Cosmos DB charges based on Request Units consumed:

- **Serverless**: Pay-per-request (good for dev/low traffic)
- **Provisioned**: Fixed RU/s capacity (predictable cost for production)

**Typical RU Costs**:
- Insert analysis document: ~10 RUs
- Update repos document: ~5 RUs
- Query latest 50 repos: ~20 RUs
- Historical query per repo: ~10 RUs

#### Optimize for Cosmos DB

1. **Limit Query Results**: Always use `.limit()` to avoid excessive RU consumption
2. **Use Indexes**: All queries should use indexed fields
3. **Batch Operations**: Group multiple operations when possible
4. **Partition Key**: Consider using `repoUrl` as partition key for large datasets

#### Connection String Security

**Never commit connection strings to Git!**

Use Azure Key Vault or App Service Configuration:

```bash
# Store in Azure Key Vault
az keyvault secret set \
  --vault-name template-doctor-kv \
  --name cosmos-connection-string \
  --value "mongodb://..."

# Reference in App Service
az webapp config appsettings set \
  --name template-doctor-app \
  --resource-group template-doctor-rg \
  --settings COSMOS_DB_CONNECTION_STRING="@Microsoft.KeyVault(SecretUri=https://template-doctor-kv.vault.azure.net/secrets/cosmos-connection-string/)"
```

## Data Migration

### Export from Local MongoDB

#### Option 1: Using mongoexport

```bash
# Export repos collection
mongoexport \
  --db=template_doctor \
  --collection=repos \
  --out=repos-export.json \
  --jsonArray

# Export analysis collection
mongoexport \
  --db=template_doctor \
  --collection=analysis \
  --out=analysis-export.json \
  --jsonArray
```

#### Option 2: Using mongodump

```bash
# Create binary backup
mongodump --db=template_doctor --out=./mongodb-backup/

# Creates: ./mongodb-backup/template_doctor/repos.bson
#          ./mongodb-backup/template_doctor/analysis.bson
```

### Import to Cosmos DB

#### Option 1: Using mongoimport

```bash
# Import repos collection
mongoimport \
  --uri="mongodb://your-cosmos-account:****@your-cosmos-account.mongo.cosmos.azure.com:10255/template_doctor?ssl=true" \
  --collection=repos \
  --file=repos-export.json \
  --jsonArray

# Import analysis collection
mongoimport \
  --uri="mongodb://your-cosmos-account:****@your-cosmos-account.mongo.cosmos.azure.com:10255/template_doctor?ssl=true" \
  --collection=analysis \
  --file=analysis-export.json \
  --jsonArray
```

#### Option 2: Using mongorestore

```bash
mongorestore \
  --uri="mongodb://your-cosmos-account:****@your-cosmos-account.mongo.cosmos.azure.com:10255/?ssl=true" \
  --db=template_doctor \
  ./mongodb-backup/template_doctor/
```

#### Option 3: Using Custom Migration Script

The project includes migration scripts:

```bash
# Export from local MongoDB to JSON
npm run migrate:export

# Generates: migration-output/analysis-export.json
#            migration-output/repos-export.json

# Import to Cosmos DB
# 1. Set COSMOS_DB_CONNECTION_STRING in .env
# 2. Run import
npm run migrate:import
```

### Verify Migration

```bash
# Check document counts
mongosh "mongodb://your-cosmos-account.mongo.cosmos.azure.com:10255/?ssl=true" \
  --username your-cosmos-account \
  --password <primary-key> \
  --eval "
    use template_doctor
    db.repos.countDocuments()
    db.analysis.countDocuments()
  "

# Test API endpoints
curl -s "https://your-app.azurewebsites.net/api/v4/results/latest?limit=5" | jq '.count'
```

## Troubleshooting

### Connection Issues

#### Local MongoDB Not Starting

```bash
# macOS - Check service status
brew services list | grep mongodb

# Restart service
brew services restart mongodb-community@7.0

# Check logs
tail -f /usr/local/var/log/mongodb/mongo.log
```

#### Cosmos DB Connection Timeout

```bash
# Test connection with mongosh
mongosh "your-connection-string" --eval "db.version()"

# Check firewall rules in Azure Portal
# Cosmos DB Account > Firewall and virtual networks
# Add your IP address or enable "Allow access from Azure Portal"
```

### Data Issues

#### Missing Indexes

```bash
# Check existing indexes
db.repos.getIndexes()
db.analysis.getIndexes()

# Recreate indexes if missing
db.repos.createIndex({ "repoUrl": 1 }, { unique: true })
db.repos.createIndex({ "latestAnalysis.scanDate": -1 })
```

#### Duplicate Key Errors

If you see `E11000 duplicate key error`:

```bash
# Find duplicate entries
db.repos.aggregate([
  { $group: { _id: "$repoUrl", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])

# Remove duplicates (keep newest)
db.repos.aggregate([
  { $sort: { updatedAt: -1 } },
  { $group: { _id: "$repoUrl", newest: { $first: "$$ROOT" }, ids: { $push: "$_id" } } },
  { $project: { _id: 0, toDelete: { $slice: ["$ids", 1, 999] } } }
]).forEach(doc => {
  db.repos.deleteMany({ _id: { $in: doc.toDelete } })
})
```

### Performance Issues

#### Slow Queries

```bash
# Enable profiling
db.setProfilingLevel(2, { slowms: 100 })

# Check slow queries
db.system.profile.find().sort({ ts: -1 }).limit(5).pretty()

# Explain query execution
db.repos.find({ "latestAnalysis.compliancePercentage": { $gte: 80 } })
  .explain("executionStats")
```

#### High Memory Usage

```bash
# Check current connections
db.serverStatus().connections

# Limit connection pool size
# In connection string: &maxPoolSize=50
```

### Docker MongoDB Issues

```bash
# Check container status
docker ps -a | grep mongodb

# View logs
docker logs mongodb

# Restart container
docker restart mongodb

# Connect to container
docker exec -it mongodb mongosh
```

## Best Practices

### Local Development

1. **Use Docker Compose** for consistent environment
2. **Seed database** before running tests
3. **Use Compass** for visual debugging
4. **Keep backups** before schema changes

### Production (Cosmos DB)

1. **Use Serverless** for unpredictable workloads
2. **Enable automatic failover** for high availability
3. **Monitor RU consumption** in Azure Portal
4. **Set up alerts** for quota limits
5. **Use connection pooling** (maxPoolSize=50)
6. **Implement retry logic** for transient failures

### Security

1. **Never commit connection strings**
2. **Use Azure Key Vault** for secrets
3. **Rotate keys regularly**
4. **Enable firewall rules** in Cosmos DB
5. **Use RBAC** for access control
6. **Audit database access** logs

## Additional Resources

- [MongoDB Manual](https://docs.mongodb.com/manual/)
- [MongoDB Compass Documentation](https://docs.mongodb.com/compass/)
- [Azure Cosmos DB for MongoDB](https://docs.microsoft.com/azure/cosmos-db/mongodb/introduction)
- [MongoDB Connection String Format](https://docs.mongodb.com/manual/reference/connection-string/)
- [Cosmos DB Request Units](https://docs.microsoft.com/azure/cosmos-db/request-units)
