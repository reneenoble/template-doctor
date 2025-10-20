#!/bin/bash
set -e

# Test Rate Limiting Script
# This script tests the rate limiting by making multiple requests to various endpoints

BASE_URL="${BASE_URL:-http://localhost:3000}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

echo "🧪 Testing Rate Limiting on $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to make requests and check status
test_endpoint() {
    local endpoint=$1
    local limit=$2
    local window=$3
    local method=${4:-GET}
    local data=${5:-}
    
    echo -e "${YELLOW}Testing: $method $endpoint (Limit: $limit requests/$window)${NC}"
    
    success_count=0
    rate_limited_count=0
    
    # Make requests beyond the limit
    for i in $(seq 1 $((limit + 5))); do
        if [ "$method" = "POST" ] && [ -n "$data" ]; then
            if [ -n "$GITHUB_TOKEN" ]; then
                response=$(curl -s -w "\n%{http_code}" -X POST \
                    -H "Content-Type: application/json" \
                    -H "Authorization: Bearer $GITHUB_TOKEN" \
                    -d "$data" \
                    "$BASE_URL$endpoint")
            else
                response=$(curl -s -w "\n%{http_code}" -X POST \
                    -H "Content-Type: application/json" \
                    -d "$data" \
                    "$BASE_URL$endpoint")
            fi
        else
            response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
        fi
        
        status_code=$(echo "$response" | tail -n1)
        
        if [ "$status_code" = "429" ]; then
            rate_limited_count=$((rate_limited_count + 1))
            if [ $rate_limited_count -eq 1 ]; then
                echo -e "${RED}  Request #$i: 429 Too Many Requests ✓ (Rate limit triggered!)${NC}"
            fi
        elif [ "$status_code" -ge 200 ] && [ "$status_code" -lt 300 ]; then
            success_count=$((success_count + 1))
        fi
        
        # Small delay between requests
        sleep 0.1
    done
    
    echo -e "  Results: ${GREEN}$success_count successful${NC}, ${RED}$rate_limited_count rate-limited${NC}"
    
    if [ $rate_limited_count -gt 0 ]; then
        echo -e "  ${GREEN}✓ Rate limiting is working!${NC}"
    else
        echo -e "  ${RED}✗ Rate limiting may not be working (no 429 responses)${NC}"
    fi
    
    echo ""
}

# Test 1: Health check (should NOT be rate limited)
echo "=== Test 1: Health Check (No Rate Limit) ==="
for i in {1..20}; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
    if [ "$status" = "429" ]; then
        echo -e "${RED}✗ Health check was rate limited (should not be!)${NC}"
        break
    fi
done
echo -e "${GREEN}✓ Health check not rate limited (correct)${NC}"
echo ""

# Test 2: Standard rate limit (100/min)
echo "=== Test 2: Client Settings Endpoint (Standard: 100/min) ==="
test_endpoint "/api/v4/client-settings" 100 "1 minute"

# Test 3: Strict rate limit (10/min) - Auth endpoint
echo "=== Test 3: OAuth Token Endpoint (Auth: 20/min) ==="
test_endpoint "/api/v4/github-oauth-token" 20 "1 minute" "POST" '{"code":"test"}'

# Test 4: Strict rate limit (10/min) - Analysis endpoint (requires auth)
if [ -n "$GITHUB_TOKEN" ]; then
    echo "=== Test 4: Analysis Endpoint (Strict: 10/min, requires auth) ==="
    test_endpoint "/api/v4/analyze-template" 10 "1 minute" "POST" '{"repository":"test/repo"}'
else
    echo "=== Test 4: Analysis Endpoint (Skipped - no GITHUB_TOKEN) ==="
    echo "  Set GITHUB_TOKEN environment variable to test authenticated endpoints"
    echo ""
fi

echo "=== Rate Limiting Test Complete ==="
echo ""
echo "Notes:"
echo "  - Health checks should NEVER be rate limited"
echo "  - Standard endpoints: 100 requests/minute"
echo "  - Auth endpoints: 20 requests/minute"
echo "  - Strict endpoints (analysis, validation): 10 requests/minute"
echo "  - Rate limits are per IP address"
echo ""
echo "To test with authentication:"
echo "  GITHUB_TOKEN=your_token ./test-rate-limit.sh"
