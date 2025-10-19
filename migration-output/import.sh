#!/bin/bash
# Import script for Cosmos DB MongoDB API
# Usage: ./import.sh <cosmos-endpoint> <database-name>

ENDPOINT=${1:-"https://your-cosmos.mongo.cosmos.azure.com:10255"}
DATABASE=${2:-"template-doctor"}
COLLECTION="analysis"

echo "Importing to $ENDPOINT/$DATABASE/$COLLECTION"
echo "Note: You need mongoimport tool and appropriate credentials"
echo ""
echo "For Cosmos DB, use connection string from Azure Portal:"
echo "mongoimport --uri 'mongodb://...' --db $DATABASE --collection $COLLECTION --file analysis-export.json"
