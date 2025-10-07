#!/bin/bash
# Quick smoke test for Express server endpoints

set -e

BASE=${BASE:-http://localhost:3001}
echo "Testing Express server at $BASE"
echo

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s "$BASE/api/health" | jq . || echo "Health endpoint failed"
echo

# Test client-settings endpoint
echo "2. Testing /api/v4/client-settings endpoint..."
curl -s "$BASE/api/v4/client-settings" | jq . || echo "Client settings endpoint failed"
echo

# Test OAuth endpoint (should fail without code param)
echo "3. Testing /api/v4/github-oauth-token endpoint (expect 400)..."
curl -s -X POST "$BASE/api/v4/github-oauth-token" \
  -H "Content-Type: application/json" \
  -d '{}' | jq . || echo "OAuth endpoint test failed"
echo

# Test analyze endpoint (should fail without repoUrl)
echo "4. Testing /api/v4/analyze-template endpoint (expect 400)..."
curl -s -X POST "$BASE/api/v4/analyze-template" \
  -H "Content-Type: application/json" \
  -d '{}' | jq . || echo "Analyze endpoint test failed"
echo

echo "Smoke tests complete!"
