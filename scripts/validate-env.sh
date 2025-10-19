#!/bin/bash
# Validates required environment variables before Azure deployment

set -e

echo "🔍 Template Doctor - Environment Validation"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track validation status
ERRORS=0
WARNINGS=0

# Load .env file if it exists
if [ -f .env ]; then
    echo "✓ Found .env file"
    export $(grep -v '^#' .env | xargs)
else
    echo -e "${RED}✗ No .env file found${NC}"
    echo "  Run: cp .env.example .env"
    exit 1
fi

echo ""
echo "Checking REQUIRED environment variables..."
echo ""

# Required variables
REQUIRED_VARS=(
    "GITHUB_CLIENT_ID"
    "GITHUB_CLIENT_SECRET"
    "GITHUB_TOKEN"
    "GH_WORKFLOW_TOKEN"
    "ADMIN_GITHUB_USERS"
    "MONGODB_URI"
)

for VAR in "${REQUIRED_VARS[@]}"; do
    VALUE="${!VAR}"
    
    if [ -z "$VALUE" ]; then
        echo -e "${RED}✗ $VAR${NC} - NOT SET"
        ERRORS=$((ERRORS + 1))
    elif [[ "$VALUE" == *"your_"* ]] || [[ "$VALUE" == *"placeholder"* ]]; then
        echo -e "${RED}✗ $VAR${NC} - Still has placeholder value"
        ERRORS=$((ERRORS + 1))
    else
        # Mask secrets for display
        if [[ "$VAR" == *"SECRET"* ]] || [[ "$VAR" == *"TOKEN"* ]] || [[ "$VAR" == "MONGODB_URI" ]]; then
            DISPLAY_VALUE="${VALUE:0:10}...${VALUE: -4}"
        else
            DISPLAY_VALUE="$VALUE"
        fi
        echo -e "${GREEN}✓ $VAR${NC} - $DISPLAY_VALUE"
    fi
done

echo ""
echo "Checking OPTIONAL environment variables..."
echo ""

# Check if AZURE_LOCATION is set, warn if not
if [ -z "$AZURE_LOCATION" ]; then
    echo -e "${YELLOW}⚠ AZURE_LOCATION${NC} - Not set (will default to 'swedencentral')"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ AZURE_LOCATION${NC} - $AZURE_LOCATION"
fi

echo ""
echo "Validating values..."
echo ""

# Validate GitHub Client ID format
if [[ ! "$GITHUB_CLIENT_ID" =~ ^Ov[0-9]{2}[a-zA-Z0-9]+$ ]] && [ -n "$GITHUB_CLIENT_ID" ]; then
    echo -e "${YELLOW}⚠ GITHUB_CLIENT_ID${NC} - Format looks unusual (should start with 'Ov')"
    WARNINGS=$((WARNINGS + 1))
fi

# Validate GitHub token format
if [[ ! "$GITHUB_TOKEN" =~ ^ghp_[a-zA-Z0-9]+$ ]] && [ -n "$GITHUB_TOKEN" ]; then
    echo -e "${YELLOW}⚠ GITHUB_TOKEN${NC} - Format looks unusual (should start with 'ghp_')"
    WARNINGS=$((WARNINGS + 1))
fi

# Validate MongoDB URI format
if [[ ! "$MONGODB_URI" =~ ^mongodb ]]; then
    echo -e "${RED}✗ MONGODB_URI${NC} - Must start with 'mongodb://' or 'mongodb+srv://'"
    ERRORS=$((ERRORS + 1))
fi

# Validate ADMIN_GITHUB_USERS is not empty
if [ -z "$ADMIN_GITHUB_USERS" ]; then
    echo -e "${RED}✗ ADMIN_GITHUB_USERS${NC} - At least one admin user required"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "==========================================="
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ Validation FAILED with $ERRORS error(s)${NC}"
    echo ""
    echo "Please fix the errors above before running 'azd provision'"
    echo "See docs/deployment/DEPLOYMENT_CHECKLIST.md for details"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Validation passed with $WARNINGS warning(s)${NC}"
    echo ""
    echo "You can proceed with 'azd provision' but review warnings above"
    exit 0
else
    echo -e "${GREEN}✅ All required environment variables are valid!${NC}"
    echo ""
    echo "You're ready to deploy:"
    echo "  1. azd auth login"
    echo "  2. azd init (if not already done)"
    echo "  3. azd provision"
    echo "  4. Update GitHub OAuth callback URL with deployed URL"
    echo "  5. ./scripts/deploy.sh"
    exit 0
fi
