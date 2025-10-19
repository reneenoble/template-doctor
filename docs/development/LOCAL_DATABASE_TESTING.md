# Local Database Testing Guide

## Testing Database Integration Locally

Since the database service requires Cosmos DB with Managed Identity, you have several options for local testing:

## Option 1: Mock Database Mode (Recommended for Development)

Run the server **without** Cosmos DB configured. The application gracefully handles missing database connection.

### Setup

1. **Don't set `COSMOS_ENDPOINT`** in your `.env` file (or comment it out):
   ```bash
   # COSMOS_ENDPOINT=  # Leave blank for local dev without DB
   ```

2. **Start the server**:
   ```bash
   cd packages/server
   npm run dev
   ```

3. **Expected behavior**:
   - Server starts successfully
   - Console shows: `⚠️  COSMOS_ENDPOINT not configured - database features disabled`
   - Analysis still works and returns results to frontend
   - Database save operations are skipped (logged as errors but don't crash)
   - Health check shows `database.connected: false`

### Test Endpoints

```bash
# Health check (should show database: { connected: false })
curl http://localhost:3001/api/health

# Analysis still works (returns results but doesn't save to DB)
curl -X POST http://localhost:3001/api/v4/analyze-template \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/Azure-Samples/todo-nodejs-mongo","ruleSet":"dod"}'

# Results endpoints will fail gracefully (404 or empty results)
curl http://localhost:3001/api/v4/results/latest
```

## Option 2: Azure Cosmos DB Emulator (Windows/Docker)

Use the Cosmos DB emulator for local testing with a real MongoDB-compatible database.

### Setup with Docker

1. **Start Cosmos DB Emulator**:
   ```bash
   docker run -p 8081:8081 -p 10250-10255:10250-10255 \
     --name cosmosdb-emulator \
     -e AZURE_COSMOS_EMULATOR_PARTITION_COUNT=10 \
     -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true \
     mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest
   ```

2. **Wait for emulator to start** (can take 1-2 minutes):
   ```bash
   # Check logs
   docker logs -f cosmosdb-emulator
   ```

3. **Configure connection string** in `.env`:
   ```bash
   # Use connection string instead of MI for emulator
   COSMOS_CONNECTION_STRING="mongodb://localhost:10255/?ssl=true&retrywrites=false"
   COSMOS_DATABASE_NAME="template-doctor"
   ```

4. **Modify database service** temporarily to support connection string:
   
   Edit `packages/server/src/services/database.ts`:
   ```typescript
   // In connect() method, add this before MI auth:
   const connStr = process.env.COSMOS_CONNECTION_STRING;
   if (connStr) {
     // Use connection string for local testing
     this.client = new MongoClient(connStr, { ... });
     await this.client.connect();
     // ... rest of setup
     return;
   }
   ```

### Limitations
- Emulator only available on Windows (native) or Docker (Linux containers)
- Different certificate handling (self-signed)
- Performance not representative of production

## Option 3: Use Azure Cosmos DB with Connection String (Temporary)

For testing with a real Cosmos DB instance **before MI is fully configured**.

### Setup

1. **Create Cosmos DB** manually or via Bicep:
   ```bash
   az deployment group create \
     --resource-group rg-template-doctor-dev \
     --template-file infra/database.bicep \
     --parameters principalId="00000000-0000-0000-0000-000000000000"
   ```

2. **Get connection string** from Azure Portal:
   - Navigate to Cosmos DB account → Keys
   - Copy "Primary Connection String"

3. **Set environment variable** in `.env`:
   ```bash
   COSMOS_CONNECTION_STRING="mongodb://cosmos-xyz:xxxxx@cosmos-xyz.mongo.cosmos.azure.com:10255/?ssl=true..."
   COSMOS_DATABASE_NAME="template-doctor"
   ```

4. **Temporarily modify database service** to use connection string (see Option 2)

5. **Start server**:
   ```bash
   npm run dev
   ```

### ⚠️ Security Warning
**Never commit connection strings to the repository!** This is for local testing only.

## Option 4: Full Azure Deployment + Local Code

Deploy infrastructure and test locally against production database.

### Setup

1. **Deploy Cosmos DB** to Azure:
   ```bash
   az deployment group create \
     --resource-group rg-template-doctor \
     --template-file infra/database.bicep \
     --parameters principalId=$(az identity show --name mi-template-doctor --resource-group rg-template-doctor --query principalId -o tsv)
   ```

2. **Assign your user account** to Cosmos DB (temporary):
   ```bash
   # Get your user principal ID
   MY_PRINCIPAL_ID=$(az ad signed-in-user show --query id -o tsv)
   
   # Assign Data Contributor role
   az cosmosdb mongo role assignment create \
     --account-name cosmos-template-doctor \
     --resource-group rg-template-doctor \
     --role-definition-id 00000000-0000-0000-0000-000000000002 \
     --principal-id $MY_PRINCIPAL_ID \
     --scope "/"
   ```

3. **Authenticate with Azure CLI**:
   ```bash
   az login
   ```

4. **Set environment variable** in `.env`:
   ```bash
   COSMOS_ENDPOINT="https://cosmos-template-doctor.mongo.cosmos.azure.com:10255"
   COSMOS_DATABASE_NAME="template-doctor"
   ```

5. **Start server**:
   ```bash
   npm run dev
   ```

6. **DefaultAzureCredential** will use your Azure CLI login for MI token acquisition

## Recommended Testing Workflow

### Phase 1: Development (Option 1)
- Run without database configured
- Test analysis logic, API responses
- Verify graceful degradation

### Phase 2: Integration Testing (Option 3 or 4)
- Deploy Cosmos DB to dev environment
- Use connection string or Azure CLI auth
- Test database writes, queries, aggregations
- Verify indexes and performance

### Phase 3: Production Testing
- Deploy to Container Apps with MI
- Test MI authentication end-to-end
- Monitor RU consumption and latency

## Testing the Database Features

### Test Analysis Save

```bash
# Run analysis (should save to database if connected)
curl -X POST http://localhost:3001/api/v4/analyze-template \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -d '{
    "repoUrl": "https://github.com/Azure-Samples/todo-nodejs-mongo",
    "ruleSet": "dod"
  }'

# Check if it was saved
curl http://localhost:3001/api/v4/results/latest
```

### Test Results API

```bash
# Latest analyses
curl http://localhost:3001/api/v4/results/latest?limit=10

# Leaderboard
curl http://localhost:3001/api/v4/results/leaderboard?limit=20

# Search
curl "http://localhost:3001/api/v4/results/search?owner=Azure-Samples&minCompliance=80"

# Specific repo
curl http://localhost:3001/api/v4/results/repo/Azure-Samples/todo-nodejs-mongo
```

### Test Database Health

```bash
# Health check includes database status
curl http://localhost:3001/api/health | jq
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-08T...",
  "database": {
    "connected": true,
    "latency": 45
  },
  "env": {
    "hasGitHubToken": true,
    "hasCosmosEndpoint": true
  }
}
```

## Troubleshooting

### Server won't start

**Issue**: Error on startup  
**Solution**: Check `.env` file, ensure no syntax errors

### Database connection fails

**Issue**: `Database connection failed: Failed to acquire access token`  
**Solutions**:
- For Option 1: Remove `COSMOS_ENDPOINT` from `.env`
- For Option 3: Verify connection string is correct
- For Option 4: Run `az login` and verify permissions

### Analysis works but doesn't save

**Issue**: Analysis completes but results not in database  
**Check**:
1. Console logs: Should see `[analyze] Saved analysis to database for <repoUrl>`
2. Error logs: Look for `[analyze] Database save failed: <error>`
3. Health check: Verify `database.connected: true`

### Results API returns empty

**Issue**: `/api/v4/results/latest` returns `{ count: 0, results: [] }`  
**Cause**: Database empty (no analyses saved yet)  
**Solution**: Run at least one analysis, then query again

## Quick Start for Local Testing

**Simplest approach** (no database):

```bash
# 1. Ensure COSMOS_ENDPOINT is NOT set in .env
grep -v COSMOS_ENDPOINT .env > .env.tmp && mv .env.tmp .env

# 2. Start server
cd packages/server
npm run dev

# 3. Test analysis (works without DB)
curl -X POST http://localhost:3001/api/v4/analyze-template \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/Azure-Samples/todo-nodejs-mongo","ruleSet":"dod"}'
```

**For real database testing**, follow Option 3 or 4 above.

## Next Steps

Once local testing is complete:

1. **Deploy infrastructure** to Azure
2. **Configure Container Apps** with MI and env vars
3. **Run migration script** to backfill existing results
4. **Update frontend** to use results API
5. **Monitor production** health check and RU consumption
