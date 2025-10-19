#!/bin/bash

# Query database statistics through admin API

API_BASE="${1:-https://ca-web-x5oyap6bsi4si.wittyplant-825c5911.swedencentral.azurecontainerapps.io}"

echo "📊 Querying database statistics..."
echo "   API: $API_BASE"
echo ""

# Get database stats
echo "📚 Collections:"
curl -s "${API_BASE}/api/admin/db-stats" | jq '.'

echo ""
echo "💡 To query a specific collection:"
echo "   curl -s \"${API_BASE}/api/admin/db-query/analysis?limit=5\" | jq"
echo ""
echo "   Example collections:"
echo "   - analysis    (template analysis results)"
echo "   - repos       (repository metadata)"
echo "   - azdtests    (Azure Developer CLI tests)"
echo "   - rulesets    (analysis rulesets)"
echo "   - configuration (app settings)"
