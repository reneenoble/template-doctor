# Production Database Setup with Managed Identity

**IMPORTANT**: Template Doctor uses **Managed Identity (MI) for production Cosmos DB authentication**, NOT connection strings. This document explains how it works and how to set it up.

## Table of Contents
- [Overview](#overview)
- [How Managed Identity Works](#how-managed-identity-works)
- [Current Deployment State](#current-deployment-state)
- [Setup Options](#setup-options)
  - [Option 1: Let azd provision Cosmos DB (Recommended)](#option-1-let-azd-provision-cosmos-db-recommended)
  - [Option 2: Use existing Cosmos DB](#option-2-use-existing-cosmos-db)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Overview

### Why Managed Identity?

✅ **Security**: No connection strings in code, config, or logs  
✅ **Zero Secrets**: Tokens are acquired automatically by Azure  
✅ **Automatic Rotation**: Azure handles credential lifecycle  
✅ **RBAC Control**: Fine-grained permissions via Azure roles  
✅ **Audit Trail**: All database access logged in Azure AD

### Architecture

```
┌──────────────────────────────────────┐
│   Container App (Template Doctor)   │
│   • System-Assigned Managed Identity│ ◄── No secrets stored
└────────────┬─────────────────────────┘
             │
             │ 1. Requests token from Azure AD
             ▼
┌──────────────────────────────────────┐
│        Azure AD (Entra ID)           │
│   Validates Container App identity   │
└────────────┬─────────────────────────┘
             │
             │ 2. Returns access token
             ▼
┌──────────────────────────────────────┐
│   Application Code (database.ts)    │
│   • DefaultAzureCredential           │
│   • Builds MongoDB conn string       │
│   • Uses token as username/password  │
└────────────┬─────────────────────────┘
             │
             │ 3. Connects with token
             ▼
┌──────────────────────────────────────┐
│   Azure Cosmos DB (MongoDB API)      │
│   • Validates token against RBAC     │
│   • Grants access if role assigned   │
└──────────────────────────────────────┘
```

## How Managed Identity Works

### 1. Container App Gets System-Assigned Managed Identity

When deployed via Bicep (`infra/core/host/container-app.bicep`):

```bicep
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  identity: {
    type: 'SystemAssigned'  // ◄── Creates MI automatically
  }
}
```

Azure creates:
- **Service Principal** in Azure AD
- **Principal ID** (unique GUID)
- **Managed Identity** attached to the Container App

### 2. Grant MI Access to Cosmos DB

Two methods:

#### Method A: Via Bicep (Automated)

`infra/database.bicep` grants the `Cosmos DB Built-in Data Contributor` role:

```bicep
resource roleAssignment 'Microsoft.DocumentDB/databaseAccounts/mongodbRoleAssignments@2024-05-15' = {
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/mongodbRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: principalId  // ◄── Container App's MI Principal ID
    scope: cosmosAccount.id
  }
}
```

#### Method B: Via Azure Portal (Manual)

1. Go to Cosmos DB account → **Data Explorer**
2. Click **RBAC** → **Add Role Assignment**
3. Select role: `Cosmos DB Built-in Data Contributor`
4. Assign to: Container App's **Managed Identity**

### 3. Application Acquires Token

Code in `packages/server/src/services/database.ts`:

```typescript
import { DefaultAzureCredential } from '@azure/identity';

// Get COSMOS_ENDPOINT from environment (e.g., https://cosmos-abc123.documents.azure.com)
const cosmosEndpoint = process.env.COSMOS_ENDPOINT;

// Acquire access token using Container App's Managed Identity
const credential = new DefaultAzureCredential();
const tokenResponse = await credential.getToken('https://cosmos.azure.com/.default');
const token = tokenResponse.token;

// Build MongoDB connection string with token as credentials
const connString = `mongodb://${encodeURIComponent(token)}:${encodeURIComponent(token)}@${cosmosEndpoint.replace('https://', '')}:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@template-doctor@`;

// Connect to Cosmos DB
const client = new MongoClient(connString);
await client.connect();
```

**Key Point**: The token is used as **both username and password** in the MongoDB connection string. Cosmos DB validates this token against its RBAC configuration.

### 4. Token Refresh

Tokens expire after ~1 hour. The application automatically refreshes:

```typescript
// Token refresh every 1 hour
setInterval(async () => {
  await this.disconnect();
  await this.connect();  // ◄── Acquires new token
}, 3600000);
```

## Current Deployment State

### ⚠️ **IMPORTANT**: Cosmos DB module is commented out in `infra/main.bicep`

```bicep
// Cosmos DB Module - COMMENTED OUT: Using existing database
/*
module cosmos './database.bicep' = {
  name: 'cosmos-db-deployment'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    principalId: principalId  // ◄── Would pass Container App's MI
  }
}
*/
```

This means:
- `azd up` will **NOT** provision Cosmos DB automatically
- You must either:
  1. **Uncomment the module** to let azd provision it (Recommended)
  2. **Create Cosmos DB manually** and configure MI yourself

### Current Bicep Configuration Issue

`infra/main.bicep` currently passes `MONGODB_URI` (connection string) instead of `COSMOS_ENDPOINT`:

```bicep
env: concat([
  {
    name: 'MONGODB_URI'    // ◄── WRONG: This is for connection strings
    value: mongodbUri      // ◄── User must provide full connection string
  }
])
```

**This bypasses Managed Identity!** Users are forced to use connection strings.

## Setup Options

### Option 1: Let azd provision Cosmos DB (Recommended)

#### Step 1: Uncomment Cosmos DB module in `infra/main.bicep`

```bicep
// Cosmos DB Module
module cosmos './database.bicep' = {
  name: 'cosmos-db-deployment'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    principalId: containerApp.outputs.principalId  // Pass Container App's MI
  }
}
```

#### Step 2: Update Container App environment to use `COSMOS_ENDPOINT`

Replace the `MONGODB_URI` environment variable with:

```bicep
env: concat([
  {
    name: 'COSMOS_ENDPOINT'
    value: 'https://${cosmos.outputs.cosmosAccountName}.documents.azure.com'
  }
  {
    name: 'COSMOS_DATABASE_NAME'
    value: cosmos.outputs.cosmosDatabaseName
  }
  // ... other env vars
])
```

#### Step 3: Remove `MONGODB_URI` from parameters

In `infra/main.bicep`, delete:

```bicep
@secure()
@description('MongoDB connection string - set in .env as MONGODB_URI')
param mongodbUri string
```

#### Step 4: Deploy

```bash
azd up
```

**What happens**:
1. Bicep provisions Cosmos DB (serverless, MongoDB API)
2. Bicep creates Container App with System-Assigned MI
3. Bicep grants MI the `Cosmos DB Built-in Data Contributor` role
4. Container App starts with `COSMOS_ENDPOINT` env var
5. Application uses `DefaultAzureCredential` to connect (NO connection string!)

### Option 2: Use existing Cosmos DB

If you already have a Cosmos DB account:

#### Step 1: Get Cosmos DB endpoint

```bash
az cosmosdb show \
  --name YOUR_COSMOS_ACCOUNT_NAME \
  --resource-group YOUR_RG \
  --query "documentEndpoint" -o tsv
```

Example output: `https://cosmos-abc123.documents.azure.com`

#### Step 2: Get Container App's Managed Identity Principal ID

After deploying Container App:

```bash
az containerapp show \
  --name YOUR_CONTAINER_APP_NAME \
  --resource-group YOUR_RG \
  --query "identity.principalId" -o tsv
```

Example output: `12345678-1234-1234-1234-123456789abc`

#### Step 3: Grant MI access to Cosmos DB

**Option A: Azure CLI**

```bash
az cosmosdb mongodb role assignment create \
  --account-name YOUR_COSMOS_ACCOUNT_NAME \
  --resource-group YOUR_RG \
  --role-definition-id "00000000-0000-0000-0000-000000000002" \
  --principal-id "CONTAINER_APP_MI_PRINCIPAL_ID" \
  --scope "/"
```

**Option B: Azure Portal**

1. Go to Cosmos DB account → **Data Explorer**
2. Click **RBAC**
3. Click **+ Add**
4. Select role: `Cosmos DB Built-in Data Contributor`
5. Assign to: Container App's Managed Identity (paste Principal ID)
6. Scope: `/` (entire account)

#### Step 4: Update Container App environment variables

```bash
az containerapp update \
  --name YOUR_CONTAINER_APP_NAME \
  --resource-group YOUR_RG \
  --set-env-vars \
    "COSMOS_ENDPOINT=https://YOUR_COSMOS_ACCOUNT.documents.azure.com" \
    "COSMOS_DATABASE_NAME=template-doctor"
```

#### Step 5: Remove MONGODB_URI if set

```bash
az containerapp update \
  --name YOUR_CONTAINER_APP_NAME \
  --resource-group YOUR_RG \
  --remove-env-vars "MONGODB_URI"
```

#### Step 6: Restart Container App

```bash
az containerapp revision restart \
  --name YOUR_CONTAINER_APP_NAME \
  --resource-group YOUR_RG
```

## Environment Variables

### Production (Managed Identity)

```bash
# Set these in Container App environment
COSMOS_ENDPOINT=https://cosmos-abc123.documents.azure.com
COSMOS_DATABASE_NAME=template-doctor

# DO NOT SET these (MI handles authentication):
# MONGODB_URI=<should not be set>
# COSMOS_KEY=<should not be set>
```

### Local Development (Docker Compose)

```bash
# Leave MONGODB_URI unset in .env
# Docker Compose will use: mongodb://mongodb:27017/template-doctor
```

### How the code chooses:

```typescript
const mongoUri = process.env.MONGODB_URI;
const cosmosEndpoint = process.env.COSMOS_ENDPOINT;

if (mongoUri) {
  // Local MongoDB (connection string)
  this.client = new MongoClient(mongoUri);
} else if (cosmosEndpoint) {
  // Cosmos DB with Managed Identity (token-based)
  const credential = new DefaultAzureCredential();
  const token = await credential.getToken('https://cosmos.azure.com/.default');
  const connString = `mongodb://${token}:${token}@${cosmosEndpoint}:10255/...`;
  this.client = new MongoClient(connString);
} else {
  throw new Error('No database configuration found');
}
```

## Troubleshooting

### Error: "Failed to acquire access token from Managed Identity"

**Cause**: Container App doesn't have System-Assigned MI enabled.

**Fix**:

```bash
az containerapp identity assign \
  --name YOUR_CONTAINER_APP_NAME \
  --resource-group YOUR_RG \
  --system-assigned
```

### Error: "MongoServerError: command insert requires authentication"

**Cause**: MI doesn't have RBAC role assigned on Cosmos DB.

**Fix**: Follow [Step 3 in Option 2](#step-3-grant-mi-access-to-cosmos-db) to assign the role.

### Error: "COSMOS_ENDPOINT is not set"

**Cause**: Container App environment variables not configured.

**Fix**:

```bash
az containerapp update \
  --name YOUR_CONTAINER_APP_NAME \
  --resource-group YOUR_RG \
  --set-env-vars "COSMOS_ENDPOINT=https://YOUR_COSMOS_ACCOUNT.documents.azure.com"
```

### Error: "MongoServerSelectionError: connection refused"

**Cause**: Cosmos DB firewall blocking Container App.

**Fix**: Enable **Public Network Access** in Cosmos DB:

1. Go to Cosmos DB → **Networking**
2. Select **All networks** (or add Container App's subnet)
3. Click **Save**

### Verify Managed Identity is working

Check Container App logs:

```bash
az containerapp logs show \
  --name YOUR_CONTAINER_APP_NAME \
  --resource-group YOUR_RG \
  --follow
```

Look for:
```json
{"level":"INFO","msg":"Connecting to Cosmos DB","cosmosEndpoint":"https://cosmos-abc123.documents.azure.com"}
{"level":"INFO","msg":"Connected to Cosmos DB database","databaseName":"template-doctor"}
```

**NOT** this (means connection string is being used):
```json
{"level":"INFO","msg":"Connecting to local MongoDB"}
```

## References

- [Cosmos DB MongoDB API with Managed Identity](https://learn.microsoft.com/azure/cosmos-db/mongodb/how-to-setup-rbac)
- [Container Apps Managed Identity](https://learn.microsoft.com/azure/container-apps/managed-identity)
- [DefaultAzureCredential](https://learn.microsoft.com/javascript/api/@azure/identity/defaultazurecredential)
- [Cosmos DB Built-in Roles](https://learn.microsoft.com/azure/cosmos-db/mongodb/how-to-setup-rbac#built-in-role-definitions)

## Next Steps

1. **Fix Bicep**: Update `infra/main.bicep` to use `COSMOS_ENDPOINT` instead of `MONGODB_URI`
2. **Uncomment Cosmos module**: Let azd provision Cosmos DB automatically
3. **Update setup script**: Clarify that production uses MI, not connection strings
4. **Test deployment**: Verify MI authentication works end-to-end
