#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 PRE-DEPLOYMENT CHECKLIST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Build server TypeScript
echo ""
echo "📦 Step 1: Building server TypeScript..."
cd packages/server
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Server build failed!"
    exit 1
fi
echo "✅ Server built successfully"
cd ../..

# 2. Build frontend
echo ""
echo "📦 Step 2: Building frontend..."
npm run build -w packages/app
if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed!"
    exit 1
fi
echo "✅ Frontend built successfully"

# 3. Verify dist folders exist
echo ""
echo "📦 Step 3: Verifying build artifacts..."
if [ ! -d "packages/server/dist" ]; then
    echo "❌ packages/server/dist not found!"
    exit 1
fi

if [ ! -d "packages/app/dist" ]; then
    echo "❌ packages/app/dist not found!"
    exit 1
fi

if [ ! -f "packages/app/dist/leaderboards.html" ]; then
    echo "❌ leaderboards.html not found in dist!"
    exit 1
fi

if [ ! -f "packages/app/dist/setup.html" ]; then
    echo "❌ setup.html not found in dist!"
    exit 1
fi

echo "✅ All build artifacts present"

# 4. Check file sizes
echo ""
echo "📊 Build sizes:"
ls -lh packages/app/dist/*.html | awk '{print "  " $9 ": " $5}'
echo ""
echo "leaderboards.html size:"
du -h packages/app/dist/leaderboards.html

# 5. Generate build checksums for verification
echo ""
echo "📦 Step 4: Generating build checksums..."
BUILD_HASH_FILE=".build-hashes"

# Create checksums for key files
{
    echo "# Build checksums - $(date)"
    echo "# Server"
    find packages/server/dist -type f -name "*.js" | sort | xargs shasum -a 256 | head -5
    echo "# Frontend"
    shasum -a 256 packages/app/dist/leaderboards.html
    shasum -a 256 packages/app/dist/setup.html
    shasum -a 256 packages/app/dist/index.html
} > "$BUILD_HASH_FILE"

echo "✅ Build hashes saved to $BUILD_HASH_FILE"
echo ""
echo "Top 3 server files:"
head -4 "$BUILD_HASH_FILE" | tail -3 | awk '{print "  " $2}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PRE-DEPLOYMENT CHECKLIST PASSED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Build artifacts ready for deployment"
echo "   Hashes: $BUILD_HASH_FILE"
echo ""
echo "Ready to deploy! Run: ./scripts/deploy.sh"
