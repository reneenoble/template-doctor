# Quick Start: Create Cosmos DB in Azure Portal

This guide walks you through creating a Cosmos DB with MongoDB API in the Azure Portal and wiring it to Template Doctor.

## Step 1: Create Cosmos DB in Azure Portal

### 1.1 Navigate to Create Resource

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **"Create a resource"**
3. Search for **"Azure Cosmos DB"**
4. Click **"Create"** → **"Azure Cosmos DB for MongoDB"**

### 1.2 Configure Basic Settings

**Basics Tab:**

- **Subscription**: Select your subscription
- **Resource Group**: Choose existing or create new (e.g., `rg-template-doctor`)
- **Account Name**: `cosmos-template-doctor` (must be globally unique)
- **Location**: Choose your region (e.g., `East US`)
- **Capacity mode**: **Serverless** (recommended for variable workloads)
- **Version**: **6.0** or **7.0** (MongoDB API version)

**Global Distribution Tab:**

- **Geo-Redundancy**: Disabled (can enable later if needed)
- **Multi-region Writes**: Disabled

**Networking Tab:**

- **Connectivity method**: **All networks** (for initial testing; restrict later)
- Or choose **Selected networks** and add your IP for security

**Backup Policy Tab:**

- **Backup policy**: Continuous (7-day point-in-time restore)

**Encryption Tab:**

- **Data encryption**: Service-managed key (default)

### 1.3 Review and Create

1. Click **"Review + create"**
2. Verify settings
3. Click **"Create"**
4. Wait 3-5 minutes for deployment to complete

## Step 2: Create Database and Collections

### 2.1 Create Database

1. Navigate to your Cosmos DB account
2. Go to **"Data Explorer"** in left menu
3. Click **"New Database"**
    - **Database id**: `template-doctor`
    - Click **"OK"**

### 2.2 Create Collections

Create these 4 collections in the `template-doctor` database:

**Collection 1: analysis**

1. Right-click database → **"New Collection"**
    - **Database id**: Use existing `template-doctor`
    - **Collection id**: `analysis`
    - Click **"OK"**

**Collection 2: azdtests**

- **Collection id**: `azdtests`

**Collection 3: rulesets**

- **Collection id**: `rulesets`

**Collection 4: configuration**

- **Collection id**: `configuration`

## Step 3: Configure Managed Identity Authentication

### 3.1 Create Managed Identity (if not exists)

**Via Portal:**

1. Search for **"Managed Identities"**
2. Click **"+ Create"**
3. **Settings:**
    - **Subscription**: Your subscription
    - **Resource group**: `rg-template-doctor`
    - **Region**: Same as Cosmos DB
    - **Name**: `mi-template-doctor`
4. Click **"Review + create"** → **"Create"**

**Via CLI:**

```bash
az identity create \
  --name mi-template-doctor \
  --resource-group rg-template-doctor \
  --location eastus
```

### 3.2 Assign Cosmos DB Data Contributor Role

**Get Managed Identity Principal ID:**

**Via Portal:**

1. Go to Managed Identity → `mi-template-doctor`
2. Copy **"Object (principal) ID"** from Overview

**Via CLI:**

```bash
PRINCIPAL_ID=$(az identity show \
  --name mi-template-doctor \
  --resource-group rg-template-doctor \
  --query principalId -o tsv)
echo "Principal ID: $PRINCIPAL_ID"
```

**Assign Role to Cosmos DB:**

**Via Portal:**

1. Go to your Cosmos DB account
2. Click **"Access Control (IAM)"** in left menu
3. Click **"+ Add"** → **"Add role assignment"**
4. **Role tab:**
    - Search for **"Cosmos DB Built-in Data Contributor"**
    - Select it and click **"Next"**
5. **Members tab:**
    - **Assign access to**: Managed Identity
    - Click **"+ Select members"**
    - **Subscription**: Your subscription
    - **Managed identity**: User-assigned managed identity
    - Select: `mi-template-doctor`
    - Click **"Select"**
6. Click **"Review + assign"**

**Via CLI:**

```bash
# Get Cosmos DB account name
COSMOS_ACCOUNT="cosmos-template-doctor"
RESOURCE_GROUP="rg-template-doctor"

# Get Principal ID (if not already set)
PRINCIPAL_ID=$(az identity show \
  --name mi-template-doctor \
  --resource-group $RESOURCE_GROUP \
  --query principalId -o tsv)

# Assign Cosmos DB Built-in Data Contributor role
# Role Definition ID: 00000000-0000-0000-0000-000000000002
az cosmosdb sql role assignment create \
  --account-name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --role-definition-id "00000000-0000-0000-0000-000000000002" \
  --principal-id $PRINCIPAL_ID \
  --scope "/"

echo "✅ Role assignment created (may take up to 15 minutes to propagate)"
```

**⏰ Important:** Role assignments can take **up to 15 minutes** to propagate. Wait before testing.

### 3.3 Assign Your User Account for Local Testing

To test locally without deploying to Container Apps, assign your own Azure account to Cosmos DB:

**Get Your User Principal ID:**

```bash
MY_PRINCIPAL_ID=$(az ad signed-in-user show --query id -o tsv)
echo "Your Principal ID: $MY_PRINCIPAL_ID"
```

**Assign Role to Your Account:**

```bash
az cosmosdb sql role assignment create \
  --account-name cosmos-template-doctor \
  --resource-group rg-template-doctor \
  --role-definition-id "00000000-0000-0000-0000-000000000002" \
  --principal-id $MY_PRINCIPAL_ID \
  --scope "/"

echo "✅ Your account has access for local testing"
```

**Login to Azure:**

```bash
az login
```

This allows `DefaultAzureCredential` to use your Azure CLI login for local development.

## Step 4: Configure Environment Variables

### Get Cosmos DB Endpoint

**Via Portal:**

1. Go to Cosmos DB account → **"Overview"**
2. Find **"MongoDB Connection String"** section
3. Copy the hostname part: `cosmos-template-doctor.mongo.cosmos.azure.com`
4. Format as: `https://cosmos-template-doctor.mongo.cosmos.azure.com:10255`

**Via CLI:**

```bash
COSMOS_ENDPOINT=$(az cosmosdb show \
  --name cosmos-template-doctor \
  --resource-group rg-template-doctor \
  --query "documentEndpoint" -o tsv | sed 's|https://\([^/]*\).*|https://\1:10255|')

echo "COSMOS_ENDPOINT=$COSMOS_ENDPOINT"
```

### Add to .env File

Add these to your `.env` file:

```bash
# Cosmos DB Configuration (Managed Identity)
COSMOS_ENDPOINT="https://cosmos-template-doctor.mongo.cosmos.azure.com:10255"
COSMOS_DATABASE_NAME="template-doctor"

# Required: GitHub tokens (existing)
GITHUB_TOKEN="ghp_xxx..."
GH_WORKFLOW_TOKEN="ghp_xxx..."
```

**📝 Note:** No connection string needed! The app uses Managed Identity via `DefaultAzureCredential`.

## Step 5: Test Connection Locally

### Prerequisites

- ✅ Cosmos DB created with collections
- ✅ Managed Identity created and assigned Data Contributor role
- ✅ Your Azure account assigned Data Contributor role (for local testing)
- ✅ Logged in to Azure: `az login`
- ✅ `.env` configured with `COSMOS_ENDPOINT`

### Rebuild and Restart Container

```bash
# Navigate to project root
cd /path/to/template-doctor

# Rebuild Docker image
docker build -f Dockerfile.combined -t template-doctor:latest .

# Stop old container
docker rm -f template-doctor

# Start with Managed Identity support
# Note: Passes Azure credentials from host to container
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  -v ~/.azure:/root/.azure:ro \
  --name template-doctor \
  template-doctor:latest

# Check logs (should see "Database connected")
docker logs template-doctor 2>&1 | grep -i database

# Expected output:
# 🔌 Connecting to Cosmos DB...
# [Database] Connecting to Cosmos DB: https://cosmos-template-doctor.mongo.cosmos.azure.com:10255
# [Database] Connected to database: template-doctor
# ✅ Database connected
```

**🔑 The `-v ~/.azure:/root/.azure:ro` flag:**

- Mounts your Azure CLI credentials into the container
- Allows `DefaultAzureCredential` to use your Azure login
- Read-only (`:ro`) for security
- Enables local testing without connection strings!

### Test Health Endpoint

```bash
curl http://localhost:3000/api/health | jq .
```

**Expected Output:**

```json
{
    "status": "ok",
    "timestamp": "2025-10-08T...",
    "database": {
        "connected": true,
        "latency": 45
    },
    "env": {
        "hasCosmosEndpoint": true
    }
}
```

### Test Analysis (Saves to DB)

```bash
curl -X POST http://localhost:3000/api/v4/analyze-template \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/Azure-Samples/todo-nodejs-mongo",
    "ruleSet": "dod"
  }'
```

### Verify Data in Portal

1. Go to Cosmos DB → **"Data Explorer"**
2. Expand `template-doctor` → `analysis`
3. Click **"Documents"**
4. You should see the newly saved analysis!

### Test Results API

```bash
# Get latest analyses
curl http://localhost:3000/api/v4/results/latest | jq .

# Get leaderboard
curl http://localhost:3000/api/v4/results/leaderboard | jq .
```

## Step 6: Migrate Existing Data

Once database is connected and tested, migrate your 56 existing results:

```bash
# Export to JSON files (review before importing)
npm run migrate:export

# Review files in migration-output/
ls -lh migration-output/

# Import directly to Cosmos DB (if COSMOS_ENDPOINT configured)
npm run migrate:import
```

**Or manually with mongoimport:**

```bash
mongoimport \
  --uri "mongodb://cosmos-template-doctor:xxxxx@cosmos-template-doctor.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb" \
  --db template-doctor \
  --collection analysis \
  --file migration-output/analysis-export.json
```

## Step 7: Production Deployment

### Assign Managed Identity to Container App

```bash
# Get Managed Identity resource ID
MI_ID=$(az identity show \
  --name mi-template-doctor \
  --resource-group rg-template-doctor \
  --query id -o tsv)

# Assign to Container App
az containerapp identity assign \
  --name ca-template-doctor \
  --resource-group rg-template-doctor \
  --user-assigned $MI_ID
```

### Update Container App Environment Variables

```bash
az containerapp update \
  --name ca-template-doctor \
  --resource-group rg-template-doctor \
  --set-env-vars \
    "COSMOS_ENDPOINT=https://cosmos-template-doctor.mongo.cosmos.azure.com:10255" \
    "COSMOS_DATABASE_NAME=template-doctor"
```

### Deploy Latest Code

```bash
# Build and push image (if using container registry)
az acr build \
  --registry <your-acr-name> \
  --image template-doctor:latest \
  --file Dockerfile.combined \
  .

# Or update Container App with new image
az containerapp update \
  --name ca-template-doctor \
  --resource-group rg-template-doctor \
  --image <your-acr-name>.azurecr.io/template-doctor:latest
```

### Verify Production Connection

```bash
# Get Container App URL
APP_URL=$(az containerapp show \
  --name ca-template-doctor \
  --resource-group rg-template-doctor \
  --query properties.configuration.ingress.fqdn -o tsv)

# Test health endpoint
curl https://$APP_URL/api/health | jq '.database'

# Expected: { "connected": true, "latency": 50 }
```

## Troubleshooting

### Error: "Failed to acquire access token"

**Cause**: Managed Identity not assigned to Cosmos DB role  
**Fix**:

```bash
# Verify role assignment
az cosmosdb sql role assignment list \
  --account-name cosmos-template-doctor \
  --resource-group rg-template-doctor

# Recreate if missing
az cosmosdb sql role assignment create \
  --account-name cosmos-template-doctor \
  --resource-group rg-template-doctor \
  --role-definition-id "00000000-0000-0000-0000-000000000002" \
  --principal-id <your-principal-id> \
  --scope "/"
```

### Error: "Database not connected"

**Cause**: Environment variables not set  
**Fix**: Verify `.env` has `COSMOS_ENDPOINT` set correctly

### Error: "Authentication failed" (Local Docker)

**Cause**: Azure credentials not mounted or not logged in  
**Fix**:

```bash
# Login to Azure
az login

# Restart container with credentials mounted
docker rm -f template-doctor
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  -v ~/.azure:/root/.azure:ro \
  --name template-doctor \
  template-doctor:latest
```

### Role Assignment Propagation Delay

**Issue**: MI assigned but still getting auth errors  
**Cause**: Role assignment propagation delay (up to 15 minutes)  
**Fix**: Wait 15 minutes after role assignment, then retry

### Can't see data in Data Explorer

**Cause**: Wrong database/collection name  
**Fix**: Verify `COSMOS_DATABASE_NAME=template-doctor` exactly

## Cost Monitoring

**Serverless Cosmos DB Pricing:**

- Request Units (RUs): $0.35 per million RU
- Storage: $0.25 per GB/month

**Expected Monthly Cost:**

- 1000 analyses/month: ~50 RU = **$0.02**
- 10,000 queries/month: ~50,000 RU = **$0.02**
- 50 MB storage: **$0.01**
- **Total: ~$2-5/month**

**Monitor in Portal:**

1. Cosmos DB → **"Metrics"**
2. Select metric: **"Total Request Units"**
3. Set alert if > 1M RU/day

## Security Best Practices

### ✅ Production Checklist

- [ ] Use Managed Identity (no connection strings)
- [ ] Enable network restrictions (selected networks only)
- [ ] Enable firewall rules (whitelist IPs)
- [ ] Enable diagnostic logs
- [ ] Set up Azure Monitor alerts
- [ ] Rotate keys regularly (if using keys)
- [ ] Enable private endpoints (for enhanced security)

### 🔒 Network Security (Optional)

1. Cosmos DB → **"Networking"**
2. **Public network access**: Selected networks
3. Add your Container App's virtual network
4. Or enable **Private Endpoint**

## Next Steps

1. ✅ Create Cosmos DB in Portal
2. ✅ Configure authentication (connection string for testing)
3. ✅ Test connection locally
4. ✅ Run migration script
5. ✅ Update frontend to query database
6. ✅ Deploy to production with MI
7. ✅ Monitor costs and performance

---

**Quick Reference URLs:**

- Azure Portal: https://portal.azure.com
- Cosmos DB Pricing: https://azure.microsoft.com/pricing/details/cosmos-db/
- MongoDB Connection Strings: https://www.mongodb.com/docs/manual/reference/connection-string/
