#!/usr/bin/env bash
# Test script to diagnose OAuth login button issue

set -e

echo "🔍 OAuth Flow Diagnostics"
echo "========================"
echo ""

# Check backend
echo "1️⃣ Checking Express backend (port 3001)..."
if curl -s http://localhost:3001/api/health > /dev/null; then
  echo "✅ Backend is running"
  curl -s http://localhost:3001/api/health | jq -r '.status'
else
  echo "❌ Backend is NOT running"
  echo "Start it with: cd packages/server && npm run dev"
  exit 1
fi
echo ""

# Check config endpoint
echo "2️⃣ Checking runtime config endpoint..."
CONFIG_RESPONSE=$(curl -s http://localhost:3001/api/v4/client-settings)
echo "$CONFIG_RESPONSE" | jq .
CLIENT_ID=$(echo "$CONFIG_RESPONSE" | jq -r '.githubOAuth.clientId')
REDIRECT_URI=$(echo "$CONFIG_RESPONSE" | jq -r '.githubOAuth.redirectUri')
echo "Client ID: $CLIENT_ID"
echo "Redirect URI: $REDIRECT_URI"
echo ""

# Check frontend config.json
echo "3️⃣ Checking frontend config.json..."
cat packages/app/config.json | jq .
echo ""

# Construct OAuth URL
echo "4️⃣ Testing OAuth URL construction..."
if [ -z "$CLIENT_ID" ] || [ "$CLIENT_ID" = "null" ]; then
  echo "❌ Client ID is not set!"
  echo "Make sure GITHUB_CLIENT_ID is in packages/server/.env"
  exit 1
fi

OAUTH_URL="https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=public_repo%20read:user&state=test123"
echo "OAuth URL:"
echo "$OAUTH_URL"
echo ""

echo "5️⃣ Manual Testing Steps:"
echo "   a) Start preview: cd packages/app && npm run preview"
echo "   b) Open browser: http://localhost:3000"
echo "   c) Open DevTools console (Cmd+Option+J)"
echo "   d) Look for these logs:"
echo "      - 'AUTH_CONFIG.redirectUri: http://localhost:3000/callback.html'"
echo "      - 'Updated AUTH_CONFIG: ...'"
echo "   e) Click login button and check for:"
echo "      - 'Starting login flow with scopes: ...'"
echo "      - 'Full auth URL: ...'"
echo ""

echo "6️⃣ Common Issues:"
echo "   - If no logs appear: auth.ts module not loading"
echo "   - If 'Missing OAuth client ID' appears: config not loaded"
echo "   - If button does nothing: check DOM for #login-button"
echo ""

echo "7️⃣ Quick Browser Test (paste in console):"
echo "   window.GitHubAuth"
echo "   => Should show GitHubAuth object"
echo ""
echo "   document.getElementById('login-button')"
echo "   => Should show the button element"
echo ""

echo "✅ Diagnostics complete. Follow manual testing steps above."
