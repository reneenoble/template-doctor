#!/bin/bash

# Query database stats through production API
# This bypasses local MongoDB connection issues

API_BASE="https://ca-web-x5oyap6bsi4si.wittyplant-825c5911.swedencentral.azurecontainerapps.io"

echo "🔍 Querying database through production API..."
echo ""

# Check if we need authentication
echo "📊 Database Health:"
curl -s "${API_BASE}/api/health" | jq '.database // {status: "unknown"}'

echo ""
echo "💡 To query specific collections, you can:"
echo "   1. Add a /api/admin/db-stats endpoint to the server"
echo "   2. Or configure Azure Cosmos DB firewall to allow your IP"
echo ""
echo "🔐 Azure Cosmos DB Firewall Configuration:"
echo "   1. Go to Azure Portal"
echo "   2. Find your Cosmos DB resource: nv-tddb"
echo "   3. Under Settings > Networking"
echo "   4. Add your public IP address"
echo "   5. Or enable 'Accept connections from within public Azure datacenters'"
echo ""
echo "📍 Your public IP:"
curl -s https://api.ipify.org
echo ""
